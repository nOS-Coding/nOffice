use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

fn is_path_safe(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    !path_str.contains("..")
        && !path_str.contains('~')
        && !path_str.starts_with('/')
        && !path_str.starts_with("\\\\")
        && path.extension().map_or(false, |e| {
            matches!(
                e.to_str().unwrap_or(""),
                "md"
                    | "txt"
                    | "html"
                    | "json"
                    | "csv"
                    | "tsv"
                    | "xml"
                    | "yaml"
                    | "yml"
                    | "toml"
                    | "js"
                    | "ts"
                    | "py"
                    | "rs"
                    | "css"
                    | "scss"
                    | "less"
                    | "sh"
                    | "env"
                    | "conf"
                    | "cfg"
                    | "ini"
                    | "log"
                    | "drawio"
                    | "png"
                    | "jpg"
                    | "jpeg"
                    | "gif"
                    | "webp"
                    | "svg"
                    | "bmp"
                    | "ico"
                    | "pdf"
                    | "docx"
                    | "xlsx"
                    | "pptx"
                    | "odt"
                    | "ods"
                    | "odp"
            )
        })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentDocument {
    pub path: PathBuf,
    pub name: String,
    pub app_id: String,
    pub last_opened: u64,
}

fn noffice_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".noffice")
}

#[tauri::command]
pub async fn get_recent_documents() -> Result<Vec<RecentDocument>, String> {
    let recent_path = noffice_dir().join("recent.json");

    if recent_path.exists() {
        let content = std::fs::read_to_string(&recent_path).map_err(|e| e.to_string())?;
        let documents: Vec<RecentDocument> =
            serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(documents)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn open_document(path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);

    // Security: sanitize path
    if !is_path_safe(&path) {
        return Err("Invalid file path".into());
    }

    // Restrict to noffice documents directory
    let safe_path = noffice_dir().join("documents").join(&path);

    // Path traversal protection: verify resolved path is within the sandbox
    let canonical = safe_path.canonicalize().map_err(|_| "Invalid path")?;
    let doc_dir = noffice_dir()
        .join("documents")
        .canonicalize()
        .map_err(|_| "Cannot resolve documents directory")?;
    if !canonical.starts_with(&doc_dir) {
        return Err("Path traversal detected".into());
    }

    if !safe_path.exists() {
        return Err("File not found".into());
    }

    let content = std::fs::read_to_string(&safe_path).map_err(|e| e.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn save_document(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    // Security: sanitize path
    if !is_path_safe(&path) {
        return Err("Invalid file path".into());
    }

    // Restrict to noffice documents directory
    let safe_path = noffice_dir().join("documents").join(&path);

    // Path traversal protection: canonicalize parent (file may not exist yet)
    let parent = safe_path.parent().ok_or("Invalid path")?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|_| "Invalid path")?;
    let doc_dir = noffice_dir()
        .join("documents")
        .canonicalize()
        .map_err(|_| "Cannot resolve documents directory")?;
    if !canonical_parent.starts_with(&doc_dir) {
        return Err("Path traversal detected".into());
    }

    std::fs::write(&safe_path, &content).map_err(|e| e.to_string())?;
    Ok(())
}
