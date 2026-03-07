use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Shared state tracking the MUD server process.
#[derive(Default)]
pub struct ServerState(Mutex<Option<ServerInfo>>);

#[derive(Clone)]
struct ServerInfo {
    pid: u32,
    mud_dir: String,
}

/// Called from the frontend after spawning the server process.
#[tauri::command]
pub fn set_server_pid(state: tauri::State<'_, ServerState>, pid: u32, mud_dir: String) {
    // Add the process to the kill-on-close job (Windows)
    #[cfg(windows)]
    assign_to_job(pid);

    *state.0.lock().unwrap() = Some(ServerInfo { pid, mud_dir });
}

/// Called from the frontend when the server process exits normally.
#[tauri::command]
pub fn clear_server_pid(state: tauri::State<'_, ServerState>) {
    *state.0.lock().unwrap() = None;
}

/// Kill the server process tree. Called from the frontend's stop button.
#[tauri::command]
pub fn kill_server_tree(state: tauri::State<'_, ServerState>) {
    if let Some(info) = state.0.lock().unwrap().take() {
        kill_server(info.pid, &info.mud_dir);
    }
}

/// Kill any running server when the app exits.
pub fn kill_on_exit(app: &AppHandle) {
    let info = app.state::<ServerState>().0.lock().unwrap().take();
    if let Some(info) = info {
        kill_server(info.pid, &info.mud_dir);
    }
}

// ─── Windows: Job Objects ──────────────────────────────────────────
//
// A Windows Job Object with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
// ensures ALL child processes are killed when the Arcanum process
// exits — even if it crashes. We assign the spawned cmd.exe to
// the job; since child processes inherit job membership, the
// entire tree (cmd → gradle → java) is covered.

#[cfg(windows)]
mod win {
    use std::ffi::c_void;
    use std::sync::OnceLock;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::JobObjects::*;
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_ALL_ACCESS};

    // CreateJobObjectW is not exported by windows-sys 0.59 JobObjects feature
    extern "system" {
        fn CreateJobObjectW(
            lp_job_attributes: *const c_void,
            lp_name: *const u16,
        ) -> HANDLE;
    }

    static JOB: OnceLock<usize> = OnceLock::new();

    fn get_or_create_job() -> HANDLE {
        *JOB.get_or_init(|| unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() || job == INVALID_HANDLE_VALUE {
                return std::ptr::null_mut::<c_void>() as usize;
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if ok == 0 {
                CloseHandle(job);
                return std::ptr::null_mut::<c_void>() as usize;
            }

            job as usize
        }) as HANDLE
    }

    pub fn assign_to_job(pid: u32) {
        unsafe {
            let job = get_or_create_job();
            if job.is_null() {
                return;
            }
            let handle = OpenProcess(PROCESS_ALL_ACCESS, 0, pid);
            if !handle.is_null() && handle != INVALID_HANDLE_VALUE {
                let _ = AssignProcessToJobObject(job, handle);
                CloseHandle(handle);
            }
        }
    }
}

#[cfg(windows)]
use win::assign_to_job;

// ─── Kill (belt-and-suspenders) ────────────────────────────────────

fn kill_server(pid: u32, mud_dir: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // taskkill the tree (works if cmd.exe is still alive)
        if pid != 0 {
            let _ = std::process::Command::new("taskkill")
                .args(["/T", "/F", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status();
        }

        // Belt-and-suspenders: kill java.exe by command line match
        // Uses taskkill /FI which doesn't require PowerShell
        let filter = format!("WINDOWTITLE eq {}", mud_dir);
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/FI", &filter, "/IM", "java.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }

    #[cfg(not(windows))]
    {
        let _ = mud_dir;
        if pid != 0 {
            let _ = std::process::Command::new("kill")
                .args(["-9", &format!("-{pid}")])
                .status();
        }
    }
}
