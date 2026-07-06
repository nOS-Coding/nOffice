use crate::ai::model::{AIStreamRequest, ModelInfo};
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn ai_start_stream(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
    prompt: String,
    mode_id: String,
    stream_id: String,
) -> Result<(), String> {
    let app_state = state.lock().await;
    let request = AIStreamRequest {
        prompt,
        mode_id,
        stream_id,
    };
    app_state
        .ai
        .start_stream(app_handle, request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_cancel_stream(
    state: State<'_, Arc<Mutex<AppState>>>,
    stream_id: String,
) -> Result<(), String> {
    let app_state = state.lock().await;
    app_state
        .ai
        .cancel_stream(&stream_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_get_model_status(state: State<'_, Arc<Mutex<AppState>>>) -> Result<Vec<ModelInfo>, String> {
    let app_state = state.lock().await;
    Ok(app_state.ai.get_models().await)
}

#[tauri::command]
pub async fn ai_download_model(
    app_handle: tauri::AppHandle,
    state: State<'_, Arc<Mutex<AppState>>>,
) -> Result<(), String> {
    let app_state = state.lock().await;
    app_state
        .ai
        .download_model(app_handle)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_list_models() -> Result<Vec<ModelInfo>, String> {
    crate::ai::registry::scan_models().map_err(|e| e.to_string())
}
