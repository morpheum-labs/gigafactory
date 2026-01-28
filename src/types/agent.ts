export type AgentState =
  | 'idle'
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'running'
  | 'searching'
  | 'success'
  | 'error';

export interface Agent {
  id: string;
  workspaceId: string;
  state: AgentState;
  task: string | null;
  progress: number;
  logs: LogEntry[];
  sessionId: string | null;
  model: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'info' | 'tool' | 'result' | 'error' | 'message';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

/** CLI backend: `claude` (default), `cursor` (Cursor Agent CLI), `kilo` (Kilo Code CLI), `gemini` (Gemini CLI), `grok` (Grok CLI), `deepseek` (DeepSeek CLI), `kimi` (Kimi CLI), or `qwen` (Qwen Code CLI). */
export type CliType = 'claude' | 'cursor' | 'kilo' | 'gemini' | 'grok' | 'deepseek' | 'kimi' | 'qwen';

export type AgentId = string;

export interface AgentConfig {
  workspaceId: string;
  prompt: string;
  /** `claude` (default), `cursor`, `kilo`, `gemini`, `grok`, `deepseek`, `kimi`, or `qwen`. See https://cursor.com/docs/cli/overview, https://github.com/Kilo-Org/kilocode, https://github.com/google-gemini/gemini-cli, https://github.com/superagent-ai/grok-cli, https://github.com/morpheum-labs/deepseek-cli, https://github.com/moonshot-ai/kimi-cli, https://github.com/QwenLM/qwen-code */
  cli?: CliType;
  /** Cursor-only: `agent`, `plan`, or `ask`. Ignored for Claude and Kilo. */
  mode?: string;
  /** Kimi-only: `acp` (ACP server mode) or `direct` (default). */
  kimiMode?: string;
  /** Kimi-only: Path to MCP configuration file. */
  kimiMcpConfigFile?: string;
  allowedTools?: string[];
  workingDirectory?: string;
  systemPrompt?: string;
  model?: string;
}

export const AGENT_STATE_EMOJI: Record<AgentState, string> = {
  idle: '🧑‍💻',
  thinking: '🤔',
  reading: '📖',
  writing: '✍️',
  running: '🏃',
  searching: '🔍',
  success: '🎉',
  error: '😵',
};

export const AGENT_STATE_COLORS: Record<AgentState, string> = {
  idle: '#a0aec0',
  thinking: '#9f7aea',
  reading: '#4299e1',
  writing: '#ed8936',
  running: '#48bb78',
  searching: '#ecc94b',
  success: '#38a169',
  error: '#e53e3e',
};
