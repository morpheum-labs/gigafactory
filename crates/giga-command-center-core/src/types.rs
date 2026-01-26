use serde::{Deserialize, Serialize};

pub type AgentId = String;
pub type WorkspaceId = String;

/// CLI backend: Claude (`claude`), Cursor Agent (`agent`), Kilo (`kilo`), Gemini (`gemini`), Grok (`grok`), or DeepSeek (`deepseek`).
/// See: https://cursor.com/docs/cli/overview
/// See: https://github.com/Kilo-Org/kilocode
/// See: https://github.com/google-gemini/gemini-cli
/// See: https://github.com/superagent-ai/grok-cli
/// See: https://github.com/morpheum-labs/deepseek-cli (Go build from gosrc/)
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CliType {
    #[default]
    Claude,
    Cursor,
    Kilo,
    Gemini,
    Grok,
    DeepSeek,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub workspace_id: WorkspaceId,
    pub prompt: String,
    /// Which CLI to use: `claude` (default), `cursor`, `kilo`, `gemini`, `grok`, or `deepseek`.
    #[serde(default)]
    pub cli: Option<CliType>,
    /// Cursor-only: `agent` (default), `plan`, or `ask`. Ignored for Claude and Kilo.
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub working_directory: Option<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
pub enum AgentEvent {
    Started {
        agent_id: AgentId,
        workspace_id: WorkspaceId,
    },
    Init {
        agent_id: AgentId,
        session_id: String,
        model: String,
    },
    Message {
        agent_id: AgentId,
        content: String,
    },
    ToolUse {
        agent_id: AgentId,
        tool_name: String,
        tool_input: serde_json::Value,
    },
    ToolResult {
        agent_id: AgentId,
        tool_name: String,
        success: bool,
    },
    Result {
        agent_id: AgentId,
        success: bool,
        duration_ms: u64,
    },
    Error {
        agent_id: AgentId,
        message: String,
    },
    Stopped {
        agent_id: AgentId,
        reason: StopReason,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StopReason {
    Completed,
    Cancelled,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentError {
    SpawnFailed(String),
    ProcessError(String),
    NotFound,
    AlreadyRunning,
    CliNotAvailable,
}

impl std::fmt::Display for AgentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentError::SpawnFailed(msg) => write!(f, "Failed to spawn agent: {}", msg),
            AgentError::ProcessError(msg) => write!(f, "Process error: {}", msg),
            AgentError::NotFound => write!(f, "Agent not found"),
            AgentError::AlreadyRunning => write!(f, "Agent already running"),
            AgentError::CliNotAvailable => write!(f, "Claude CLI not available"),
        }
    }
}

impl std::error::Error for AgentError {}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ClaudeMessage {
    #[serde(rename = "init")]
    Init {
        session_id: String,
        model: String,
    },
    #[serde(rename = "assistant")]
    Assistant {
        message: AssistantMessage,
    },
    #[serde(rename = "result")]
    Result {
        subtype: String,
        #[serde(default)]
        duration_ms: Option<u64>,
    },
    #[serde(rename = "error")]
    Error {
        error: ErrorInfo,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssistantMessage {
    pub role: String,
    pub content: Vec<ContentBlock>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        #[serde(default)]
        content: Option<String>,
        #[serde(default)]
        is_error: bool,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ErrorInfo {
    #[serde(default)]
    pub message: Option<String>,
}

// Skills types
#[derive(Debug, Clone, Serialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillDetail {
    pub info: SkillInfo,
    pub markdown: String,
    pub path: String,
}
