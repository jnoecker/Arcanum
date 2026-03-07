use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Manager};

/// Shared state holding the MUD server's PID (0 = no server running).
#[derive(Default)]
pub struct ServerPid(AtomicU32);

/// Kill a process tree by PID.
/// On Windows uses `taskkill /T /F /PID` to kill the entire tree.
fn kill_process_tree(pid: u32) {
    if pid == 0 {
        return;
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let _ = std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
    }
}

/// Called from the frontend after spawning the server process.
#[tauri::command]
pub fn set_server_pid(state: tauri::State<'_, ServerPid>, pid: u32) {
    state.0.store(pid, Ordering::Relaxed);
}

/// Called from the frontend when the server process exits normally.
#[tauri::command]
pub fn clear_server_pid(state: tauri::State<'_, ServerPid>) {
    state.0.store(0, Ordering::Relaxed);
}

/// Kill the server process tree. Called from the frontend's stop button.
#[tauri::command]
pub fn kill_server_tree(state: tauri::State<'_, ServerPid>) {
    let pid = state.0.swap(0, Ordering::Relaxed);
    kill_process_tree(pid);
}

/// Kill any running server when the app exits.
pub fn kill_on_exit(app: &AppHandle) {
    let state = app.state::<ServerPid>();
    let pid = state.0.swap(0, Ordering::Relaxed);
    kill_process_tree(pid);
}
