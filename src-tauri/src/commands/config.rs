use crate::core::config::AppConfig;
use crate::AppState;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<Mutex<AppState>>>) -> Result<AppConfig, String> {
    let app_state = state.lock().await;
    Ok(app_state.config.clone())
}

#[tauri::command]
pub async fn set_config(
    state: State<'_, Arc<Mutex<AppState>>>,
    config: AppConfig,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    app_state.config = config.clone();
    app_state.config.save().map_err(|e| e.to_string())?;
    Ok(())
}
