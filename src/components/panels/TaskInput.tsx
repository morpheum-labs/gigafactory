import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../stores/ui';
import { useWorkspacesStore } from '../../stores/workspaces';
import { useAgentsStore } from '../../stores/agents';
import { useSkillsStore } from '../../stores/skills';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { Button } from '../common/Button';

export function TaskInput() {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { selectedWorkspaceId, cliAvailable, cursorCliAvailable, kiloCliAvailable, geminiCliAvailable, grokCliAvailable, deepseekCliAvailable, kimiCliAvailable } = useUIStore();
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const agents = useAgentsStore((s) => s.agents);
  const { skills, loadSkills } = useSkillsStore();
  const { startTask, stopTask } = useAgentCommands();

  const workspace = selectedWorkspaceId ? workspaces[selectedWorkspaceId] : null;
  const agent = workspace?.agentId ? agents[workspace.agentId] : null;
  const isAgentBusy = agent && !['idle', 'success', 'error'].includes(agent.state);

  // Load skills on mount
  useEffect(() => {
    loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autofocus the textarea when workspace is selected or app loads
  useEffect(() => {
    if (selectedWorkspaceId && textareaRef.current && !isAgentBusy) {
      textareaRef.current.focus();
    }
  }, [selectedWorkspaceId, isAgentBusy]);

  // Also focus on initial mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (!selectedWorkspaceId || !prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // If a skill is selected, prefix the prompt with the skill command
      const finalPrompt = selectedSkill
        ? `/${selectedSkill} ${prompt.trim()}`
        : prompt.trim();

      await startTask(selectedWorkspaceId, finalPrompt);
      setPrompt('');
      setSelectedSkill(null);
    } catch (error) {
      console.error('Failed to start task:', error);
      // Error is already handled by startTask which sets status message
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = async () => {
    if (!agent) return;
    await stopTask(agent.id);
  };

  return (
    <div className="p-4 border-t border-canvas-border bg-gray-900/50">
      {selectedWorkspaceId && (() => {
        const cliType = workspace?.cli ?? 'claude';
        const useCursor = cliType === 'cursor';
        const useKilo = cliType === 'kilo';
        const useGemini = cliType === 'gemini';
        const useGrok = cliType === 'grok';
        const useDeepseek = cliType === 'deepseek';
        const useKimi = cliType === 'kimi';
        const ok = useCursor ? cursorCliAvailable : useKilo ? kiloCliAvailable : useGemini ? geminiCliAvailable : useGrok ? grokCliAvailable : useDeepseek ? deepseekCliAvailable : useKimi ? kimiCliAvailable : cliAvailable;
        // Only hide warning if CLI is confirmed available (true) or all checks are still pending (null)
        if (ok === true || (cliAvailable === null && cursorCliAvailable === null && kiloCliAvailable === null && geminiCliAvailable === null && grokCliAvailable === null && deepseekCliAvailable === null && kimiCliAvailable === null)) return null;
        return (
          <div className="mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
            {useCursor
              ? 'Cursor CLI (agent) not found. Install: curl https://cursor.com/install -fsS | bash'
              : useKilo
              ? 'Kilo CLI (kilo) not found. Install: npm install -g @kilocode/cli'
              : useGemini
              ? 'Gemini CLI (gemini) not found. Install: npm install -g @google/gemini-cli'
              : useGrok
              ? 'Grok CLI (grok) not found. Install: bun add -g @vibe-kit/grok-cli or npm install -g @vibe-kit/grok-cli'
              : useDeepseek
              ? 'DeepSeek CLI (deepseek) not found. Install: Build from Go source - make gosrc-build && make goinstall (see https://github.com/morpheum-labs/deepseek-cli)'
              : useKimi
              ? 'Kimi CLI (kimi) not found. Install: npm install -g @moonshot-ai/kimi-cli'
              : 'Claude CLI not found. Install it first.'}
          </div>
        );
      })()}

      {!selectedWorkspaceId ? (
        <p className="text-sm text-gray-500 text-center py-3">
          Select a workspace to assign a task
        </p>
      ) : isAgentBusy ? (
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <p className="text-sm text-gray-400 mb-1">Agent is working...</p>
            <p className="text-sm text-gray-300 truncate">{agent?.task}</p>
          </div>
          <Button variant="danger" size="sm" onClick={handleStop}>
            Stop
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Skill selector */}
          {skills.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Skill:</span>
                <select
                  value={selectedSkill || ''}
                  onChange={(e) => setSelectedSkill(e.target.value || null)}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">None (direct prompt)</option>
                  {skills.map((skill) => (
                    <option key={skill.name} value={skill.name}>
                      🔧 {skill.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedSkill && (
                <p className="text-xs text-blue-400 mt-1">
                  Will run: /{selectedSkill} [your prompt]
                </p>
              )}
            </div>
          )}

          <div className="flex space-x-2">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={selectedSkill ? `Enter arguments for /${selectedSkill}...` : 'Enter a task for Claude...'}
              className="
                flex-1 px-4 py-3 min-h-[80px] max-h-[150px]
                bg-gray-800 border border-gray-700 rounded
                text-gray-100 text-base
                placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                resize-y
              "
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-gray-500">
              {prompt.length > 0 ? `${prompt.length} chars` : 'Cmd+Enter to submit'}
            </span>
            <Button
              type="submit"
              disabled={
                !prompt.trim() ||
                isSubmitting ||
                (workspace?.cli === 'cursor'
                  ? !cursorCliAvailable
                  : workspace?.cli === 'kilo'
                  ? !kiloCliAvailable
                  : workspace?.cli === 'gemini'
                  ? !geminiCliAvailable
                  : workspace?.cli === 'grok'
                  ? !grokCliAvailable
                  : workspace?.cli === 'deepseek'
                  ? !deepseekCliAvailable
                  : workspace?.cli === 'kimi'
                  ? !kimiCliAvailable
                  : !cliAvailable)
              }
              size="sm"
            >
              {isSubmitting ? 'Starting...' : 'Run Task'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
