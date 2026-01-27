import { useEffect, useCallback } from 'react';
import { useUIStore } from '../stores/ui';
import { useWorkspacesStore } from '../stores/workspaces';
import { useAgentsStore } from '../stores/agents';

interface ShortcutHandlers {
  onCreateWorkspace?: (x: number, y: number) => void;
  onRunTask?: (workspaceId: string) => void;
  onStopTask?: (agentId: string) => void;
  onDelete?: (workspaceId: string) => void;
  onStartConnect?: (workspaceId: string) => void;
  onFocusTaskInput?: (workspaceId: string) => void;
}

// Track mouse position globally for workspace creation
let mouseX = 400;
let mouseY = 300;

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const { selectedWorkspaceId, selectWorkspace, setActivePanel, positionEditWorkspaceId, setPositionEditWorkspace } = useUIStore();
  const { workspaces } = useWorkspacesStore();
  const { agents } = useAgentsStore();

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = document.querySelector('[data-canvas]');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // But allow Escape to blur
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      const workspaceIds = Object.keys(workspaces);
      const selectedWorkspace = selectedWorkspaceId ? workspaces[selectedWorkspaceId] : null;
      const agent = selectedWorkspace?.agentId ? agents[selectedWorkspace.agentId] : null;

      switch (e.key.toLowerCase()) {
        // N or Space = New workspace at mouse position
        case 'n':
        case ' ':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handlers.onCreateWorkspace?.(mouseX, mouseY);
          }
          break;

        // R = Run task on selected workspace
        case 'r':
          if (selectedWorkspaceId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handlers.onRunTask?.(selectedWorkspaceId);
          }
          break;

        // S = Stop task on selected workspace
        case 's':
          if (!e.metaKey && !e.ctrlKey && agent && !['idle', 'success', 'error'].includes(agent.state)) {
            e.preventDefault();
            handlers.onStopTask?.(agent.id);
          }
          break;

        // Delete or Backspace = Delete selected workspace
        case 'delete':
        case 'backspace':
          if (selectedWorkspaceId) {
            e.preventDefault();
            handlers.onDelete?.(selectedWorkspaceId);
          }
          break;

        // C = Start connection from selected workspace
        case 'c':
          if (selectedWorkspaceId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handlers.onStartConnect?.(selectedWorkspaceId);
          }
          break;

        // Enter or T = Focus task input for selected workspace
        case 'enter':
        case 't':
          if (selectedWorkspaceId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handlers.onFocusTaskInput?.(selectedWorkspaceId);
          }
          break;

        // Escape = Exit position edit mode or deselect
        case 'escape':
          if (positionEditWorkspaceId) {
            e.preventDefault();
            setPositionEditWorkspace(null);
          } else {
            selectWorkspace(null);
          }
          break;

        // 1-9 = Select workspace by index
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          if (!e.metaKey && !e.ctrlKey) {
            const index = parseInt(e.key) - 1;
            if (index < workspaceIds.length) {
              e.preventDefault();
              selectWorkspace(workspaceIds[index]);
            }
          }
          break;

        // Tab = Cycle through workspaces
        case 'tab':
          if (workspaceIds.length > 0) {
            e.preventDefault();
            const currentIndex = selectedWorkspaceId
              ? workspaceIds.indexOf(selectedWorkspaceId)
              : -1;
            const nextIndex = e.shiftKey
              ? (currentIndex - 1 + workspaceIds.length) % workspaceIds.length
              : (currentIndex + 1) % workspaceIds.length;
            selectWorkspace(workspaceIds[nextIndex]);
          }
          break;

        // L = Toggle logs panel
        case 'l':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setActivePanel('logs');
          }
          break;

        // M = Toggle position edit mode for selected workspace
        case 'm':
          if (selectedWorkspaceId && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            if (positionEditWorkspaceId === selectedWorkspaceId) {
              setPositionEditWorkspace(null);
            } else {
              setPositionEditWorkspace(selectedWorkspaceId);
            }
          }
          break;
      }
    },
    [selectedWorkspaceId, workspaces, agents, handlers, selectWorkspace, setActivePanel, positionEditWorkspaceId, setPositionEditWorkspace]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Export mouse position getter
export function getMousePosition() {
  return { x: mouseX, y: mouseY };
}
