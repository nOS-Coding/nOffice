use anyhow::Result;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use tracing::{error, info};

use super::model::{AIStreamChunk, AIStreamRequest, ModelInfo};
use super::registry;

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

        let model_path = inner
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

            let full_prompt = format!("<|system|>\n{}\n<|user|>\n{}\n<|assistant|>\n", system_prompt, prompt);

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

    pub async fn download_model(&self, app_handle: tauri::AppHandle) -> Result<()> {
        let models_dir = dirs::home_dir()
            .unwrap_or_default()
            .join(".noffice/models");
        std::fs::create_dir_all(&models_dir)?;

        let repo_id = "Qwen/Qwen3-8B-GGUF";
        let filename = "qwen3-8b-q4_k_m.gguf";

        app_handle.emit(
            "ai:download:progress",
            serde_json::json!({"stage": "downloading", "progress": 0, "message": "Starting download..."}),
        )?;

        tokio::spawn(async move {
            // TODO: Integrate hf_hub crate for actual download
            for i in 0..10 {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                let progress = (i + 1) * 10;
                let _ = app_handle.emit(
                    "ai:download:progress",
                    serde_json::json!({"stage": "downloading", "progress": progress, "message": format!("Downloading... {}%", progress)}),
                );
            }
            let _ = app_handle.emit(
                "ai:download:progress",
                serde_json::json!({"stage": "ready", "progress": 100, "message": "Model ready"}),
            );
        });

        Ok(())
    }
}
