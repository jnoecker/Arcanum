mod anthropic;
mod arcanum_meta;
mod assets;
mod deepinfra;
mod llm;
mod openrouter;
mod project;
mod r2;
mod runware;
mod server;
mod settings;
mod vibes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(server::ServerState::default())
        .invoke_handler(tauri::generate_handler![
            project::validate_mud_dir,
            project::list_legacy_images,
            project::list_legacy_media,
            project::migrate_images_to_r2,
            project::check_git_installed,
            project::clone_mud_project,
            project::clear_world_zones,
            project::delete_zone_file,
            settings::get_settings,
            settings::save_settings,
            deepinfra::generate_image,
            deepinfra::enhance_prompt,
            deepinfra::read_image_data_url,
            llm::llm_complete,
            runware::runware_generate_image,
            runware::runware_generate_audio,
            runware::runware_generate_video,
            assets::accept_asset,
            assets::list_assets,
            assets::delete_asset,
            assets::get_assets_dir,
            assets::resolve_media_path,
            assets::read_media_data_url,
            assets::import_asset,
            assets::set_active_variant,
            assets::list_variants,
            assets::save_bytes_as_asset,
            assets::import_player_sprites,
            r2::sync_assets,
            r2::get_sync_status,
            r2::resolve_asset_url,
            r2::delete_from_r2,
            r2::deploy_sprites_to_r2,
            r2::deploy_global_assets_to_r2,
            server::set_server_pid,
            server::clear_server_pid,
            server::kill_server_tree,
            vibes::save_zone_vibe,
            vibes::load_zone_vibe,
            arcanum_meta::load_arcanum_meta,
            arcanum_meta::save_arcanum_meta,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                server::kill_on_exit(app);
            }
        });
}
