mod ai;
mod commands;
mod core;
mod lsp_proxy;

use core::config::AppConfig;
use core::logging::init_logging;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub config: AppConfig,
    pub ai: ai::manager::AiManager,
    pub embedding_queue: ai::embedding::EmbeddingQueue,
}

pub fn run() {
    init_logging();

    let (embedding_queue, embedding_rx) = ai::embedding::EmbeddingQueue::new();
    let embedding_db = embedding_queue.db();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |_app| {
            ai::embedding::EmbeddingQueue::spawn_processor(embedding_rx, embedding_db);
            Ok(())
        })
        .manage(Arc::new(Mutex::new(AppState {
            config: AppConfig::load().unwrap_or_default(),
            ai: ai::manager::AiManager::new(),
            embedding_queue,
        })))
        .invoke_handler(tauri::generate_handler![
            commands::ai::ai_start_stream,
            commands::ai::ai_cancel_stream,
            commands::ai::ai_get_model_status,
            commands::ai::ai_download_model,
            commands::ai::ai_list_models,
            commands::window::open_app_window,
            commands::config::get_config,
            commands::config::set_config,
            commands::document::get_recent_documents,
            commands::document::open_document,
            commands::document::save_document,
            commands::export::export_html,
            commands::export::export_txt,
        ])
        .run(tauri::generate_context!())
        .expect("nOffice failed to start");
}
