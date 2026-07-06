use anyhow::Result;

use super::model::ModelInfo;

const MODELS_DIR: &str = ".noffice/models";

pub fn scan_models() -> Result<Vec<ModelInfo>> {
    let models_dir = dirs::home_dir()
        .unwrap_or_default()
        .join(MODELS_DIR);

    if !models_dir.exists() {
        std::fs::create_dir_all(&models_dir)?;
        return Ok(vec![]);
    }

    let mut models = vec![];
    for entry in std::fs::read_dir(&models_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "gguf") {
            let metadata = std::fs::metadata(&path)?;
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_string();
            let quantization = detect_quantization(&name);
            models.push(ModelInfo {
                path,
                name,
                quantization,
                size_bytes: metadata.len(),
                is_loaded: false,
            });
        }
    }

    models.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    Ok(models)
}

fn detect_quantization(name: &str) -> String {
    let upper = name.to_uppercase();
    if upper.contains("Q4_K_M") {
        "Q4_K_M".into()
    } else if upper.contains("Q3_K_S") {
        "Q3_K_S".into()
    } else if upper.contains("Q5_K_M") {
        "Q5_K_M".into()
    } else if upper.contains("Q8_0") {
        "Q8_0".into()
    } else {
        "unknown".into()
    }
}
