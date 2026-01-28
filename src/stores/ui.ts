import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ActivePanel = 'list' | 'workspace' | 'agent' | 'skills' | 'logs';

// Wiring state for drag-to-connect
export interface WiringState {
  isWiring: boolean;
  fromWorkspaceId: string | null;
  fromType: 'input' | 'output' | null;
  mouseX: number;
  mouseY: number;
}

interface UIState {
  selectedWorkspaceId: string | null;
  selectedAgentId: string | null;
  activePanel: ActivePanel;
  sidebarCollapsed: boolean;
  statusMessage: string;
  cliAvailable: boolean | null;
  cursorCliAvailable: boolean | null;
  kiloCliAvailable: boolean | null;
  geminiCliAvailable: boolean | null;
  grokCliAvailable: boolean | null;
  deepseekCliAvailable: boolean | null;
  kimiCliAvailable: boolean | null;
  outputModalAgentId: string | null;
  editingWorkspaceId: string | null; // For inline name editing
  positionEditWorkspaceId: string | null; // For position editing mode
  settingsPanelOpen: boolean;
  wiring: WiringState;

  selectWorkspace: (workspaceId: string | null) => void;
  selectAgent: (agentId: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  toggleSidebar: () => void;
  setStatusMessage: (message: string) => void;
  setCliAvailable: (available: boolean) => void;
  setCursorCliAvailable: (available: boolean) => void;
  setKiloCliAvailable: (available: boolean) => void;
  setGeminiCliAvailable: (available: boolean) => void;
  setGrokCliAvailable: (available: boolean) => void;
  setDeepseekCliAvailable: (available: boolean) => void;
  setKimiCliAvailable: (available: boolean) => void;
  showOutputModal: (agentId: string | null) => void;
  setEditingWorkspace: (workspaceId: string | null) => void;
  setPositionEditWorkspace: (workspaceId: string | null) => void;
  toggleSettingsPanel: () => void;
  startWiring: (workspaceId: string, type: 'input' | 'output', x: number, y: number) => void;
  updateWiring: (x: number, y: number) => void;
  endWiring: () => void;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    selectedWorkspaceId: null,
    selectedAgentId: null,
    activePanel: 'list',
    sidebarCollapsed: false,
    statusMessage: 'Ready',
    cliAvailable: null,
    cursorCliAvailable: null,
    kiloCliAvailable: null,
    geminiCliAvailable: null,
    grokCliAvailable: null,
    deepseekCliAvailable: null,
    kimiCliAvailable: null,
    outputModalAgentId: null,
    editingWorkspaceId: null,
    positionEditWorkspaceId: null,
    settingsPanelOpen: false,
    wiring: {
      isWiring: false,
      fromWorkspaceId: null,
      fromType: null,
      mouseX: 0,
      mouseY: 0,
    },

    selectWorkspace: (workspaceId: string | null) => {
      set((state) => {
        state.selectedWorkspaceId = workspaceId;
        if (workspaceId) {
          state.activePanel = 'workspace';
        }
      });
    },

    selectAgent: (agentId: string | null) => {
      set((state) => {
        state.selectedAgentId = agentId;
        if (agentId) {
          state.activePanel = 'agent';
        }
      });
    },

    setActivePanel: (panel: ActivePanel) => {
      set((state) => {
        state.activePanel = panel;
      });
    },

    toggleSidebar: () => {
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      });
    },

    setStatusMessage: (message: string) => {
      set((state) => {
        state.statusMessage = message;
      });
    },

    setCliAvailable: (available: boolean) => {
      set((state) => {
        state.cliAvailable = available;
      });
    },

    setCursorCliAvailable: (available: boolean) => {
      set((state) => {
        state.cursorCliAvailable = available;
      });
    },

    setKiloCliAvailable: (available: boolean) => {
      set((state) => {
        state.kiloCliAvailable = available;
      });
    },

    setGeminiCliAvailable: (available: boolean) => {
      set((state) => {
        state.geminiCliAvailable = available;
      });
    },

    setGrokCliAvailable: (available: boolean) => {
      set((state) => {
        state.grokCliAvailable = available;
      });
    },

    setDeepseekCliAvailable: (available: boolean) => {
      set((state) => {
        state.deepseekCliAvailable = available;
      });
    },

    setKimiCliAvailable: (available: boolean) => {
      set((state) => {
        state.kimiCliAvailable = available;
      });
    },

    showOutputModal: (agentId: string | null) => {
      set((state) => {
        state.outputModalAgentId = agentId;
      });
    },

    setEditingWorkspace: (workspaceId: string | null) => {
      set((state) => {
        state.editingWorkspaceId = workspaceId;
      });
    },

    setPositionEditWorkspace: (workspaceId: string | null) => {
      set((state) => {
        state.positionEditWorkspaceId = workspaceId;
      });
    },

    toggleSettingsPanel: () => {
      set((state) => {
        state.settingsPanelOpen = !state.settingsPanelOpen;
      });
    },

    startWiring: (workspaceId: string, type: 'input' | 'output', x: number, y: number) => {
      set((state) => {
        state.wiring = {
          isWiring: true,
          fromWorkspaceId: workspaceId,
          fromType: type,
          mouseX: x,
          mouseY: y,
        };
      });
    },

    updateWiring: (x: number, y: number) => {
      set((state) => {
        if (state.wiring.isWiring) {
          state.wiring.mouseX = x;
          state.wiring.mouseY = y;
        }
      });
    },

    endWiring: () => {
      set((state) => {
        state.wiring = {
          isWiring: false,
          fromWorkspaceId: null,
          fromType: null,
          mouseX: 0,
          mouseY: 0,
        };
      });
    },
  }))
);
