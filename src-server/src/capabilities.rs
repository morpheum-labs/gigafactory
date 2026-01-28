use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use giga_command_center_core::CliType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllowedCommand {
    pub name: String,
    pub cmd: String,
    #[serde(default = "default_args_allowed")]
    pub args: bool,
}

fn default_args_allowed() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capabilities {
    pub identifier: String,
    pub description: String,
    pub permissions: Permissions,
    pub allowed_commands: Vec<AllowedCommand>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permissions {
    #[serde(rename = "shell:allow-spawn")]
    pub shell_allow_spawn: bool,
    #[serde(rename = "shell:allow-kill")]
    pub shell_allow_kill: bool,
}

pub struct CapabilityManager {
    allowed_commands: Arc<RwLock<HashSet<String>>>,
    permissions: Arc<RwLock<Permissions>>,
}

impl CapabilityManager {
    pub async fn load() -> Result<Self, String> {
        // Try to find capabilities file
        let capabilities_path = find_capabilities_file()?;
        
        let content = tokio::fs::read_to_string(&capabilities_path)
            .await
            .map_err(|e| format!("Failed to read capabilities file: {}", e))?;
        
        let caps: Capabilities = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse capabilities file: {}", e))?;
        
        // Build set of allowed command binaries
        let allowed_commands: HashSet<String> = caps
            .allowed_commands
            .iter()
            .map(|cmd| cmd.cmd.clone())
            .collect();
        
        tracing::info!(
            "Loaded capabilities: {} commands allowed",
            allowed_commands.len()
        );
        
        Ok(Self {
            allowed_commands: Arc::new(RwLock::new(allowed_commands)),
            permissions: Arc::new(RwLock::new(caps.permissions)),
        })
    }
    
    /// Check if a command binary is allowed to be spawned
    pub async fn is_command_allowed(&self, binary: &str) -> bool {
        let allowed = self.allowed_commands.read().await;
        allowed.contains(binary)
    }
    
    /// Check if spawn is allowed
    pub async fn can_spawn(&self) -> bool {
        let perms = self.permissions.read().await;
        perms.shell_allow_spawn
    }
    
    /// Check if kill is allowed
    /// Note: Currently not used, but available for future kill validation
    #[allow(dead_code)]
    pub async fn can_kill(&self) -> bool {
        let perms = self.permissions.read().await;
        perms.shell_allow_kill
    }
    
    /// Validate that a CLI type maps to an allowed command
    pub async fn validate_cli_type(&self, cli_type: &CliType) -> Result<(), String> {
        let binary = match cli_type {
            CliType::Claude => "claude",
            CliType::Cursor => "agent",
            CliType::Kilo => "kilo",
            CliType::Gemini => "gemini",
            CliType::Grok => "grok",
            CliType::DeepSeek => "deepseek-cli",
            CliType::Kimi => "kimi",
        };
        
        if !self.is_command_allowed(binary).await {
            return Err(format!(
                "Command '{}' is not allowed by capabilities",
                binary
            ));
        }
        
        if !self.can_spawn().await {
            return Err("Shell spawn is not allowed by capabilities".to_string());
        }
        
        Ok(())
    }
}

fn find_capabilities_file() -> Result<PathBuf, String> {
    // Try multiple locations
    let mut candidates = vec![
        // Relative to current directory (for development)
        PathBuf::from("capabilities/default.json"),
        // Relative to src-server directory
        PathBuf::from("src-server/capabilities/default.json"),
    ];
    
    // Add absolute paths based on current working directory
    if let Ok(cwd) = std::env::current_dir() {
        if let Some(file_name) = cwd.file_name() {
            if file_name == "src-server" {
                candidates.push(cwd.join("capabilities/default.json"));
            } else {
                candidates.push(cwd.join("src-server/capabilities/default.json"));
            }
        }
    }
    
    for path in candidates {
        if path.exists() {
            return Ok(path);
        }
    }
    
    Err("Could not find capabilities/default.json file. Please ensure it exists in src-server/capabilities/".to_string())
}
