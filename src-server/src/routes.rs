use axum::{
    extract::{Extension, Path},
    http::StatusCode,
    response::Json,
};
use std::sync::Arc;
use tokio::sync::broadcast;
use giga_command_center_core::{AgentManager, AgentConfig, AgentId, SkillInfo, SkillDetail, AgentEvent};
use tokio::process::Command;
use tokio::fs;
use std::path::PathBuf;
use giga_command_center_core::AppConfig;

pub async fn start_agent(
    Extension(manager): Extension<Arc<AgentManager>>,
    Extension(event_tx): Extension<Arc<broadcast::Sender<String>>>,
    Json(config): Json<AgentConfig>,
) -> Result<Json<AgentId>, StatusCode> {
    // Create event emitter that sends to WebSocket channel
    let emit_event = move |event: AgentEvent| {
        if let Ok(json) = serde_json::to_string(&event) {
            let _ = event_tx.send(json);
        }
    };
    
    manager.start_agent(config, emit_event)
        .await
        .map(Json)
        .map_err(|e| {
            tracing::error!("Failed to start agent: {}", e);
            match e {
                giga_command_center_core::AgentError::CliNotAvailable => StatusCode::SERVICE_UNAVAILABLE,
                giga_command_center_core::AgentError::AlreadyRunning => StatusCode::CONFLICT,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })
}

pub async fn stop_agent(
    Extension(manager): Extension<Arc<AgentManager>>,
    Path(agent_id): Path<AgentId>,
) -> Result<StatusCode, StatusCode> {
    manager.stop_agent(&agent_id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| {
            tracing::debug!("Failed to stop agent {}: {}", agent_id, e);
            match e {
                giga_command_center_core::AgentError::NotFound => StatusCode::NOT_FOUND,
                _ => {
                    tracing::error!("Unexpected error stopping agent: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                }
            }
        })
}

pub async fn stop_all_agents(
    Extension(manager): Extension<Arc<AgentManager>>,
) -> StatusCode {
    manager.stop_all().await;
    StatusCode::NO_CONTENT
}

pub async fn list_agents(
    Extension(manager): Extension<Arc<AgentManager>>,
) -> Json<Vec<AgentId>> {
    Json(manager.list_agents().await)
}

pub async fn check_cli_available(
    Path(cli): Path<String>,
) -> Json<bool> {
    let binary = match cli.as_str() {
        "claude" => "claude",
        "cursor" => "agent",
        "kilo" => "kilo",
        "gemini" => "gemini",
        "grok" => "grok",
        "deepseek" => "deepseek",
        _ => return Json(false),
    };
    
    let result = Command::new(binary).arg("--version").output().await;
    Json(result.map(|o| o.status.success()).unwrap_or(false))
}

pub async fn list_skills() -> Result<Json<Vec<SkillInfo>>, StatusCode> {
    let config = AppConfig::load().map_err(|e| {
        tracing::error!("Failed to load config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let skills_dir = config.get_skills_dir().map_err(|e| {
        tracing::error!("Failed to get skills directory: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !skills_dir.exists() {
        return Ok(Json(vec![]));
    }

    let mut skills = Vec::new();
    let mut entries = fs::read_dir(&skills_dir).await.map_err(|e| {
        tracing::error!("Failed to read skills directory: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    while let Some(entry) = entries.next_entry().await.map_err(|e| {
        tracing::error!("Failed to read directory entry: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })? {
        let path = entry.path();
        let metadata = entry.metadata().await.map_err(|e| {
            tracing::error!("Failed to read entry metadata: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
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

    Ok(Json(skills))
}

pub async fn get_skill(
    Path(skill_name): Path<String>,
) -> Result<Json<SkillDetail>, StatusCode> {
    let config = AppConfig::load().map_err(|e| {
        tracing::error!("Failed to load config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let skills_dir = config.get_skills_dir().map_err(|e| {
        tracing::error!("Failed to get skills directory: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    // Try directory with SKILL.md first
    let skill_path = skills_dir.join(&skill_name);
    let skill_md = skill_path.join("SKILL.md");
    
    // If not found, try direct .md file
    let (content, final_path) = if skill_md.exists() {
        let content = fs::read_to_string(&skill_md).await.map_err(|e| {
            tracing::error!("Failed to read skill file: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        (content, skill_path)
    } else {
        // Try as direct .md file
        let md_file = skills_dir.join(format!("{}.md", skill_name));
        if !md_file.exists() {
            return Err(StatusCode::NOT_FOUND);
        }
        let content = fs::read_to_string(&md_file).await.map_err(|e| {
            tracing::error!("Failed to read skill file: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
        // Pass the file path itself, not the parent directory
        (content, md_file)
    };
    let info = parse_skill_frontmatter(&content, &final_path)
        .ok_or_else(|| {
            tracing::error!("Failed to parse skill frontmatter for: {}", skill_name);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let markdown = extract_markdown_content(&content);

    Ok(Json(SkillDetail {
        info,
        markdown,
        path: final_path.to_string_lossy().to_string(),
    }))
}

fn parse_skill_frontmatter(content: &str, path: &PathBuf) -> Option<SkillInfo> {
    let lines: Vec<&str> = content.lines().collect();

    // Get base name, stripping .md extension if present
    let mut base_name = path.file_name()?.to_string_lossy().to_string();
    if base_name.ends_with(".md") || base_name.ends_with(".MD") {
        base_name = base_name[..base_name.len() - 3].to_string();
    }

    if lines.first()? != &"---" {
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

pub async fn get_config() -> Result<Json<AppConfig>, StatusCode> {
    let config = AppConfig::load().map_err(|e| {
        tracing::error!("Failed to load config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(config))
}

pub async fn set_config(
    Json(config): Json<AppConfig>,
) -> Result<Json<AppConfig>, StatusCode> {
    config.save().map_err(|e| {
        tracing::error!("Failed to save config: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    Ok(Json(config))
}
