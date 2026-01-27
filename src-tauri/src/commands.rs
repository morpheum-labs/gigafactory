use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs;
use tokio::process::Command;
use tauri::{AppHandle, Emitter, State};

use giga_command_center_core::{AgentManager, AgentConfig, AgentEvent, AgentId, StopReason, SkillInfo, SkillDetail, AppConfig};

#[tauri::command]
pub async fn start_agent(
    app: AppHandle,
    manager: State<'_, Arc<AgentManager>>,
    config: AgentConfig,
) -> Result<AgentId, String> {
    println!("[CCC] Starting agent with prompt: {}", config.prompt);

    let app_clone = app.clone();
    let emit_event = move |event: AgentEvent| {
        println!("[CCC] Emitting event: {:?}", event);
        if let Err(e) = app_clone.emit("agent-event", &event) {
            eprintln!("[CCC] Failed to emit event: {}", e);
        }
    };

    match manager.start_agent(config, emit_event).await {
        Ok(agent_id) => {
            println!("[CCC] Agent started successfully: {}", agent_id);
            Ok(agent_id)
        }
        Err(e) => {
            eprintln!("[CCC] Failed to start agent: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_agent(
    app: AppHandle,
    manager: State<'_, Arc<AgentManager>>,
    agent_id: AgentId,
) -> Result<(), String> {
    manager
        .stop_agent(&agent_id)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "agent-event",
        &AgentEvent::Stopped {
            agent_id,
            reason: StopReason::Cancelled,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn stop_all_agents(manager: State<'_, Arc<AgentManager>>) -> Result<(), String> {
    manager.stop_all().await;
    Ok(())
}

#[tauri::command]
pub async fn list_agents(manager: State<'_, Arc<AgentManager>>) -> Result<Vec<AgentId>, String> {
    Ok(manager.list_agents().await)
}

#[tauri::command]
pub async fn check_cli_available() -> Result<bool, String> {
    match Command::new("claude").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if the Cursor Agent CLI (`agent`) is available.
/// Install: curl https://cursor.com/install -fsS | bash
#[tauri::command]
pub async fn check_cursor_cli_available() -> Result<bool, String> {
    // agent --version or agent -h; --version is more likely to exit 0 when present
    match Command::new("agent").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if the Kilo CLI (`kilo` or `kilocode`) is available.
/// Install: npm install -g @kilocode/cli
#[tauri::command]
pub async fn check_kilo_cli_available() -> Result<bool, String> {
    // Try `kilo` first, then `kilocode` as fallback
    let kilo_check = Command::new("kilo").arg("--version").output().await;
    if let Ok(output) = kilo_check {
        if output.status.success() {
            return Ok(true);
        }
    }
    
    // Fallback to kilocode
    match Command::new("kilocode").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if the Gemini CLI (`gemini`) is available.
/// Install: npm install -g @google/gemini-cli
#[tauri::command]
pub async fn check_gemini_cli_available() -> Result<bool, String> {
    match Command::new("gemini").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if the Grok CLI (`grok`) is available.
/// Install: bun add -g @vibe-kit/grok-cli or npm install -g @vibe-kit/grok-cli
#[tauri::command]
pub async fn check_grok_cli_available() -> Result<bool, String> {
    match Command::new("grok").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

/// Check if the DeepSeek CLI (`deepseek`) is available.
/// Install: Build from Go source - make gosrc-build && make goinstall
/// See: https://github.com/morpheum-labs/deepseek-cli
#[tauri::command]
pub async fn check_deepseek_cli_available() -> Result<bool, String> {
    match Command::new("deepseek").arg("--version").output().await {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillInfo>, String> {
    let config = AppConfig::load().map_err(|e| format!("Failed to load config: {}", e))?;
    let skills_dir = config.get_skills_dir().map_err(|e| format!("Failed to get skills directory: {}", e))?;

    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();
    let mut entries = fs::read_dir(&skills_dir).await.map_err(|e| {
        format!("Failed to read skills directory: {}", e)
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        format!("Failed to read directory entry: {}", e)
    })? {
        let path = entry.path();
        let metadata = entry.metadata().await.map_err(|e| {
            format!("Failed to read entry metadata: {}", e)
        })?;
        
        if metadata.is_dir() {
            // Handle subdirectory with SKILL.md inside
            let skill_md = path.join("SKILL.md");
            if skill_md.exists() {
                if let Ok(content) = fs::read_to_string(&skill_md).await {
                    if let Some(info) = parse_skill_frontmatter(&content, &path) {
                        skills.push(info);
                    }
                }
            }
        } else if metadata.is_file() {
            // Handle .md files directly in the skills directory
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "MD" {
                    if let Ok(content) = fs::read_to_string(&path).await {
                        if let Some(info) = parse_skill_frontmatter(&content, &path) {
                            skills.push(info);
                        }
                    }
                }
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
pub async fn get_skill(skill_name: String) -> Result<SkillDetail, String> {
    let config = AppConfig::load().map_err(|e| format!("Failed to load config: {}", e))?;
    let skills_dir = config.get_skills_dir().map_err(|e| format!("Failed to get skills directory: {}", e))?;
    
    // Try directory with SKILL.md first
    let skill_path = skills_dir.join(&skill_name);
    let skill_md = skill_path.join("SKILL.md");
    
    // If not found, try direct .md file
    let (content, final_path) = if skill_md.exists() {
        let content = fs::read_to_string(&skill_md).await.map_err(|e| {
            format!("Failed to read skill file '{}': {}", skill_name, e)
        })?;
        (content, skill_path)
    } else {
        // Try as direct .md file
        let md_file = skills_dir.join(format!("{}.md", skill_name));
        if !md_file.exists() {
            return Err(format!("Skill '{}' not found", skill_name));
        }
        let content = fs::read_to_string(&md_file).await.map_err(|e| {
            format!("Failed to read skill file '{}': {}", skill_name, e)
        })?;
        // Pass the file path itself, not the parent directory
        (content, md_file)
    };
    
    let info = parse_skill_frontmatter(&content, &final_path)
        .ok_or_else(|| format!("Failed to parse skill frontmatter for '{}'", skill_name))?;

    // Extract content after frontmatter
    let markdown = extract_markdown_content(&content);

    Ok(SkillDetail {
        info,
        markdown,
        path: final_path.to_string_lossy().to_string(),
    })
}

fn parse_skill_frontmatter(content: &str, path: &PathBuf) -> Option<SkillInfo> {
    let lines: Vec<&str> = content.lines().collect();

    // Get base name, stripping .md extension if present
    let mut base_name = path.file_name()?.to_string_lossy().to_string();
    if base_name.ends_with(".md") || base_name.ends_with(".MD") {
        base_name = base_name[..base_name.len() - 3].to_string();
    }

    // Look for YAML frontmatter
    if lines.first()? != &"---" {
        // No frontmatter, use base name
        return Some(SkillInfo {
            name: base_name.clone(),
            description: format!("Custom skill: {}", base_name),
        });
    }

    let mut end_index = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            end_index = Some(i);
            break;
        }
    }

    let end_index = end_index?;
    let frontmatter: Vec<&str> = lines[1..end_index].to_vec();

    let mut name = base_name;
    let mut description = String::new();

    for line in frontmatter {
        if let Some(value) = line.strip_prefix("name:") {
            name = value.trim().to_string();
        } else if let Some(value) = line.strip_prefix("description:") {
            description = value.trim().to_string();
        }
    }

    Some(SkillInfo { name, description })
}

fn extract_markdown_content(content: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();

    if lines.first().map(|l| *l) != Some("---") {
        return content.to_string();
    }

    let mut end_index = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if *line == "---" {
            end_index = Some(i);
            break;
        }
    }

    if let Some(end_index) = end_index {
        lines[end_index + 1..].join("\n").trim().to_string()
    } else {
        content.to_string()
    }
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    AppConfig::load()
}

#[tauri::command]
pub async fn set_config(config: AppConfig) -> Result<AppConfig, String> {
    config.save()?;
    Ok(config)
}
