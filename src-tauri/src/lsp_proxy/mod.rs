use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    pub language: String,
    pub command: String,
    pub args: Vec<String>,
    pub extensions: Vec<String>,
}

pub struct LspProxy {
    servers: HashMap<String, LspServerInstance>,
}

struct LspServerInstance {
    process: Child,
    language: String,
}

impl LspProxy {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    pub async fn start_server(&mut self, config: LspServerConfig) -> Result<()> {
        let process = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        info!("LSP server started for {}: {}", config.language, config.command);

        self.servers.insert(
            config.language.clone(),
            LspServerInstance {
                process,
                language: config.language,
            },
        );

        Ok(())
    }

    pub async fn send_request(&mut self, language: &str, request: &str) -> Result<String> {
        let instance = self
            .servers
            .get_mut(language)
            .ok_or_else(|| anyhow::anyhow!("No LSP server for {}", language))?;

        if let Some(stdin) = instance.process.stdin.as_mut() {
            let header = format!("Content-Length: {}\r\n\r\n", request.len());
            stdin.write_all(header.as_bytes()).await?;
            stdin.write_all(request.as_bytes()).await?;
            stdin.flush().await?;
        }

        if let Some(stdout) = instance.process.stdout.as_mut() {
            let mut reader = BufReader::new(stdout);
            let mut header_line = String::new();
            reader.read_line(&mut header_line).await?;

            if let Some(len_str) = header_line.strip_prefix("Content-Length: ") {
                if let Ok(len) = len_str.trim().parse::<usize>() {
                    reader.read_line(&mut String::new()).await?; // empty line
                    let mut content = vec![0u8; len];
                    reader.read_exact(&mut content).await?;
                    return Ok(String::from_utf8_lossy(&content).to_string());
                }
            }
        }

        Err(anyhow::anyhow!("Failed to read LSP response"))
    }

    pub async fn shutdown(&mut self, language: &str) -> Result<()> {
        if let Some(mut instance) = self.servers.remove(language) {
            instance.process.kill().await?;
            info!("LSP server shut down for {}", language);
        }
        Ok(())
    }
}
