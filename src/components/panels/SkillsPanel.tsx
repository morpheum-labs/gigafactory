import { useEffect } from 'react';
import { useSkillsStore } from '../../stores/skills';
import { useConfigStore } from '../../stores/config';
import { Button } from '../common/Button';

interface SkillsPanelProps {
  onSelectSkill?: (skillName: string) => void;
}

export function SkillsPanel({ onSelectSkill }: SkillsPanelProps) {
  const { skills, selectedSkill, loading, error, loadSkills, selectSkill, clearSelection } = useSkillsStore();
  const { config, loadConfig } = useConfigStore();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  if (loading) {
    return (
      <div className="p-5 text-center text-gray-500">
        <div className="animate-pulse">Loading skills...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-center">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <Button size="sm" onClick={() => loadSkills()}>
          Retry
        </Button>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="p-5 text-center text-gray-500">
        <p className="text-3xl mb-3">🔧</p>
        <p className="text-base">No skills found</p>
        <p className="text-sm mt-2 mb-4">
          Skills are stored in {config?.skills_path || '~/.claude/skills/'}
        </p>
        <Button size="sm" onClick={() => loadSkills()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    );
  }

  // Show skill detail if selected
  if (selectedSkill) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              ← Back
            </Button>
            {onSelectSkill && (
              <Button
                size="sm"
                onClick={() => onSelectSkill(selectedSkill.info.name)}
              >
                Use Skill
              </Button>
            )}
          </div>
          <h3 className="text-lg font-bold text-white flex items-center">
            <span className="mr-2 text-xl">🔧</span>
            {selectedSkill.info.name}
          </h3>
          <p className="text-sm text-gray-400 mt-1">{selectedSkill.info.description}</p>
        </div>

        {/* Markdown content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="bg-gray-800 p-4 rounded-lg text-sm overflow-auto whitespace-pre-wrap text-gray-300">
              {selectedSkill.markdown}
            </pre>
          </div>
        </div>

        {/* Path info */}
        <div className="p-3 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 truncate" title={selectedSkill.path}>
            📁 {selectedSkill.path}
          </p>
        </div>
      </div>
    );
  }

  // Show skill list
  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-base font-semibold text-gray-200">
          Available Skills ({skills.length})
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Click a skill to view details or use it
        </p>
      </div>

      {skills.map((skill) => (
        <button
          key={skill.name}
          onClick={() => selectSkill(skill.name)}
          className="w-full p-4 text-left border-b border-gray-700 hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-start">
            <span className="text-2xl mr-3">🔧</span>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-medium text-white">{skill.name}</h4>
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {skill.description}
              </p>
            </div>
            <span className="text-gray-500 ml-2">→</span>
          </div>
        </button>
      ))}
    </div>
  );
}
