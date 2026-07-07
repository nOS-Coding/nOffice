use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub theme: String,
    pub language: String,
    pub auto_save: bool,
    pub auto_save_interval: u32,
    pub model_path: PathBuf,
    pub model_quantization: String,
    pub ai_enabled: bool,
    #[serde(default)]
    pub model_downloaded: bool,
    pub document_dir: PathBuf,
    pub license_key: String,
    pub license_valid: bool,
    pub license_email: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            language: "en".into(),
            auto_save: true,
            auto_save_interval: 30,
            model_path: dirs::home_dir()
                .unwrap_or_default()
                .join(".noffice/models/qwen3-8b-q4_k_m.gguf"),
            model_quantization: "Q4_K_M".into(),
            ai_enabled: true,
            model_downloaded: false,
            document_dir: dirs::document_dir().unwrap_or_default(),
            license_key: String::new(),
            license_valid: false,
            license_email: String::new(),
        }
    }
}

impl AppConfig {
    pub fn config_path() -> PathBuf {
        let base = dirs::home_dir().unwrap_or_default().join(".noffice");
        base.join("config.json")
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            let config = AppConfig::default();
            config.save()?;
            Ok(config)
        }
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
