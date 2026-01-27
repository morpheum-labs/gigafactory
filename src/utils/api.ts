import { isTauri, getApiBaseUrl } from './env';
import type { AgentConfig, AgentId } from '../types/agent';
import type { AgentEvent } from '../types/events';
import type { SkillInfo, SkillDetail } from '../types/skill';
import { isAgentEvent } from '../types/events';

// Tauri imports (only used when in Tauri mode)
let tauriInvoke: typeof import('@tauri-apps/api/core').invoke;
let tauriListen: typeof import('@tauri-apps/api/event').listen;

if (isTauri) {
  // Dynamically import Tauri APIs only when needed
  Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ]).then(([core, event]) => {
    tauriInvoke = core.invoke;
    tauriListen = event.listen;
  });
}

/**
 * WebSocket connection for web mode
 */
let ws: WebSocket | null = null;
let wsEventListeners: Set<(event: AgentEvent) => void> = new Set();
let wsReconnectAttempts = 0;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsConnectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

/**
 * Calculate exponential backoff delay for reconnection
 */
function getReconnectDelay(attempt: number): number {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Connect to WebSocket with improved reconnection logic
 */
function connectWebSocket(): void {
  if (isTauri) {
    return;
  }

  // Don't connect if already connected or connecting
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
    return;
  }

  // Clear any pending reconnection timer
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  const wsUrl = getApiBaseUrl().replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
  
  try {
    wsConnectionState = 'connecting';
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      wsConnectionState = 'connected';
      wsReconnectAttempts = 0;
      
      // Notify listeners that connection is established
      // Send a synthetic event to indicate connection (optional)
      // This could be used for UI feedback
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Validate that the message is a valid AgentEvent
        if (!isAgentEvent(data)) {
          console.warn('[WebSocket] Received invalid event:', data);
          return;
        }
        
        const agentEvent: AgentEvent = data;
        wsEventListeners.forEach(listener => {
          try {
            listener(agentEvent);
          } catch (error) {
            console.error('[WebSocket] Error in event listener:', error);
          }
        });
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error, 'Raw data:', event.data);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      wsConnectionState = 'disconnected';
    };
    
    ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      wsConnectionState = 'disconnected';
      ws = null;
      
      // Only attempt to reconnect if we haven't exceeded max attempts
      // and the close wasn't intentional (code 1000)
      if (event.code !== 1000 && wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        wsReconnectAttempts++;
        const delay = getReconnectDelay(wsReconnectAttempts - 1);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${wsReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        
        wsReconnectTimer = setTimeout(() => {
          connectWebSocket();
        }, delay);
      } else if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[WebSocket] Max reconnection attempts reached. Manual reconnection required.');
        // Could emit a connection error event here for UI feedback
      }
    };
  } catch (error) {
    console.error('[WebSocket] Failed to create connection:', error);
    wsConnectionState = 'disconnected';
    ws = null;
    
    // Attempt to reconnect after a delay
    if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      wsReconnectAttempts++;
      const delay = getReconnectDelay(wsReconnectAttempts - 1);
      wsReconnectTimer = setTimeout(() => {
        connectWebSocket();
      }, delay);
    }
  }
}

/**
 * Get current WebSocket connection state
 */
export function getWebSocketState(): 'disconnected' | 'connecting' | 'connected' {
  return wsConnectionState;
}

/**
 * Manually reconnect WebSocket (useful for UI controls)
 */
export function reconnectWebSocket(): void {
  if (isTauri) {
    return;
  }
  
  wsReconnectAttempts = 0;
  if (ws) {
    ws.close();
  }
  connectWebSocket();
}

/**
 * API abstraction layer
 */
export const api = {
  /**
   * Start an agent
   */
  async startAgent(config: AgentConfig): Promise<AgentId> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<AgentId>('start_agent', { config });
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to start agent: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Stop an agent
   */
  async stopAgent(agentId: AgentId): Promise<void> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await tauriInvoke('stop_agent', { agentId });
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/agents/${agentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to stop agent: ${response.status} ${errorText}`);
      }
    }
  },

  /**
   * Stop all agents
   */
  async stopAllAgents(): Promise<void> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await tauriInvoke('stop_all_agents');
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/agents/all`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to stop all agents: ${response.status} ${errorText}`);
      }
    }
  },

  /**
   * List all agents
   */
  async listAgents(): Promise<AgentId[]> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<AgentId[]>('list_agents');
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/agents`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to list agents: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Check if a CLI is available
   */
  async checkCliAvailable(cli: 'claude' | 'cursor' | 'kilo' | 'gemini' | 'grok' | 'deepseek'): Promise<boolean> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const commandMap: Record<string, string> = {
        claude: 'check_cli_available',
        cursor: 'check_cursor_cli_available',
        kilo: 'check_kilo_cli_available',
        gemini: 'check_gemini_cli_available',
        grok: 'check_grok_cli_available',
        deepseek: 'check_deepseek_cli_available',
      };
      return await tauriInvoke<boolean>(commandMap[cli]);
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/cli/check/${cli}`);
      if (!response.ok) {
        return false;
      }
      return await response.json();
    }
  },

  /**
   * List skills
   */
  async listSkills(): Promise<SkillInfo[]> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<SkillInfo[]>('list_skills');
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/skills`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to list skills: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Get skill detail
   */
  async getSkill(skillName: string): Promise<SkillDetail> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<SkillDetail>('get_skill', { skillName });
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/skills/${encodeURIComponent(skillName)}`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        if (response.status === 404) {
          throw new Error(`Skill '${skillName}' not found`);
        }
        throw new Error(`Failed to get skill: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Get application configuration
   */
  async getConfig(): Promise<{ skills_path: string }> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<{ skills_path: string }>('get_config');
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/config`);
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to get config: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Set application configuration
   */
  async setConfig(config: { skills_path: string }): Promise<{ skills_path: string }> {
    if (isTauri) {
      if (!tauriInvoke) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return await tauriInvoke<{ skills_path: string }>('set_config', { config });
    } else {
      const response = await fetch(`${getApiBaseUrl()}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to set config: ${response.status} ${errorText}`);
      }
      return await response.json();
    }
  },

  /**
   * Listen to agent events
   */
  async listenToEvents(callback: (event: AgentEvent) => void): Promise<() => void> {
    if (isTauri) {
      // Wait for Tauri APIs to load
      while (!tauriListen) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const unlisten = await tauriListen<AgentEvent>('agent-event', (event) => {
        callback(event.payload);
      });
      return () => {
        try {
          unlisten();
        } catch (error) {
          // Silently handle any errors during unlisten
        }
      };
    } else {
      // Web mode: use WebSocket
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        // Wait for connection (with timeout)
        const maxWaitTime = 10000; // 10 seconds
        const checkInterval = 100; // Check every 100ms
        const maxAttempts = maxWaitTime / checkInterval;
        
        let attempts = 0;
        await new Promise<void>((resolve, reject) => {
          const checkConnection = () => {
            attempts++;
            if (ws?.readyState === WebSocket.OPEN) {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error('WebSocket connection timeout. Please check if the server is running.'));
            } else {
              setTimeout(checkConnection, checkInterval);
            }
          };
          checkConnection();
        });
      }
      
      wsEventListeners.add(callback);
      
      return () => {
        wsEventListeners.delete(callback);
      };
    }
  },
};

// Initialize WebSocket connection in web mode
if (!isTauri && typeof window !== 'undefined') {
  connectWebSocket();
}
