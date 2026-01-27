import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Workspace, WorkspaceState, DrawingState, ModelId, CliType } from '../types/workspace';
import { MIN_WORKSPACE_SIZE, getDefaultModelForCli, isModelValidForCli } from '../types/workspace';

interface WorkspacesState {
  workspaces: Record<string, Workspace>;
  drawing: DrawingState;

  addWorkspace: (workspace: Omit<Workspace, 'id' | 'createdAt' | 'taskTemplate' | 'lastOutput' | 'inputConnections' | 'outputConnections' | 'autoRun' | 'cli' | 'mode'>) => string;
  removeWorkspace: (workspaceId: string) => void;
  updateWorkspaceState: (workspaceId: string, state: WorkspaceState) => void;
  setWorkspaceAgent: (workspaceId: string, agentId: string | null) => void;
  updateMessiness: (workspaceId: string, messiness: number) => void;
  incrementMessiness: (workspaceId: string, amount?: number) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  setSystemPrompt: (workspaceId: string, prompt: string | null) => void;
  setModel: (workspaceId: string, model: ModelId) => void;
  setCli: (workspaceId: string, cli: CliType) => void;
  setMode: (workspaceId: string, mode: string | null) => void;

  // Workflow methods
  setTaskTemplate: (workspaceId: string, template: string | null) => void;
  setLastOutput: (workspaceId: string, output: string | null) => void;
  setAutoRun: (workspaceId: string, autoRun: boolean) => void;
  connectWorkspaces: (fromId: string, toId: string) => void;
  disconnectWorkspaces: (fromId: string, toId: string) => void;
  getInputsForWorkspace: (workspaceId: string) => { id: string; output: string | null }[];
  getDownstreamWorkspaces: (workspaceId: string) => string[];
  updateWorkspacePosition: (workspaceId: string, x: number, y: number) => void;

  startDrawing: (x: number, y: number) => void;
  updateDrawing: (x: number, y: number) => void;
  finishDrawing: () => { x: number; y: number; width: number; height: number } | null;
  cancelDrawing: () => void;
}

let workspaceCounter = 0;

export const useWorkspacesStore = create<WorkspacesState>()(
  immer((set, get) => ({
    workspaces: {},
    drawing: {
      isDrawing: false,
      start: null,
      current: null,
    },

    addWorkspace: (workspace) => {
      const id = nanoid();
      workspaceCounter++;
      set((state) => {
        // Ensure minimum size
        const width = Math.max(workspace.width, MIN_WORKSPACE_SIZE);
        const height = Math.max(workspace.height, MIN_WORKSPACE_SIZE);
        
        state.workspaces[id] = {
          ...workspace,
          id,
          name: workspace.name || `Workspace ${workspaceCounter}`,
          createdAt: Date.now(),
          systemPrompt: workspace.systemPrompt ?? null,
          model: workspace.model ?? 'claude-sonnet-4-20250514',
          cli: 'claude',
          mode: undefined,
          width,
          height,
          // Workflow defaults
          taskTemplate: null,
          lastOutput: null,
          inputConnections: [],
          outputConnections: [],
          autoRun: false,
        };
      });
      return id;
    },

    removeWorkspace: (workspaceId: string) => {
      set((state) => {
        // Remove this workspace from all connections
        Object.values(state.workspaces).forEach((ws) => {
          ws.inputConnections = ws.inputConnections.filter((id) => id !== workspaceId);
          ws.outputConnections = ws.outputConnections.filter((id) => id !== workspaceId);
        });
        delete state.workspaces[workspaceId];
      });
    },

    updateWorkspaceState: (workspaceId: string, workspaceState: WorkspaceState) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].state = workspaceState;
        }
      });
    },

    setWorkspaceAgent: (workspaceId: string, agentId: string | null) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].agentId = agentId;
          state.workspaces[workspaceId].state = agentId ? 'occupied' : 'empty';
        }
      });
    },

    updateMessiness: (workspaceId: string, messiness: number) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].messiness = Math.min(100, Math.max(0, messiness));
        }
      });
    },

    incrementMessiness: (workspaceId: string, amount: number = 15) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          const current = state.workspaces[workspaceId].messiness;
          state.workspaces[workspaceId].messiness = Math.min(100, current + amount);
        }
      });
    },

    renameWorkspace: (workspaceId: string, name: string) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].name = name;
        }
      });
    },

    setSystemPrompt: (workspaceId: string, prompt: string | null) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].systemPrompt = prompt;
        }
      });
    },

    setModel: (workspaceId: string, model: ModelId) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          const workspace = state.workspaces[workspaceId];
          const cli = workspace.cli ?? 'claude';
          
          // Validate that the model is valid for the current CLI
          if (isModelValidForCli(model, cli)) {
            workspace.model = model;
          } else {
            // If invalid, use default for the CLI
            console.warn(`Model ${model} is not valid for CLI ${cli}, using default`);
            workspace.model = getDefaultModelForCli(cli);
          }
        }
      });
    },

    setCli: (workspaceId: string, cli: CliType) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          const workspace = state.workspaces[workspaceId];
          workspace.cli = cli;
          
          // Auto-update model to appropriate default when switching CLI
          const currentModel = workspace.model;
          if (!isModelValidForCli(currentModel, cli)) {
            workspace.model = getDefaultModelForCli(cli);
          }
        }
      });
    },

    setMode: (workspaceId: string, mode: string | null) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].mode = mode ?? undefined;
        }
      });
    },

    // Workflow methods
    setTaskTemplate: (workspaceId: string, template: string | null) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].taskTemplate = template;
        }
      });
    },

    setLastOutput: (workspaceId: string, output: string | null) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].lastOutput = output;
        }
      });
    },

    setAutoRun: (workspaceId: string, autoRun: boolean) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].autoRun = autoRun;
        }
      });
    },

    connectWorkspaces: (fromId: string, toId: string) => {
      set((state) => {
        const fromWs = state.workspaces[fromId];
        const toWs = state.workspaces[toId];
        if (fromWs && toWs) {
          // Avoid duplicates
          if (!fromWs.outputConnections.includes(toId)) {
            fromWs.outputConnections.push(toId);
          }
          if (!toWs.inputConnections.includes(fromId)) {
            toWs.inputConnections.push(fromId);
          }
        }
      });
    },

    disconnectWorkspaces: (fromId: string, toId: string) => {
      set((state) => {
        const fromWs = state.workspaces[fromId];
        const toWs = state.workspaces[toId];
        if (fromWs) {
          fromWs.outputConnections = fromWs.outputConnections.filter((id) => id !== toId);
        }
        if (toWs) {
          toWs.inputConnections = toWs.inputConnections.filter((id) => id !== fromId);
        }
      });
    },

    getInputsForWorkspace: (workspaceId: string) => {
      const { workspaces } = get();
      const workspace = workspaces[workspaceId];
      if (!workspace) return [];

      return workspace.inputConnections.map((inputId) => ({
        id: inputId,
        output: workspaces[inputId]?.lastOutput ?? null,
      }));
    },

    getDownstreamWorkspaces: (workspaceId: string) => {
      const { workspaces } = get();
      const workspace = workspaces[workspaceId];
      return workspace?.outputConnections ?? [];
    },

    updateWorkspacePosition: (workspaceId: string, x: number, y: number) => {
      set((state) => {
        if (state.workspaces[workspaceId]) {
          state.workspaces[workspaceId].x = Math.max(0, x);
          state.workspaces[workspaceId].y = Math.max(0, y);
        }
      });
    },

    startDrawing: (x: number, y: number) => {
      set((state) => {
        state.drawing = {
          isDrawing: true,
          start: { x, y },
          current: { x, y },
        };
      });
    },

    updateDrawing: (x: number, y: number) => {
      set((state) => {
        if (state.drawing.isDrawing) {
          state.drawing.current = { x, y };
        }
      });
    },

    finishDrawing: () => {
      const { drawing } = get();
      if (!drawing.isDrawing || !drawing.start || !drawing.current) {
        set((state) => {
          state.drawing = { isDrawing: false, start: null, current: null };
        });
        return null;
      }

      const x = Math.min(drawing.start.x, drawing.current.x);
      const y = Math.min(drawing.start.y, drawing.current.y);
      const width = Math.abs(drawing.current.x - drawing.start.x);
      const height = Math.abs(drawing.current.y - drawing.start.y);

      set((state) => {
        state.drawing = { isDrawing: false, start: null, current: null };
      });

      if (width < MIN_WORKSPACE_SIZE || height < MIN_WORKSPACE_SIZE) {
        return null;
      }

      return { x, y, width, height };
    },

    cancelDrawing: () => {
      set((state) => {
        state.drawing = { isDrawing: false, start: null, current: null };
      });
    },
  }))
);
