/**
 * Advanced Node Editor - Side panel for editing workspace/node properties
 * Supports name, task, systemPrompt, model, messiness, size editing
 */

import { useState, useEffect } from 'react';
import { useWorkspacesStore } from '../../stores/workspaces';
import { useAvailableAndEnabledClis } from '../../stores/settings';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { AVAILABLE_MODELS, ModelId, CliType } from '../../types/workspace';

const CLI_LABELS: Record<CliType, string> = {
  claude: 'Claude (claude)',
  cursor: 'Cursor Agent (agent)',
  kilo: 'Kilo Code (kilo)',
  gemini: 'Gemini CLI (gemini)',
  grok: 'Grok CLI (grok)',
  deepseek: 'DeepSeek CLI (deepseek)',
  kimi: 'Kimi CLI (kimi)',
};

interface NodeEditorProps {
  workspaceId: string;
  onClose?: () => void;
}

export function NodeEditor({ workspaceId, onClose }: NodeEditorProps) {
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const {
    renameWorkspace,
    setSystemPrompt,
    setModel,
    setCli,
    setTaskTemplate,
    updateMessiness,
  } = useWorkspacesStore();
  const availableAndEnabledClis = useAvailableAndEnabledClis();

  const workspace = workspaces[workspaceId];
  if (!workspace) return null;
  // Always include the current workspace CLI even if not available/enabled, so user can see what's selected
  const currentCli = workspace.cli ?? 'claude';
  const clisToShow = availableAndEnabledClis.includes(currentCli as CliType)
    ? availableAndEnabledClis
    : [...availableAndEnabledClis, currentCli as CliType];

  const [name, setName] = useState(workspace.name);
  const [task, setTask] = useState(workspace.taskTemplate || '');
  const [systemPrompt, setSystemPromptLocal] = useState(workspace.systemPrompt || '');
  const [messiness, setMessiness] = useState(workspace.messiness);
  const [width, setWidth] = useState(workspace.width);
  const [height, setHeight] = useState(workspace.height);

  useEffect(() => {
    setName(workspace.name);
    setTask(workspace.taskTemplate || '');
    setSystemPromptLocal(workspace.systemPrompt || '');
    setMessiness(workspace.messiness);
    setWidth(workspace.width);
    setHeight(workspace.height);
  }, [workspace]);

  const handleSave = () => {
    if (name.trim()) renameWorkspace(workspaceId, name.trim());
    setTaskTemplate(workspaceId, task.trim() || null);
    setSystemPrompt(workspaceId, systemPrompt.trim() || null);
    updateMessiness(workspaceId, messiness);
    // Note: Size updates would need a new method in store
    onClose?.();
  };

  const availableModels = AVAILABLE_MODELS.filter(
    (m) => !m.cli || m.cli.includes(workspace.cli || 'claude')
  );

  return (
    <div className="p-4 space-y-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <h3 className="text-lg font-semibold text-white mb-4">Node Properties</h3>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Node name"
        />
      </div>

      {/* Task Template */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Task Template</label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What should this node do?"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm resize-none"
          rows={3}
        />
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPromptLocal(e.target.value)}
          placeholder="System instructions"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm resize-none"
          rows={2}
        />
      </div>

      {/* CLI Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">CLI</label>
        <select
          value={workspace.cli ?? 'claude'}
          onChange={(e) => setCli(workspaceId, e.target.value as CliType)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
        >
          {clisToShow.length > 0 ? (
            clisToShow.map((cli: CliType) => {
              const isAvailableAndEnabled = availableAndEnabledClis.includes(cli);
              return (
                <option key={cli} value={cli} disabled={!isAvailableAndEnabled}>
                  {CLI_LABELS[cli]}{!isAvailableAndEnabled ? ' (unavailable or disabled)' : ''}
                </option>
              );
            })
          ) : (
            <option value="claude">Claude (claude)</option>
          )}
        </select>
        {!availableAndEnabledClis.includes(currentCli as CliType) && availableAndEnabledClis.length > 0 && (
          <p className="mt-1 text-xs text-yellow-400">
            Current CLI is unavailable or disabled. Please select an available and enabled CLI from Settings.
          </p>
        )}
        {availableAndEnabledClis.length === 0 && (
          <p className="mt-1 text-xs text-yellow-400">
            No agents available and enabled. Check CLI availability and enable agents in Settings.
          </p>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Model</label>
        <select
          value={workspace.model}
          onChange={(e) => setModel(workspaceId, e.target.value as ModelId)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
        >
          {availableModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      {/* Messiness Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Messiness: {messiness}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={messiness}
          onChange={(e) => setMessiness(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Size Controls */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Width</label>
          <Input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            min={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Height</label>
          <Input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            min={200}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} className="flex-1">Save</Button>
        {onClose && <Button variant="ghost" onClick={onClose}>Cancel</Button>}
      </div>
    </div>
  );
}
