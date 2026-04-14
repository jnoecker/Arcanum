mod admin;
#[cfg(feature = "ai")]
mod anthropic;
mod arcanum_meta;
mod assets;
mod audio_mix;
mod cancellation;
mod captions;
#[cfg(feature = "ai")]
mod deepinfra;
mod ffmpeg;
mod ffmpeg_progress;
mod fs_utils;
mod git;
#[cfg(feature = "ai")]
mod generation;
mod http;
mod hub;
#[cfg(feature = "ai")]
mod hub_ai;
#[cfg(feature = "ai")]
mod llm;
#[cfg(feature = "ai")]
mod openai_images;
#[cfg(feature = "ai")]
mod openai_tts;
#[cfg(feature = "ai")]
mod openrouter;
mod project;
mod r2;
mod snapshots;
#[cfg(feature = "ai")]
mod runware;
mod project_settings;
mod settings;
#[cfg(feature = "ai")]
mod sketch;
mod video_encode;
mod video_export;
mod vibes;

macro_rules! base_handler {
    ($($extra:path),* $(,)?) => {
        tauri::generate_handler![
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
            project::rename_zone,
            project::read_text_file,
            settings::get_settings,
            settings::save_settings,
            settings::get_merged_settings,
            settings::set_active_project_dir,
            project_settings::get_project_settings,
            project_settings::save_project_settings,
            project_settings::seed_project_settings,
            fs_utils::read_image_data_url,
            ffmpeg::check_ffmpeg_status,
            ffmpeg::ensure_ffmpeg_ready,
            video_export::save_video_frame,
            video_export::cleanup_video_export_session,
            video_export::resolve_first_existing_path,
            video_export::export_story_video,
            video_export::cancel_story_video_export,
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
            assets::export_assets_to_dir,
            assets::migrate_sprite_tier,
            assets::expand_base_sprites,
            assets::flip_image,
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
            r2::deploy_story_video_to_r2,
            hub::publish_to_hub,
            vibes::save_zone_vibe,
            vibes::load_zone_vibe,
            arcanum_meta::load_arcanum_meta,
            arcanum_meta::save_arcanum_meta,
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
            snapshots::snapshot_create,
            snapshots::snapshot_list,
            snapshots::snapshot_delete,
            snapshots::snapshot_restore,
            snapshots::snapshot_prune,
            snapshots::backup_export,
            snapshots::backup_import,
            $($extra,)*
        ]
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler({
            #[cfg(feature = "ai")]
            {
                base_handler![
                    deepinfra::generate_image,
                    deepinfra::img2img_generate,
                    deepinfra::enhance_prompt,
                    llm::llm_complete,
                    llm::llm_complete_with_vision,
                    runware::runware_generate_image,
                    runware::runware_remove_background,
                    runware::runware_generate_audio,
                    runware::runware_generate_video,
                    openai_images::openai_generate_image,
                    openai_tts::openai_tts_generate,
                    sketch::analyze_sketch,
                ]
            }
            #[cfg(not(feature = "ai"))]
            {
                base_handler![]
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {});
}
