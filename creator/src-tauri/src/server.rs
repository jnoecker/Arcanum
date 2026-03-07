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

/// Kill the process tree rooted at `pid`, then also kill any java.exe
/// whose command line contains the project directory (catches orphaned
/// grandchildren from cmd → gradle → java).
fn kill_server(pid: u32, mud_dir: &str) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Try tree-kill first (works if cmd.exe is still alive)
        let _ = std::process::Command::new("taskkill")
            .args(["/T", "/F", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        // Also kill any java.exe spawned from this project directory.
        // The Gradle `run` task launches java with the project path in
        // its command line (classpath, working dir, etc).
        let escaped = mud_dir.replace('\\', "\\\\");
        let wmic_filter = format!(
            "Name='java.exe' AND CommandLine LIKE '%{}%'",
            escaped
        );
        let _ = std::process::Command::new("wmic")
            .args(["process", "where", &wmic_filter, "call", "terminate"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }

    #[cfg(not(windows))]
    {
        let _ = mud_dir; // suppress unused warning
        // On Unix, kill the process group
        let _ = std::process::Command::new("kill")
            .args(["-9", &format!("-{pid}")])
            .status();
    }
}

/// Called from the frontend after spawning the server process.
#[tauri::command]
pub fn set_server_pid(state: tauri::State<'_, ServerState>, pid: u32, mud_dir: String) {
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
    // Clone the info out so we don't hold borrows across the kill call
    let info = app.state::<ServerState>().0.lock().unwrap().take();
    if let Some(info) = info {
        kill_server(info.pid, &info.mud_dir);
    }
}
