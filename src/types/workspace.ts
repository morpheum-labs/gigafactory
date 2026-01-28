export type WorkspaceState = 'empty' | 'occupied' | 'working' | 'success' | 'error';

export type ModelId = 
  | 'claude-sonnet-4-20250514' 
  | 'claude-opus-4-20250514' 
  | 'claude-3-5-haiku-20241022'
  | 'deepseek-chat'
  | 'deepseek-reasoner'
  | 'moonshot-v1-8k'
  | 'moonshot-v1-32k'
  | 'moonshot-v1-128k';

/** CLI backend: `claude`, `cursor` (Cursor Agent), `kilo` (Kilo Code), `gemini` (Gemini CLI), `grok` (Grok CLI), `deepseek` (DeepSeek CLI), `kimi` (Kimi CLI), or `qwen` (Qwen Code CLI). */
export type CliType = 'claude' | 'cursor' | 'kilo' | 'gemini' | 'grok' | 'deepseek' | 'kimi' | 'qwen';

export interface WorkspaceConnection {
  fromId: string;      // Source workspace ID
  toId: string;        // Target workspace ID
  label?: string;      // Optional label for the connection
}

export interface Workspace {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: WorkspaceState;
  agentId: string | null;
  messiness: number;
  createdAt: number;
  systemPrompt: string | null;
  model: ModelId;
  /** `claude` (default), `cursor`, `kilo`, `gemini`, `grok`, `deepseek`, `kimi`, or `qwen`. */
  cli?: CliType;
  /** Cursor-only: `agent`, `plan`, or `ask`. Ignored for Claude and Kilo. */
  mode?: string;
  /** Kimi-only: `acp` (ACP server mode) or `direct` (default). */
  kimiMode?: string;
  /** Kimi-only: Path to MCP configuration file. */
  kimiMcpConfigFile?: string;

  // Workflow features
  taskTemplate: string | null;      // Pre-defined task prompt for this workspace
  lastOutput: string | null;        // Output from last completed task (for piping)
  inputConnections: string[];       // IDs of workspaces that feed INTO this one
  outputConnections: string[];      // IDs of workspaces this one feeds TO
  autoRun: boolean;                 // Auto-run when all inputs complete
}

export const AVAILABLE_MODELS: { id: ModelId; name: string; description: string; cli?: CliType[] }[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Fast & capable (default)', cli: ['claude'] },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most powerful', cli: ['claude'] },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest, lightweight', cli: ['claude'] },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Standard chat mode (default)', cli: ['deepseek'] },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'Thinking mode (auto-enabled)', cli: ['deepseek'] },
  { id: 'moonshot-v1-8k', name: 'Moonshot v1 8K', description: '8K context (default)', cli: ['kimi'] },
  { id: 'moonshot-v1-32k', name: 'Moonshot v1 32K', description: '32K context', cli: ['kimi'] },
  { id: 'moonshot-v1-128k', name: 'Moonshot v1 128K', description: '128K context', cli: ['kimi'] },
];

/**
 * Get the default model for a given CLI type
 * Source for DeepSeek models: https://api-docs.deepseek.com/api/list-models
 */
export function getDefaultModelForCli(cli: CliType): ModelId {
  const defaultModel = AVAILABLE_MODELS.find(
    (m) => m.cli?.includes(cli) && m.description.toLowerCase().includes('default')
  ) || AVAILABLE_MODELS.find((m) => m.cli?.includes(cli));
  
  if (defaultModel) {
    return defaultModel.id;
  }
  
  // Fallback defaults
  switch (cli) {
    case 'deepseek':
      return 'deepseek-chat';
    case 'kimi':
      return 'moonshot-v1-8k';
    case 'qwen':
      // Qwen Code is OpenAI-compatible and can use various models
      // Default model is typically configured via environment or CLI
      // Return a generic model ID that can be overridden
      return 'claude-sonnet-4-20250514'; // Fallback to Claude model ID format
    case 'claude':
    default:
      return 'claude-sonnet-4-20250514';
  }
}

/**
 * Check if a model is valid for a given CLI type
 */
export function isModelValidForCli(model: ModelId, cli: CliType): boolean {
  const modelDef = AVAILABLE_MODELS.find((m) => m.id === model);
  if (!modelDef) return false;
  // If model has no CLI restriction, it's valid for all
  if (!modelDef.cli) return true;
  return modelDef.cli.includes(cli);
}

export interface DrawingState {
  isDrawing: boolean;
  start: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
}

export const WORKSPACE_STATE_COLORS: Record<WorkspaceState, { fill: number; border: number }> = {
  empty: { fill: 0x2d3748, border: 0x4a5568 },
  occupied: { fill: 0x3d4a5c, border: 0x5a6b7c },
  working: { fill: 0x2c5282, border: 0x3182ce },
  success: { fill: 0x276749, border: 0x38a169 },
  error: { fill: 0x9b2c2c, border: 0xe53e3e },
};

export const WORKSPACE_STATE_EMOJI: Record<WorkspaceState, string> = {
  empty: '📋',
  occupied: '🧑‍💻',
  working: '⚡',
  success: '✅',
  error: '❌',
};

export const MIN_WORKSPACE_SIZE = 200;
export const DEFAULT_WORKSPACE_SIZE = 200;
