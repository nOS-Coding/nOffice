use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentDocument {
    pub path: PathBuf,
    pub name: String,
    pub app_id: String,
    pub last_opened: u64,
}

#[tauri::command]
pub async fn get_recent_documents() -> Result<Vec<RecentDocument>, String> {
    let recent_path = dirs::home_dir()
        .unwrap_or_default()
        .join(".noffice/recent.json");

    if recent_path.exists() {
        let content = std::fs::read_to_string(&recent_path).map_err(|e| e.to_string())?;
        let documents: Vec<RecentDocument> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(documents)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn open_document(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    if !path.exists() {
        return Err("File not found".into());
    }

    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn save_document(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(())
}
