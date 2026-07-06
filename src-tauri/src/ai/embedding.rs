use serde::{Deserialize, Serialize};
use sled::Db;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingTask {
    pub id: String,
    pub document_id: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResult {
    pub task_id: String,
    pub document_id: String,
    pub vector: Vec<f32>,
}

pub struct EmbeddingQueue {
    sender: mpsc::Sender<EmbeddingTask>,
    db: Arc<Db>,
}

impl EmbeddingQueue {
    pub fn new() -> Self {
        let db_path = dirs::home_dir()
            .unwrap_or_default()
            .join(".noffice/embeddings");
        std::fs::create_dir_all(&db_path).ok();

        let db = sled::open(&db_path).expect("Failed to open embedding database");
        let db = Arc::new(db);

        let (sender, mut receiver) = mpsc::channel::<EmbeddingTask>(1024);
        let db_clone = db.clone();

        tokio::spawn(async move {
            while let Some(task) = receiver.recv().await {
                info!("Processing embedding task: {}", task.id);
                // TODO: Actual embedding via llama.cpp embedding model
                let mock_vector: Vec<f32> = vec![0.0; 4096];
                let result = EmbeddingResult {
                    task_id: task.id,
                    document_id: task.document_id,
                    vector: mock_vector,
                };
                if let Ok(data) = serde_json::to_vec(&result) {
                    let key = format!("doc:{}", task.document_id);
                    let _ = db_clone.insert(key.as_bytes(), data);
                }
            }
        });

        Self { sender, db }
    }

    pub async fn enqueue(&self, task: EmbeddingTask) -> Result<(), mpsc::error::SendError<EmbeddingTask>> {
        self.sender.send(task).await
    }

    pub fn get_embedding(&self, document_id: &str) -> Option<EmbeddingResult> {
        let key = format!("doc:{}", document_id);
        self.db
            .get(key.as_bytes())
            .ok()
            .flatten()
            .and_then(|data| serde_json::from_slice(&data).ok())
    }
}
