/**
 * Context Menu - Right-click menu for node actions
 * Supports: Edit, Delete, Simulate Phase, Export, etc.
 */

import { useEffect, useRef } from 'react';
import { useWorkspacesStore } from '../../stores/workspaces';
import { useUIStore } from '../../stores/ui';
import { useAgentCommands } from '../../hooks/useAgentCommands';

interface ContextMenuProps {
  workspaceId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ workspaceId, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { removeWorkspace } = useWorkspacesStore();
  const { setEditingWorkspace, setPositionEditWorkspace } = useUIStore();
  const { startTask } = useAgentCommands();
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const workspace = workspaces[workspaceId];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!workspace) return null;

  const handleEdit = () => {
    setEditingWorkspace(workspaceId);
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Delete this workspace?')) {
      removeWorkspace(workspaceId);
      onClose();
    }
  };

  const handleSimulate = async () => {
    if (workspace.taskTemplate) {
      await startTask(workspaceId, workspace.taskTemplate, { useWorkflowInputs: true });
    }
    onClose();
  };

  const handlePositionEdit = () => {
    setPositionEditWorkspace(workspaceId);
    onClose();
  };

  // Ensure menu stays within viewport
  const menuWidth = 180;
  const menuHeight = 200; // Approximate
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[180px]"
      style={{ left: `${Math.max(10, adjustedX)}px`, top: `${Math.max(10, adjustedY)}px` }}
    >
      <button
        onClick={handleEdit}
        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        ✏️ Edit Properties
      </button>
      <button
        onClick={handlePositionEdit}
        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        📍 Edit Position
      </button>
      {workspace.taskTemplate && (
        <button
          onClick={handleSimulate}
          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          ▶️ Simulate Phase
        </button>
      )}
      <div className="border-t border-gray-700 my-1" />
      <button
        onClick={handleDelete}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
      >
        🗑️ Delete
      </button>
    </div>
  );
}
