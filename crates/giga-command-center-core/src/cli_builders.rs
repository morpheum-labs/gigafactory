use crate::types::AgentConfig;

pub fn build_claude_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    let mut args = vec![
        "-p".to_string(),
        config.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
        "--verbose".to_string(),
        "--permission-mode".to_string(),
        "bypassPermissions".to_string(),
    ];
    if let Some(model) = &config.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }
    if let Some(sp) = &config.system_prompt {
        if !sp.is_empty() {
            args.push("--system-prompt".to_string());
            args.push(sp.clone());
        }
    }
    if let Some(tools) = &config.allowed_tools {
        if !tools.is_empty() {
            args.push("--allowedTools".to_string());
            args.push(tools.join(","));
        }
    }
    ("claude", args)
}

pub fn build_cursor_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    // Cursor CLI: https://cursor.com/docs/cli/overview
    // Modes: agent (default), plan, ask. Non-interactive: -p, --model, --output-format
    let mut args = vec![
        "-p".to_string(),
        config.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    if let Some(model) = &config.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }
    if let Some(mode) = &config.mode {
        let m = mode.trim().to_lowercase();
        if ["agent", "plan", "ask"].contains(&m.as_str()) {
            args.push("--mode".to_string());
            args.push(m);
        }
    }
    ("agent", args)
}

pub fn build_kilo_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    // Kilo CLI: https://github.com/Kilo-Org/kilocode
    // Binary: `kilo` or `kilocode`
    // Similar to Claude/Cursor: -p, --model, --output-format
    let mut args = vec![
        "-p".to_string(),
        config.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    if let Some(model) = &config.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }
    if let Some(sp) = &config.system_prompt {
        if !sp.is_empty() {
            args.push("--system-prompt".to_string());
            args.push(sp.clone());
        }
    }
    ("kilo", args)
}

pub fn build_gemini_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    // Gemini CLI: https://github.com/google-gemini/gemini-cli
    // Binary: `gemini`
    // Similar to other CLIs: -p, -m (for model), --output-format
    let mut args = vec![
        "-p".to_string(),
        config.prompt.clone(),
        "--output-format".to_string(),
        "stream-json".to_string(),
    ];
    if let Some(model) = &config.model {
        args.push("-m".to_string());
        args.push(model.clone());
    }
    if let Some(sp) = &config.system_prompt {
        if !sp.is_empty() {
            args.push("--system-prompt".to_string());
            args.push(sp.clone());
        }
    }
    ("gemini", args)
}

pub fn build_grok_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    // Grok CLI: https://github.com/superagent-ai/grok-cli
    // Binary: `grok`
    // Install: bun add -g @vibe-kit/grok-cli or npm install -g @vibe-kit/grok-cli
    // Headless mode: -p or --prompt, --model
    // Note: Grok CLI doesn't document --output-format, so we omit it
    let mut args = vec![
        "-p".to_string(),
        config.prompt.clone(),
    ];
    if let Some(model) = &config.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }
    if let Some(sp) = &config.system_prompt {
        if !sp.is_empty() {
            args.push("--system-prompt".to_string());
            args.push(sp.clone());
        }
    }
    ("grok", args)
}

pub fn build_deepseek_args(config: &AgentConfig) -> (&'static str, Vec<String>) {
    // DeepSeek CLI (Go build): https://github.com/morpheum-labs/deepseek-cli
    // Binary: `deepseek-cli` (built from gosrc/)
    // Install: make gosrc-build && make goinstall (or go build from gosrc/)
    // Single prompt mode: deepseek-cli chat "prompt" [flags]
    // Interactive mode: deepseek [flags] (not used here, we use chat mode)
    // Models: deepseek-chat (cloud), deepseek-coder:6.7b (local), deepseek-reasoner (cloud)
    // Flags: --model/-m, --api-key/-k, --local/-l, --ollama-host, --stream/-s, --thinking
    // System prompts: Use DEEPSEEK_SYSTEM_MESSAGE env var or prepend to prompt
    let mut query = config.prompt.clone();
    if let Some(sp) = &config.system_prompt {
        if !sp.is_empty() {
            query = format!("System: {}\n\nUser: {}", sp, query);
        }
    }
    
    let mut args = vec![
        "chat".to_string(),
        query,
    ];
    
    if let Some(model) = &config.model {
        args.push("--model".to_string());
        args.push(model.clone());
    }
    
    // Enable streaming by default for better UX
    args.push("--stream".to_string());
    
    // Note: --api-key, --local, --ollama-host, --thinking would need to be
    // passed via environment variables or additional config fields
    // For now, we rely on environment variables for these settings
    
    ("deepseek-cli", args)
}
