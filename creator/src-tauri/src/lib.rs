mod assets;
mod deepinfra;
mod project;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            project::validate_mud_dir,
            settings::get_settings,
            settings::save_settings,
            deepinfra::generate_image,
            deepinfra::enhance_prompt,
            deepinfra::read_image_data_url,
            assets::accept_asset,
            assets::list_assets,
            assets::delete_asset,
            assets::get_assets_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
