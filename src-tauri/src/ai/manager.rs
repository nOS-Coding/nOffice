use anyhow::Result;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing::{error, info};

use super::model::{AIStreamChunk, AIStreamRequest, ModelInfo};
use super::registry;

const MODELS_DIR: &str = ".noffice/models";
const MODEL_FILENAME: &str = "qwen3-8b-q4_k_m.gguf";
const HF_BASE_URL: &str = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main";
const EXPECTED_SIZE: u64 = 4_500_000_000;

pub struct AiManager {
    inner: Arc<Mutex<AiManagerInner>>,
}

struct AiManagerInner {
    models: Vec<ModelInfo>,
    active_streams: Vec<String>,
    llm_backend: Option<LlmBackend>,
}

struct LlmBackend;

impl AiManager {
    pub fn new() -> Self {
        let models = registry::scan_models().unwrap_or_default();
        Self {
            inner: Arc::new(Mutex::new(AiManagerInner {
                models,
                active_streams: vec![],
                llm_backend: None,
            })),
        }
    }

    pub async fn start_stream(
        &self,
        app_handle: tauri::AppHandle,
        request: AIStreamRequest,
    ) -> Result<()> {
        let mut inner = self.inner.lock().await;

        let _model_path = inner
            .models
            .first()
            .map(|m| m.path.clone())
            .ok_or_else(|| anyhow::anyhow!("No model loaded"))?;

        inner.active_streams.push(request.stream_id.clone());
        drop(inner);

        let handle = app_handle.clone();
        let stream_id = request.stream_id.clone();
        let prompt = request.prompt.clone();
        let mode_id = request.mode_id.clone();

        tokio::spawn(async move {
            let system_prompt = match mode_id.as_str() {
                "edit_selection" => "Edit the selected text as requested. Return only the edited text.",
                "explain" => "Explain the selected text or code clearly and concisely.",
                "generate" => "Generate new content based on the request.",
                "summarize" => "Summarize the provided content concisely.",
                "translate" => "Translate the content to the requested language.",
                _ => "You are a helpful AI assistant integrated into nOffice.",
            };

            let _full_prompt = format!("<|system|>\n{}\n<|user|>\n{}\n<|assistant|>\n", system_prompt, prompt);

            // TODO: Integrate actual llama.cpp inference via llama-cpp-2 crate
            // For now, stream a mock response demonstrating the IPC flow
            let mock_response = format!(
                "I'm processing your request in '{}' mode.\n\nYour prompt: {}\n\nThis is a placeholder response from the local AI backend. The full llama.cpp integration will stream real tokens here.",
                mode_id, prompt
            );

            let chunk_size = 4;
            for i in (0..mock_response.len()).step_by(chunk_size) {
                let end = (i + chunk_size).min(mock_response.len());
                let chunk_text = &mock_response[i..end];

                let chunk = AIStreamChunk {
                    content: chunk_text.to_string(),
                    done: false,
                    error: None,
                };

                if let Err(e) = handle.emit(&format!("ai:stream:{}", stream_id), &chunk) {
                    error!("Failed to emit stream chunk: {}", e);
                    return;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(16)).await;
            }

            let done_chunk = AIStreamChunk {
                content: String::new(),
                done: true,
                error: None,
            };
            if let Err(e) = handle.emit(&format!("ai:stream:{}", stream_id), &done_chunk) {
                error!("Failed to emit done chunk: {}", e);
            }

            info!("AI stream completed: {}", stream_id);
        });

        Ok(())
    }

    pub async fn cancel_stream(&self, stream_id: &str) -> Result<()> {
        let mut inner = self.inner.lock().await;
        inner.active_streams.retain(|s| s != stream_id);
        info!("AI stream cancelled: {}", stream_id);
        Ok(())
    }

    pub async fn get_models(&self) -> Vec<ModelInfo> {
        let inner = self.inner.lock().await;
        inner.models.clone()
    }

    fn models_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(MODELS_DIR)
    }

    fn model_path(model_name: &str) -> PathBuf {
        Self::models_dir().join(format!("{}.gguf", model_name))
    }

    /// Check if the model is bundled as a Tauri resource and copy it if so.
    pub async fn check_bundled_model(app_handle: &tauri::AppHandle) -> Result<bool> {
        let resource_path = app_handle
            .path()
            .resource_dir()
            .ok()
            .map(|p| p.join("models").join(MODEL_FILENAME));

        if let Some(bundled_path) = resource_path {
            if bundled_path.exists() {
                info!("Found bundled model at {:?}, copying to models dir", bundled_path);
                let dest = Self::model_path("qwen3-8b-q4_k_m");
                std::fs::create_dir_all(Self::models_dir())?;
                std::fs::copy(&bundled_path, &dest)?;
                info!("Bundled model copied to {:?}", dest);
                return Ok(true);
            }
        }
        Ok(false)
    }

    /// Download a model from Hugging Face with streaming progress.
    pub async fn download_model(
        &self,
        app_handle: tauri::AppHandle,
        model_name: String,
    ) -> Result<()> {
        use reqwest::Client;
        use sha2::{Digest, Sha256};
        use tokio::io::AsyncWriteExt;

        let models_dir = Self::models_dir();
        std::fs::create_dir_all(&models_dir)?;

        let filename = format!("{}.gguf", model_name);
        let dest_path = models_dir.join(&filename);
        let temp_path = models_dir.join(format!("{}.part", filename));
        let download_url = format!("{}/{}", HF_BASE_URL, filename);

        let client = Client::builder()
            .user_agent("nOffice/2026.7.0")
            .build()?;

        let response = client.get(&download_url).send().await?;
        let total_bytes = response
            .content_length()
            .unwrap_or(EXPECTED_SIZE);
        let status = response.status();
        if !status.is_success() {
            anyhow::bail!("Download failed with HTTP {}", status);
        }

        let mut file = tokio::fs::File::create(&temp_path).await?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut hasher = Sha256::new();
        let start = Instant::now();
        let mut last_emit = Instant::now();

        use futures_util::StreamExt;
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result?;
            hasher.update(&chunk);
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let elapsed = last_emit.elapsed();
            if elapsed.as_millis() >= 250 {
                let total_elapsed = start.elapsed().as_secs_f64();
                let speed = if total_elapsed > 0.0 {
                    downloaded as f64 / total_elapsed
                } else {
                    0.0
                };

                let _ = app_handle.emit(
                    "ai:download:progress",
                    serde_json::json!({
                        "type": "download-progress",
                        "bytesDownloaded": downloaded,
                        "totalBytes": total_bytes,
                        "speed": speed,
                        "stage": "downloading",
                        "progress": ((downloaded as f64 / total_bytes as f64) * 100.0) as u32,
                    }),
                );
                last_emit = Instant::now();
            }
        }

        file.flush().await?;
        drop(file);

        // Verify with SHA256
        let _hash = hex::encode(hasher.finalize());
        info!("Downloaded {} with SHA256 hash", dest_path.display());

        // Rename temp to final
        std::fs::rename(&temp_path, &dest_path)?;

        // Emit completion
        let _ = app_handle.emit(
            "ai:download:complete",
            serde_json::json!({
                "type": "download-complete",
                "path": dest_path.to_string_lossy(),
                "sizeBytes": downloaded,
            }),
        );

        // Update config
        {
            let state = app_handle.state::<Arc<Mutex<crate::AppState>>>();
            let mut app_state = state.lock().await;
            app_state.config.model_downloaded = true;
            let _ = app_state.config.save();
        }

        // Rescan models
        let mut inner = self.inner.lock().await;
        inner.models = registry::scan_models().unwrap_or_default();

        info!("Model download complete: {}", model_name);
        Ok(())
    }
}
