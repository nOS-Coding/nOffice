use std::fs;
use std::path::PathBuf;

fn noffice_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".noffice")
}

fn is_path_safe(path: &PathBuf) -> bool {
    let path_str = path.to_string_lossy();
    !path_str.contains("..")
        && !path_str.contains('~')
        && !path_str.starts_with('/')
        && !path_str.starts_with("\\\\")
}

#[tauri::command]
pub async fn export_html(content: String, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    if !is_path_safe(&path) {
        return Err("Invalid file path".into());
    }

    let safe_path = noffice_dir().join("documents").join(&path);

    let parent = safe_path.parent().ok_or("Invalid path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|_| "Invalid path")?;
    let doc_dir = noffice_dir()
        .join("documents")
        .canonicalize()
        .map_err(|_| "Cannot resolve documents directory")?;
    if !canonical_parent.starts_with(&doc_dir) {
        return Err("Path traversal detected".into());
    }

    fs::write(&safe_path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_txt(content: String, path: String) -> Result<(), String> {
    let path = PathBuf::from(&path);

    if !is_path_safe(&path) {
        return Err("Invalid file path".into());
    }

    let safe_path = noffice_dir().join("documents").join(&path);

    let parent = safe_path.parent().ok_or("Invalid path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let canonical_parent = parent.canonicalize().map_err(|_| "Invalid path")?;
    let doc_dir = noffice_dir()
        .join("documents")
        .canonicalize()
        .map_err(|_| "Cannot resolve documents directory")?;
    if !canonical_parent.starts_with(&doc_dir) {
        return Err("Path traversal detected".into());
    }

    fs::write(&safe_path, &content).map_err(|e| e.to_string())?;
    Ok(())
}
