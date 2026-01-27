import { useState } from 'react';
import { useWorkspacesStore } from '../../stores/workspaces';
import { useAgentsStore } from '../../stores/agents';
import { useUIStore } from '../../stores/ui';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { WORKSPACE_EMOJIS } from '../../utils/emoji';
import { AGENT_EMOJIS } from '../../utils/emoji';
import { AVAILABLE_MODELS, ModelId, CliType } from '../../types/workspace';

const WORKFLOW_SECTION_STYLE = "mb-5 p-4 bg-gray-800/50 rounded-lg border border-gray-700";

export function WorkspacePanel() {
  const { selectedWorkspaceId, selectAgent, showOutputModal, positionEditWorkspaceId, setPositionEditWorkspace } = useUIStore();
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const {
    renameWorkspace,
    setSystemPrompt,
    setModel,
    setCli,
    setMode,
    setTaskTemplate,
    setAutoRun,
    connectWorkspaces,
    disconnectWorkspaces,
  } = useWorkspacesStore();
  const agents = useAgentsStore((s) => s.agents);
  const { deleteWorkspace } = useAgentCommands();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState('');

  const workspace = selectedWorkspaceId ? workspaces[selectedWorkspaceId] : null;
  const agent = workspace?.agentId ? agents[workspace.agentId] : null;

  if (!workspace) {
    return (
      <div className="p-5 text-center text-gray-500">
        <p className="text-3xl mb-3">🖥️</p>
        <p className="text-base">No workspace selected</p>
        <p className="text-sm mt-2">Select a workspace from the list or canvas</p>
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditName(workspace.name);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim()) {
      renameWorkspace(workspace.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this workspace? Any running task will be stopped.')) {
      await deleteWorkspace(workspace.id);
    }
  };

  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        {isEditing ? (
          <div className="flex-1 flex items-center space-x-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              autoFocus
              className="text-base"
            />
            <Button size="sm" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-medium text-gray-200 flex items-center">
              <span className="mr-2 text-2xl">{WORKSPACE_EMOJIS[workspace.state]}</span>
              {workspace.name}
            </h3>
            <Button size="sm" variant="ghost" onClick={handleStartEdit}>
              Edit
            </Button>
          </>
        )}
      </div>

      {/* Status */}
      <div className="mb-5">
        <Badge variant={workspace.state}>
          {workspace.state}
        </Badge>
      </div>

      {/* Dimensions */}
      <div className="mb-5 text-base text-gray-400">
        <div className="flex items-center justify-between mb-2">
          <p>
            Position: ({Math.round(workspace.x)}, {Math.round(workspace.y)})
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (positionEditWorkspaceId === workspace.id) {
                setPositionEditWorkspace(null);
              } else {
                setPositionEditWorkspace(workspace.id);
              }
            }}
            className={positionEditWorkspaceId === workspace.id ? 'bg-blue-600 hover:bg-blue-500' : ''}
          >
            {positionEditWorkspaceId === workspace.id ? 'Done' : 'Edit'}
          </Button>
        </div>
        <p>
          Size: {Math.round(workspace.width)} × {Math.round(workspace.height)}px
        </p>
        {positionEditWorkspaceId === workspace.id && (
          <p className="text-xs text-blue-400 mt-2">
            Click and drag the workspace box on the canvas to move it
          </p>
        )}
      </div>

      {/* CLI & Model */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          CLI
        </label>
        <select
          value={workspace.cli ?? 'claude'}
          onChange={(e) => setCli(workspace.id, e.target.value as CliType)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-base text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="claude">Claude (claude)</option>
          <option value="cursor">Cursor Agent (agent)</option>
          <option value="kilo">Kilo Code (kilo)</option>
          <option value="gemini">Gemini CLI (gemini)</option>
          <option value="grok">Grok CLI (grok)</option>
          <option value="deepseek">DeepSeek CLI (deepseek)</option>
        </select>
      </div>

      {(workspace.cli ?? 'claude') === 'cursor' && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Cursor mode
          </label>
          <select
            value={workspace.mode ?? 'agent'}
            onChange={(e) => setMode(workspace.id, e.target.value || null)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-base text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="agent">Agent (default)</option>
            <option value="plan">Plan</option>
            <option value="ask">Ask</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Agent: full tools. Plan: design first. Ask: read-only.</p>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Model
        </label>
        <select
          value={workspace.model}
          onChange={(e) => setModel(workspace.id, e.target.value as ModelId)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-base text-white focus:border-blue-500 focus:outline-none"
        >
          {AVAILABLE_MODELS
            .filter((model) => {
              // If model has cli filter, only show for matching CLI
              if (model.cli) {
                return model.cli.includes(workspace.cli ?? 'claude');
              }
              // Otherwise show for all CLIs (backward compatibility)
              return true;
            })
            .map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
        </select>
        {workspace.cli === 'deepseek' && (
          <p className="text-xs text-gray-500 mt-1">
            Available models: deepseek-chat, deepseek-reasoner. See{' '}
            <a 
              href="https://api-docs.deepseek.com/api/list-models" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              DeepSeek API docs
            </a>
          </p>
        )}
      </div>

      {/* System Prompt */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-400">
            System Prompt
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!showSystemPrompt) {
                setEditingPrompt(workspace.systemPrompt || '');
              }
              setShowSystemPrompt(!showSystemPrompt);
            }}
          >
            {showSystemPrompt ? 'Hide' : workspace.systemPrompt ? 'Edit' : 'Add'}
          </Button>
        </div>
        {showSystemPrompt ? (
          <div className="space-y-3">
            <textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              placeholder="Give your agent a personality or specific instructions..."
              className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-3 text-base text-white focus:border-blue-500 focus:outline-none resize-none"
              rows={4}
            />
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => {
                  setSystemPrompt(workspace.id, editingPrompt || null);
                  setShowSystemPrompt(false);
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSystemPrompt(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : workspace.systemPrompt ? (
          <p className="text-sm text-gray-500 italic truncate">
            "{workspace.systemPrompt.slice(0, 50)}..."
          </p>
        ) : (
          <p className="text-sm text-gray-600">No system prompt set</p>
        )}
      </div>

      {/* Desk Clutter indicator */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
          <span>Desk Clutter</span>
          <span>{workspace.messiness}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-600 transition-all duration-500"
            style={{ width: `${workspace.messiness}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Accumulates as tasks complete</p>
      </div>

      {/* Workflow Section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-400 flex items-center">
            <span className="mr-2">🔗</span> Workflow
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!showWorkflow) {
                setEditingTemplate(workspace.taskTemplate || '');
              }
              setShowWorkflow(!showWorkflow);
            }}
          >
            {showWorkflow ? 'Hide' : 'Configure'}
          </Button>
        </div>

        {/* Connection badges */}
        {(workspace.inputConnections?.length > 0 || workspace.outputConnections?.length > 0) && !showWorkflow && (
          <div className="flex flex-wrap gap-2 mt-2">
            {workspace.inputConnections?.map((inputId) => (
              <span key={inputId} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                ← {workspaces[inputId]?.name || 'Unknown'}
              </span>
            ))}
            {workspace.outputConnections?.map((outputId) => (
              <span key={outputId} className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                → {workspaces[outputId]?.name || 'Unknown'}
              </span>
            ))}
          </div>
        )}

        {showWorkflow && (
          <div className={WORKFLOW_SECTION_STYLE}>
            {/* Task Template */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Task Template
              </label>
              <textarea
                value={editingTemplate}
                onChange={(e) => setEditingTemplate(e.target.value)}
                placeholder="Define a task template. Use {{input}} to reference data from connected workspaces..."
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-none"
                rows={3}
              />
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  setTaskTemplate(workspace.id, editingTemplate || null);
                }}
              >
                Save Template
              </Button>
            </div>

            {/* Auto-run toggle */}
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={workspace.autoRun || false}
                  onChange={(e) => setAutoRun(workspace.id, e.target.checked)}
                  className="mr-2 w-4 h-4"
                />
                <span className="text-sm text-gray-300">Auto-run when inputs complete</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Automatically start this task when all connected input workspaces finish
              </p>
            </div>

            {/* Input Connections */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Input From (receives data)
              </label>
              <div className="space-y-2">
                {workspace.inputConnections?.map((inputId) => (
                  <div key={inputId} className="flex items-center justify-between bg-gray-900 rounded px-3 py-2">
                    <span className="text-sm text-white">← {workspaces[inputId]?.name || 'Unknown'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disconnectWorkspaces(inputId, workspace.id)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <select
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      connectWorkspaces(e.target.value, workspace.id);
                    }
                  }}
                >
                  <option value="">+ Add input connection...</option>
                  {Object.values(workspaces)
                    .filter((ws) => ws.id !== workspace.id && !workspace.inputConnections?.includes(ws.id))
                    .map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Output Connections */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Output To (sends data)
              </label>
              <div className="space-y-2">
                {workspace.outputConnections?.map((outputId) => (
                  <div key={outputId} className="flex items-center justify-between bg-gray-900 rounded px-3 py-2">
                    <span className="text-sm text-white">→ {workspaces[outputId]?.name || 'Unknown'}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disconnectWorkspaces(workspace.id, outputId)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <select
                  className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      connectWorkspaces(workspace.id, e.target.value);
                    }
                  }}
                >
                  <option value="">+ Add output connection...</option>
                  {Object.values(workspaces)
                    .filter((ws) => ws.id !== workspace.id && !workspace.outputConnections?.includes(ws.id))
                    .map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Last Output Preview */}
            {workspace.lastOutput && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Last Output (available to connected workspaces)
                </label>
                <div className="bg-gray-900 rounded p-3 text-xs text-gray-300 max-h-24 overflow-auto">
                  {workspace.lastOutput.slice(0, 300)}
                  {workspace.lastOutput.length > 300 && '...'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent info */}
      {agent && (
        <div className="mb-5 p-4 bg-gray-800 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-medium text-gray-200">
              <span className="text-xl mr-2">{AGENT_EMOJIS[agent.state]}</span>
              Agent
            </span>
            <Badge variant={agent.state}>{agent.state}</Badge>
          </div>

          {agent.task && (
            <p className="text-sm text-gray-400 mb-3 truncate">Task: {agent.task}</p>
          )}

          {agent.progress > 0 && agent.progress < 100 && (
            <ProgressBar progress={agent.progress} size="md" />
          )}

          <div className="flex space-x-3 mt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => selectAgent(agent.id)}
            >
              View Details →
            </Button>
            {(agent.state === 'success' || agent.state === 'error') && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => showOutputModal(agent.id)}
              >
                📄 Output
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pt-5 border-t border-gray-700">
        <Button variant="danger" size="md" onClick={handleDelete} className="w-full">
          Delete Workspace
        </Button>
      </div>
    </div>
  );
}
