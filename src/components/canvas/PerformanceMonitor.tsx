/**
 * Performance Monitor Overlay - Shows FPS, node count, and rendering stats
 * Toggleable via hotkey (P key)
 */

import { useEffect, useState } from 'react';
import { useWorkspacesStore } from '../../stores/workspaces';

interface PerformanceMonitorProps {
  fps: number;
  visible: boolean;
}

export function PerformanceMonitor({ fps, visible }: PerformanceMonitorProps) {
  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const [stats, setStats] = useState({
    nodeCount: 0,
    connectionCount: 0,
    activeNodes: 0,
  });

  useEffect(() => {
    const nodeCount = Object.keys(workspaces).length;
    let connectionCount = 0;
    let activeNodes = 0;

    Object.values(workspaces).forEach((ws) => {
      connectionCount += (ws.outputConnections?.length || 0);
      if (ws.state === 'working') activeNodes++;
    });

    setStats({ nodeCount, connectionCount, activeNodes });
  }, [workspaces]);

  if (!visible) return null;

  const fpsColor = fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm border border-gray-700 rounded-lg p-3 text-xs font-mono z-50 pointer-events-none">
      <div className="space-y-1 text-gray-300">
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">FPS:</span>
          <span className={fpsColor}>{fps.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Nodes:</span>
          <span className="text-white">{stats.nodeCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Connections:</span>
          <span className="text-white">{stats.connectionCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-500">Active:</span>
          <span className="text-blue-400">{stats.activeNodes}</span>
        </div>
      </div>
    </div>
  );
}
