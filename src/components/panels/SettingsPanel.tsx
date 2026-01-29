import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../stores/settings';
import { useConfigStore } from '../../stores/config';
import { useUIStore } from '../../stores/ui';
import { useWorkspacesStore } from '../../stores/workspaces';
import { useViewportStore } from '../../stores/viewport';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { api } from '../../utils/api';
import { buildProjectExport, downloadProjectExport } from '../../utils/projectExport';
import type { CliType } from '../../types/workspace';

const AGENT_CLIS: { id: CliType; label: string; icon: string }[] = [
  { id: 'claude', label: 'Claude', icon: '🤖' },
  { id: 'cursor', label: 'Cursor', icon: '🖱️' },
  { id: 'kilo', label: 'Kilo', icon: '⚡' },
  { id: 'gemini', label: 'Gemini', icon: '💎' },
  { id: 'grok', label: 'Grok', icon: '🚀' },
  { id: 'deepseek', label: 'DeepSeek', icon: '🔍' },
  { id: 'kimi', label: 'Kimi', icon: '🌙' },
  { id: 'qwen', label: 'Qwen', icon: '🌟' },
];

export function SettingsPanel() {
  const { settings, setSettings, cliAvailability, setCliAvailability } = useSettingsStore();
  const { config, loadConfig, saveConfig } = useConfigStore();
  const { settingsPanelOpen, toggleSettingsPanel } = useUIStore();
  const workspaces = useWorkspacesStore((state) => state.workspaces);
  const viewportState = useViewportStore((state) => state.viewportState);
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [checkingClis, setCheckingClis] = useState(false);
  const [configPaths, setConfigPaths] = useState({ skillsPath: '', workspaceDirectory: '' });
  const [savingConfig, setSavingConfig] = useState(false);
  const [exporting, setExporting] = useState(false);

  const checkCliAvailability = useCallback(async () => {
    setCheckingClis(true);
    try {
      const availability = await api.checkAllClisAvailable();
      setCliAvailability(availability);
    } catch (error) {
      console.error('Failed to check CLI availability:', error);
      setCliAvailability({});
    } finally {
      setCheckingClis(false);
    }
  }, [setCliAvailability]);

  useEffect(() => {
    if (settingsPanelOpen) {
      setLocalSettings(settings);
      setHasChanges(false);
      // Load config from API when panel opens
      loadConfig();
      // Check CLI availability when panel opens
      checkCliAvailability();
    }
  }, [settingsPanelOpen, settings, loadConfig, checkCliAvailability]);

  // Update local config paths when API config loads
  useEffect(() => {
    if (config) {
      setConfigPaths({
        skillsPath: config.skills_path || '',
        workspaceDirectory: config.workspace_directory || '',
      });
    }
  }, [config]);

  const handleChange = (key: keyof typeof localSettings, value: string | boolean) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleAgent = (cliId: CliType) => {
    const key = `agentEnabled_${cliId}` as keyof typeof localSettings;
    const currentValue = localSettings[key] as boolean ?? true;
    handleChange(key, !currentValue);
  };

  const handleSave = async () => {
    // Save agent selections to local settings
    setSettings(localSettings);
    setHasChanges(false);
    
    // Save config paths to API
    if (configPaths.skillsPath || configPaths.workspaceDirectory) {
      setSavingConfig(true);
      try {
        await saveConfig({
          skills_path: configPaths.skillsPath,
          workspace_directory: configPaths.workspaceDirectory || null,
        });
      } catch (error) {
        console.error('Failed to save config:', error);
        // Could show an error message here
      } finally {
        setSavingConfig(false);
      }
    }
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    // Reset config paths to current API config
    if (config) {
      setConfigPaths({
        skillsPath: config.skills_path || '',
        workspaceDirectory: config.workspace_directory || '',
      });
    }
    setHasChanges(false);
    toggleSettingsPanel();
  };

  const handleExportProject = () => {
    setExporting(true);
    try {
      const payload = buildProjectExport({
        config,
        settings,
        workspaces,
        viewport: viewportState,
      });
      downloadProjectExport(payload);
    } finally {
      setExporting(false);
    }
  };

  if (!settingsPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={toggleSettingsPanel}
      />
      
      {/* Settings Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[80%] max-w-4xl
          bg-canvas-surface border-l border-canvas-border
          shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${settingsPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-canvas-border">
          <h2 className="text-xl font-semibold text-gray-200">Settings</h2>
          <button
            onClick={toggleSettingsPanel}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6 max-w-2xl">
            {/* Agent Selections Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-200 mb-4">Agent Selections</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-400 mb-3">
                  Toggle the availability of each agent CLI. Disabled agents will not appear in the agent selection.
                </p>
                {checkingClis && (
                  <p className="text-sm text-gray-500 mb-3">Checking CLI availability...</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {AGENT_CLIS.map((agent) => {
                  const isAvailable = cliAvailability[agent.id] ?? false;
                  const isEnabled = (localSettings[`agentEnabled_${agent.id}` as keyof typeof localSettings] as boolean) ?? true;
                  
                  return (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      disabled={!isAvailable}
                      className={`
                        flex items-center justify-between px-4 py-3 rounded-lg border
                        transition-all duration-150
                        ${
                          !isAvailable
                            ? 'border-gray-700 bg-gray-800/30 text-gray-600 cursor-not-allowed opacity-50'
                            : isEnabled
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                            : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 hover:border-gray-600'
                        }
                      `}
                      title={
                        !isAvailable
                          ? `${agent.label} CLI not detected on system`
                          : isEnabled
                          ? `Click to disable ${agent.label}`
                          : `Click to enable ${agent.label}`
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{agent.icon}</span>
                        <span className="font-medium">{agent.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!isAvailable && (
                          <span className="text-xs text-gray-500">Not detected</span>
                        )}
                        {isAvailable && (
                          <span className={`text-xs ${isEnabled ? 'text-blue-400' : 'text-gray-500'}`}>
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                        {isAvailable && (
                          <div
                            className={`
                              w-10 h-5 rounded-full transition-colors duration-200
                              ${isEnabled ? 'bg-blue-500' : 'bg-gray-700'}
                            `}
                          >
                            <div
                              className={`
                                w-4 h-4 rounded-full bg-white mt-0.5 transition-transform duration-200
                                ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                              `}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuration Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-200 mb-4">Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <Input
                    label="Skills Directory Path"
                    type="text"
                    value={configPaths.skillsPath}
                    onChange={(e) => {
                      setConfigPaths((prev) => ({ ...prev, skillsPath: e.target.value }));
                      setHasChanges(true);
                    }}
                    placeholder="~/.claude/skills"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter the path where your skills are stored. You can use{' '}
                    <code className="bg-gray-800 px-1 rounded">~</code> for your home directory.
                  </p>
                </div>

                <div>
                  <Input
                    label="Workspace Directory Path"
                    type="text"
                    value={configPaths.workspaceDirectory}
                    onChange={(e) => {
                      setConfigPaths((prev) => ({ ...prev, workspaceDirectory: e.target.value }));
                      setHasChanges(true);
                    }}
                    placeholder="~/projects/my-workspace"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Enter the root directory path for your workspace. All file operations will be
                    scoped to this directory. You can use{' '}
                    <code className="bg-gray-800 px-1 rounded">~</code> for your home directory.
                  </p>
                </div>
              </div>
            </div>

            {/* Project Section: Import / Export */}
            <div>
              <h3 className="text-lg font-medium text-gray-200 mb-4">Project</h3>
              <p className="text-sm text-gray-400 mb-4">
                Export or import the full project: paths, workspaces, positions, connections, CLI/model options, prompts, skills path, system prompts, and viewport — everything needed to restore the workspace layout.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={handleExportProject}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting...' : 'Export project'}
                </Button>
                <span className="text-sm text-gray-500 self-center">
                  Saves a JSON file with all project data.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-canvas-border">
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!hasChanges || savingConfig}>
            {savingConfig ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
