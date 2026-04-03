mod admin;
mod anthropic;
mod arcanum_meta;
mod assets;
mod deepinfra;
mod git;
mod generation;
mod llm;
mod openai_images;
mod openrouter;
mod project;
mod r2;
mod runware;
mod project_settings;
mod settings;
mod sketch;
mod vibes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            project::validate_mud_dir,
            project::validate_project,
            project::create_standalone_project,
            project::create_zone_directory,
            project::delete_zone_directory,
            project::list_legacy_images,
            project::list_legacy_media,
            project::migrate_images_to_r2,
            project::check_git_installed,
            project::clone_mud_project,
            project::clear_world_zones,
            project::delete_zone_file,
            project::read_text_file,
            settings::get_settings,
            settings::save_settings,
            settings::get_merged_settings,
            project_settings::get_project_settings,
            project_settings::save_project_settings,
            project_settings::seed_project_settings,
            deepinfra::generate_image,
            deepinfra::img2img_generate,
            deepinfra::enhance_prompt,
            deepinfra::read_image_data_url,
            llm::llm_complete,
            llm::llm_complete_with_vision,
            runware::runware_generate_image,
            openai_images::openai_generate_image,
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
            assets::bulk_import_images,
            assets::migrate_sprite_tier,
            assets::expand_base_sprites,
            r2::import_from_r2,
            r2::sync_assets,
            r2::get_sync_status,
            r2::resolve_asset_url,
            r2::delete_from_r2,
            r2::deploy_sprites_to_r2,
            r2::deploy_global_assets_to_r2,
            r2::deploy_config_to_r2,
            r2::deploy_achievements_to_r2,
            r2::deploy_zones_to_r2,
            r2::deploy_showcase_to_r2,
            vibes::save_zone_vibe,
            vibes::load_zone_vibe,
            arcanum_meta::load_arcanum_meta,
            arcanum_meta::save_arcanum_meta,
            sketch::analyze_sketch,
            admin::load_admin_config,
            admin::save_admin_config,
            admin::admin_overview,
            admin::admin_players,
            admin::admin_player_detail,
            admin::admin_zones,
            admin::admin_zone_detail,
            admin::admin_reload,
            admin::admin_health,
            admin::admin_player_search,
            admin::admin_player_toggle_staff,
            admin::admin_room_detail,
            admin::admin_mobs,
            admin::admin_mob_detail,
            admin::admin_abilities,
            admin::admin_ability_detail,
            admin::admin_effects,
            admin::admin_effect_detail,
            admin::admin_quests,
            admin::admin_quest_detail,
            admin::admin_achievements,
            admin::admin_achievement_detail,
            admin::admin_shops,
            admin::admin_items,
            admin::admin_broadcast,
            admin::admin_logs,
            git::git_repo_status,
            git::git_init,
            git::git_set_remote,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_abort_merge,
            git::git_log,
            git::git_create_pr,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {});
}
