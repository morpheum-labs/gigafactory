/**
 * Timeline Simulator - Scrubber UI for stepping through phases
 * Links to graph model for dependency-based execution
 */

import { useState } from 'react';

interface TimelineSimulatorProps {
  currentPhase: number;
  totalPhases: number;
  onPhaseChange: (phase: number) => void;
}

export function TimelineSimulator({ currentPhase, totalPhases, onPhaseChange }: TimelineSimulatorProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const phases = [
    { label: 'Q1 2026', name: 'Ingestion' },
    { label: 'Q2 2026', name: 'Stress Testing' },
    { label: 'Q3 2026', name: 'Production' },
    { label: 'Q4 2026', name: 'Optimization' },
    { label: '2027+', name: 'Autonomy' },
  ];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // Auto-advance logic would go here
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-lg p-4 z-50 min-w-[600px]">
      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white text-sm"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={totalPhases - 1}
            value={currentPhase}
            onChange={(e) => onPhaseChange(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            {phases.map((phase, idx) => (
              <span key={idx} className={idx === currentPhase ? 'text-blue-400 font-bold' : ''}>
                {phase.label}
              </span>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-300">
          Phase {currentPhase + 1}/{totalPhases}: {phases[currentPhase]?.name || 'Unknown'}
        </div>
      </div>
    </div>
  );
}
