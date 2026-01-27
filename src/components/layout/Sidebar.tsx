import { useUIStore, type ActivePanel } from '../../stores/ui';
import { WorkspaceList } from '../panels/WorkspaceList';
import { WorkspacePanel } from '../panels/WorkspacePanel';
import { AgentDetail } from '../panels/AgentDetail';
import { LogViewer } from '../panels/LogViewer';
import { SkillsPanel } from '../panels/SkillsPanel';
import { TaskInput } from '../panels/TaskInput';

const PANEL_TABS: { id: ActivePanel; label: string; icon: string }[] = [
  { id: 'list', label: 'List', icon: '📋' },
  { id: 'workspace', label: 'Workspace', icon: '🖥️' },
  { id: 'agent', label: 'Agent', icon: '🤖' },
  { id: 'skills', label: 'Skills', icon: '🔧' },
  { id: 'logs', label: 'Logs', icon: '📜' },
];

export function Sidebar() {
  const { activePanel, setActivePanel, sidebarCollapsed, toggleSidebar, toggleSettingsPanel } = useUIStore();

  if (sidebarCollapsed) {
    return (
      <div className="w-12 bg-canvas-surface border-l border-canvas-border flex flex-col items-center py-4">
        <button
          onClick={toggleSettingsPanel}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors mb-2"
          title="Open settings"
        >
          ⚙️
        </button>
        <button
          onClick={toggleSidebar}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Expand sidebar"
        >
          ◀
        </button>
        <div className="mt-4 space-y-2">
          {PANEL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActivePanel(tab.id);
                toggleSidebar();
              }}
              className={`p-2 rounded ${
                activePanel === tab.id ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-canvas-surface border-l border-canvas-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-canvas-border">
        <button
          onClick={toggleSettingsPanel}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title="Open settings"
        >
          ⚙️
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Collapse sidebar"
        >
          ▶
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-canvas-border">
        {PANEL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActivePanel(tab.id)}
            className={`
              flex-1 px-3 py-3 text-sm font-medium
              transition-colors duration-150
              ${
                activePanel === tab.id
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'list' && <WorkspaceList />}
        {activePanel === 'workspace' && <WorkspacePanel />}
        {activePanel === 'agent' && <AgentDetail />}
        {activePanel === 'skills' && <SkillsPanel />}
        {activePanel === 'logs' && <LogViewer />}
      </div>

      {/* Task input */}
      <TaskInput />
    </div>
  );
}
