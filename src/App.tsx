import { useEffect, useState } from 'react';
import { CanvasRoot } from './canvas/CanvasRoot';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { OutputModal } from './components/OutputModal';
import { SetupPage } from './components/SetupPage';
import { SettingsPanel } from './components/panels/SettingsPanel';
import { useAgentEvents } from './hooks/useAgentEvents';
import { useAgentCommands } from './hooks/useAgentCommands';
import { useUIStore } from './stores/ui';
import { useConfigStore } from './stores/config';
import { useSettingsStore } from './stores/settings';

function App() {
  const { setCliAvailable, setCursorCliAvailable, setKiloCliAvailable, setGeminiCliAvailable, setGrokCliAvailable, setDeepseekCliAvailable, setStatusMessage } = useUIStore();
  const { checkAllClisAvailable } = useAgentCommands();
  const { config, loadConfig, isConfigured } = useConfigStore();
  const { setCliAvailability } = useSettingsStore();
  const [showSetup, setShowSetup] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Load config on mount
  useEffect(() => {
    const checkConfig = async () => {
      try {
        await loadConfig();
        // After loading, check if config is valid
        // The config will be updated in the store, so we check it in the next effect
      } catch (error) {
        // If config loading fails, show setup
        console.error('Failed to load config:', error);
      } finally {
        setCheckingConfig(false);
      }
    };
    checkConfig();
  }, [loadConfig]);

  // Show setup if config is not configured or skills_path or workspace_directory is empty
  useEffect(() => {
    if (!checkingConfig) {
      if (!isConfigured || !config?.skills_path || config.skills_path.trim() === '' || !config?.workspace_directory || config.workspace_directory.trim() === '') {
        setShowSetup(true);
      } else {
        setShowSetup(false);
      }
    }
  }, [config, isConfigured, checkingConfig]);

  // Set up event listeners
  useAgentEvents();

  // Check if Claude, Cursor, Kilo, Gemini, Grok, and DeepSeek CLIs are available on mount
  useEffect(() => {
    const check = async () => {
      setStatusMessage('Checking CLIs...');
      const clis = await checkAllClisAvailable();
      const claude = clis.claude ?? false;
      const cursor = clis.cursor ?? false;
      const kilo = clis.kilo ?? false;
      const gemini = clis.gemini ?? false;
      const grok = clis.grok ?? false;
      const deepseek = clis.deepseek ?? false;
      
      // Store CLI availability in settings store for global access
      setCliAvailability(clis);
      
      // Set individual CLI availability states (for UI store/StatusBar)
      setCursorCliAvailable(cursor);
      setKiloCliAvailable(kilo);
      setGeminiCliAvailable(gemini);
      setGrokCliAvailable(grok);
      setDeepseekCliAvailable(deepseek);
      
      // Set cliAvailable to true if ANY CLI is available (for StatusBar)
      const anyCliAvailable = claude || cursor || kilo || gemini || grok || deepseek;
      setCliAvailable(anyCliAvailable);
      
      const which = [claude && 'Claude', cursor && 'Cursor', kilo && 'Kilo', gemini && 'Gemini', grok && 'Grok', deepseek && 'DeepSeek'].filter(Boolean).join(', ') || 'none';
      setStatusMessage(which !== 'none' ? 'Ready' : 'No CLI found (Claude, Cursor, Kilo, Gemini, Grok, or DeepSeek)');
    };
    check();
  }, [
    checkAllClisAvailable,
    setCliAvailability,
    setCliAvailable,
    setCursorCliAvailable,
    setKiloCliAvailable,
    setGeminiCliAvailable,
    setGrokCliAvailable,
    setDeepseekCliAvailable,
    setStatusMessage,
  ]);

  // Show setup page if needed
  if (checkingConfig || showSetup) {
    return <SetupPage />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas-bg text-gray-100">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <CanvasRoot />

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Modals */}
      <OutputModal />

      {/* Settings Panel */}
      <SettingsPanel />
    </div>
  );
}

export default App;
