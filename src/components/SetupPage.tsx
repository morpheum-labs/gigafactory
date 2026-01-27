import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/config';
import { Button } from './common/Button';
import { Input } from './common/Input';

export function SetupPage() {
  const { config, loading, error, saveConfig, loadConfig } = useConfigStore();
  const [skillsPath, setSkillsPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (config) {
      setSkillsPath(config.skills_path);
    } else {
      // Default path if no config
      setSkillsPath('~/.claude/skills');
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      await saveConfig({ skills_path: skillsPath });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
      setSaving(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-canvas-bg">
        <div className="text-center">
          <div className="animate-pulse text-gray-400 mb-4">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-canvas-bg">
      <div className="w-full max-w-2xl p-8">
        <div className="bg-canvas-surface border border-canvas-border rounded-lg p-8 shadow-xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Giga Factory</h1>
            <p className="text-gray-400">
              Let's set up your configuration. You can change these settings later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="skills-path" className="block text-sm font-medium text-gray-300 mb-2">
                Skills Directory Path
              </label>
              <Input
                id="skills-path"
                type="text"
                value={skillsPath}
                onChange={(e) => setSkillsPath(e.target.value)}
                placeholder="~/.claude/skills"
                required
                className="w-full"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the path where your skills are stored. You can use <code className="bg-gray-800 px-1 rounded">~</code> for your home directory.
              </p>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {saveError && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                {saveError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={saving || !skillsPath.trim()}
                variant="primary"
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
