use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub path: PathBuf,
    pub name: String,
    pub quantization: String,
    pub size_bytes: u64,
    pub is_loaded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIStreamRequest {
    pub prompt: String,
    pub mode_id: String,
    pub stream_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIStreamChunk {
    pub content: String,
    pub done: bool,
    pub error: Option<String>,
}
