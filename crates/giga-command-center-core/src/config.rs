use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use dirs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub skills_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let default_path = dirs::home_dir()
            .map(|h| h.join(".claude").join("skills").to_string_lossy().to_string())
            .unwrap_or_else(|| "~/.claude/skills".to_string());
        
        AppConfig {
            skills_path: default_path,
        }
    }
}

impl AppConfig {
    pub fn get_config_path() -> Result<PathBuf, String> {
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        let config_dir = home.join(".gigafactory");
        Ok(config_dir.join("config.json"))
    }

    pub fn load() -> Result<Self, String> {
        let config_path = Self::get_config_path()?;
        
        if !config_path.exists() {
            let default_config = Self::default();
            // Save default config
            default_config.save()?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        
        let config: AppConfig = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse config file: {}", e))?;
        
        Ok(config)
    }

    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::get_config_path()?;
        let config_dir = config_path.parent().ok_or("Invalid config path")?;
        
        // Create config directory if it doesn't exist
        fs::create_dir_all(config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        
        fs::write(&config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
        
        Ok(())
    }

    pub fn get_skills_dir(&self) -> Result<PathBuf, String> {
        let path_str = self.skills_path.as_str();
        
        // Expand ~ to home directory
        let expanded_path = if path_str.starts_with("~/") {
            let home = dirs::home_dir().ok_or("Failed to get home directory")?;
            home.join(&path_str[2..])
        } else if path_str.starts_with('~') {
            let home = dirs::home_dir().ok_or("Failed to get home directory")?;
            home.join(&path_str[1..])
        } else {
            PathBuf::from(path_str)
        };
        
        Ok(expanded_path)
    }
}
