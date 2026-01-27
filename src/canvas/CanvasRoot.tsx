import { useCallback, useEffect, useRef, useState } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { useWorkspacesStore } from '../stores/workspaces';
import { useAgentsStore } from '../stores/agents';
import { useUIStore } from '../stores/ui';
import { useAgentCommands } from '../hooks/useAgentCommands';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { CANVAS_COLORS, WORKSPACE_COLORS } from '../utils/colors';
import { AGENT_EMOJIS, getRandomConfetti } from '../utils/emoji';
import { playSound } from '../utils/sounds';
import { MIN_WORKSPACE_SIZE } from '../types/workspace';

interface Particle {
  text: Text;
  vx: number;
  vy: number;
  rotationSpeed: number;
  alpha: number;
}

// Default workspace size for quick-create (larger than minimum for better UX)
const QUICK_CREATE_SIZE = Math.max(280, MIN_WORKSPACE_SIZE);

export function CanvasRoot() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const graphicsRef = useRef<Graphics | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const prevAgentStatesRef = useRef<Record<string, string>>({});
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const workspaces = useWorkspacesStore((s) => s.workspaces);
  const drawing = useWorkspacesStore((s) => s.drawing);
  const { startDrawing, updateDrawing, finishDrawing, addWorkspace, connectWorkspaces, renameWorkspace, removeWorkspace, setTaskTemplate, setAutoRun, updateWorkspacePosition } = useWorkspacesStore();
  const agents = useAgentsStore((s) => s.agents);
  const { selectedWorkspaceId, selectWorkspace, showOutputModal, editingWorkspaceId, setEditingWorkspace, positionEditWorkspaceId, wiring, startWiring, updateWiring, endWiring } = useUIStore();
  const { startTask, stopTask } = useAgentCommands();

  // Track which workspace has task input focused
  const [focusedTaskInput, setFocusedTaskInput] = useState<string | null>(null);
  const [taskInputValue, setTaskInputValue] = useState('');
  const [editingName, setEditingName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLTextAreaElement>(null);
  
  // Track dragging state for position editing
  const [draggingWorkspace, setDraggingWorkspace] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Quick-create workspace at position
  const quickCreateWorkspace = useCallback((x: number, y: number, autoConnect: boolean = true) => {
    // Center the workspace on the click position
    const wsX = x - QUICK_CREATE_SIZE / 2;
    const wsY = y - QUICK_CREATE_SIZE / 2;

    const id = addWorkspace({
      name: `Workspace ${Object.keys(workspaces).length + 1}`,
      x: Math.max(10, wsX),
      y: Math.max(10, wsY),
      width: QUICK_CREATE_SIZE,
      height: QUICK_CREATE_SIZE,
      state: 'empty',
      agentId: null,
      messiness: Math.floor(Math.random() * 30),
      systemPrompt: null,
      model: 'claude-sonnet-4-20250514',
    });

    // Auto-connect from selected workspace if exists
    if (autoConnect && selectedWorkspaceId) {
      connectWorkspaces(selectedWorkspaceId, id);
      // Auto-enable auto-run for the new workspace
      setAutoRun(id, true);
      playSound('connect');
    }

    playSound('create');
    selectWorkspace(id);
    // Go straight to task input, skip name editing
    setFocusedTaskInput(id);
    setTaskInputValue('');

    return id;
  }, [addWorkspace, selectedWorkspaceId, connectWorkspaces, setAutoRun, selectWorkspace, workspaces]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCreateWorkspace: (x, y) => {
      quickCreateWorkspace(x, y, true);
    },
    onRunTask: async (workspaceId) => {
      const ws = workspaces[workspaceId];
      if (ws?.taskTemplate) {
        playSound('start');
        await startTask(workspaceId, ws.taskTemplate, { useWorkflowInputs: true });
      } else {
        // Focus task input if no template
        setFocusedTaskInput(workspaceId);
        setTaskInputValue('');
      }
    },
    onStopTask: async (agentId) => {
      await stopTask(agentId);
    },
    onDelete: (workspaceId) => {
      playSound('delete');
      removeWorkspace(workspaceId);
      selectWorkspace(null);
    },
    onStartConnect: (workspaceId) => {
      const ws = workspaces[workspaceId];
      if (ws) {
        startWiring(workspaceId, 'output', ws.x + ws.width, ws.y + ws.height / 2);
        playSound('shortcut');
      }
    },
    onFocusTaskInput: (workspaceId) => {
      setFocusedTaskInput(workspaceId);
      setTaskInputValue(workspaces[workspaceId]?.taskTemplate || '');
      playSound('shortcut');
    },
  });

  // Initialize PixiJS
  useEffect(() => {
    mountedRef.current = true;

    if (!containerRef.current || initializedRef.current) return;

    const container = containerRef.current;

    const initApp = async () => {
      if (initializedRef.current || !mountedRef.current) return;
      initializedRef.current = true;

      const app = new Application();

      try {
        await app.init({
          background: CANVAS_COLORS.background,
          resizeTo: container,
          antialias: true,
        });

        if (!mountedRef.current) {
          app.destroy(true, { children: true });
          return;
        }

        container.appendChild(app.canvas);
        appRef.current = app;

        const graphics = new Graphics();
        app.stage.addChild(graphics);
        graphicsRef.current = graphics;

        app.ticker.add(() => {
          if (!mountedRef.current) return;
          renderCanvas();
          updateParticles();
        });
      } catch (error) {
        console.error('Failed to initialize PixiJS:', error);
        initializedRef.current = false;
      }
    };

    initApp();

    return () => {
      mountedRef.current = false;
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch {
          // Ignore cleanup errors
        }
        appRef.current = null;
        graphicsRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []);

  // Sound effects for agent state changes
  useEffect(() => {
    Object.values(agents).forEach((agent) => {
      const prevState = prevAgentStatesRef.current[agent.id];
      if (agent.state === 'success' && prevState !== 'success') {
        const workspace = workspaces[agent.workspaceId];
        if (workspace && appRef.current) {
          spawnConfetti(
            workspace.x + workspace.width / 2,
            workspace.y + workspace.height / 2
          );
          playSound('success');
        }
      } else if (agent.state === 'error' && prevState !== 'error') {
        playSound('error');
      } else if (
        ['thinking', 'reading', 'writing', 'running', 'searching'].includes(agent.state) &&
        !['thinking', 'reading', 'writing', 'running', 'searching'].includes(prevState || '')
      ) {
        playSound('toolUse');
      }
      prevAgentStatesRef.current[agent.id] = agent.state;
    });
  }, [agents, workspaces]);

  const spawnConfetti = (x: number, y: number) => {
    if (!appRef.current) return;

    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.5;
      const speed = 3 + Math.random() * 4;

      const text = new Text({
        text: getRandomConfetti(),
        style: new TextStyle({ fontSize: 28 }),
      });
      text.x = x;
      text.y = y;
      text.anchor.set(0.5);

      appRef.current.stage.addChild(text);

      particlesRef.current.push({
        text,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1,
      });
    }
  };

  const updateParticles = () => {
    if (!appRef.current) return;

    particlesRef.current = particlesRef.current.filter((p) => {
      p.text.x += p.vx;
      p.text.y += p.vy;
      p.vy += 0.15;
      p.text.rotation += p.rotationSpeed;
      p.alpha -= 0.015;
      p.text.alpha = p.alpha;

      if (p.alpha <= 0) {
        if (appRef.current) {
          appRef.current.stage.removeChild(p.text);
        }
        p.text.destroy();
        return false;
      }
      return true;
    });
  };

  const renderCanvas = useCallback(() => {
    const g = graphicsRef.current;
    if (!g) return;

    g.clear();

    // Draw subtle dot grid
    g.setFillStyle({ color: 0x404060, alpha: 0.3 });
    for (let x = 0; x < 2000; x += 40) {
      for (let y = 0; y < 2000; y += 40) {
        g.circle(x, y, 1.5);
        g.fill();
      }
    }

    // Draw connection lines between workspaces
    Object.values(workspaces).forEach((fromWs) => {
      fromWs.outputConnections?.forEach((toId) => {
        const toWs = workspaces[toId];
        if (!toWs) return;

        const fromX = fromWs.x + fromWs.width;
        const fromY = fromWs.y + fromWs.height / 2;
        const toX = toWs.x;
        const toY = toWs.y + toWs.height / 2;

        const controlOffset = Math.min(100, Math.abs(toX - fromX) / 2);

        // Animated glow for active connections
        const isActive = fromWs.state === 'working' || toWs.state === 'working';

        if (isActive) {
          g.setStrokeStyle({ width: 8, color: 0x60a5fa, alpha: 0.2 });
          g.moveTo(fromX, fromY);
          g.bezierCurveTo(fromX + controlOffset, fromY, toX - controlOffset, toY, toX, toY);
          g.stroke();
        }

        g.setStrokeStyle({ width: 3, color: 0x60a5fa, alpha: isActive ? 1 : 0.6 });
        g.moveTo(fromX, fromY);
        g.bezierCurveTo(fromX + controlOffset, fromY, toX - controlOffset, toY, toX, toY);
        g.stroke();

        // Arrow
        const arrowSize = 10;
        g.setFillStyle({ color: 0x60a5fa, alpha: 0.9 });
        g.moveTo(toX, toY);
        g.lineTo(toX - arrowSize, toY - arrowSize / 2);
        g.lineTo(toX - arrowSize, toY + arrowSize / 2);
        g.closePath();
        g.fill();

        // Source dot
        g.setFillStyle({ color: 0x60a5fa, alpha: 1 });
        g.circle(fromX, fromY, 6);
        g.fill();
      });
    });

    // Draw workspaces
    Object.values(workspaces).forEach((workspace) => {
      const colors = WORKSPACE_COLORS[workspace.state];
      const isSelected = selectedWorkspaceId === workspace.id;

      g.setFillStyle({ color: colors.fill, alpha: 0.85 });
      g.rect(workspace.x, workspace.y, workspace.width, workspace.height);
      g.fill();

      if (isSelected) {
        g.setStrokeStyle({ width: 8, color: 0xffd700, alpha: 0.15 });
        g.rect(workspace.x - 6, workspace.y - 6, workspace.width + 12, workspace.height + 12);
        g.stroke();

        g.setStrokeStyle({ width: 4, color: 0xffd700, alpha: 0.3 });
        g.rect(workspace.x - 3, workspace.y - 3, workspace.width + 6, workspace.height + 6);
        g.stroke();

        g.setFillStyle({ color: 0xffd700, alpha: 0.08 });
        g.rect(workspace.x, workspace.y, workspace.width, workspace.height);
        g.fill();
      }

      g.setStrokeStyle({
        width: isSelected ? 4 : 2,
        color: isSelected ? 0xffd700 : colors.border,
        alpha: 1,
      });
      g.rect(workspace.x, workspace.y, workspace.width, workspace.height);
      g.stroke();

      const agent = workspace.agentId ? agents[workspace.agentId] : null;
      if (agent) {
        const cx = workspace.x + workspace.width / 2;
        const cy = workspace.y + workspace.height / 2;
        g.setFillStyle({ color: 0x1a1a2e, alpha: 0.8 });
        g.circle(cx, cy, 28);
        g.fill();
        g.setStrokeStyle({ width: 2, color: colors.border, alpha: 0.6 });
        g.circle(cx, cy, 28);
        g.stroke();
      }
    });

    // Drawing preview
    if (drawing.isDrawing && drawing.start && drawing.current) {
      const x = Math.min(drawing.start.x, drawing.current.x);
      const y = Math.min(drawing.start.y, drawing.current.y);
      const width = Math.abs(drawing.current.x - drawing.start.x);
      const height = Math.abs(drawing.current.y - drawing.start.y);

      g.setFillStyle({ color: 0x4299e1, alpha: 0.15 });
      g.rect(x, y, width, height);
      g.fill();

      g.setStrokeStyle({ width: 3, color: 0x4299e1, alpha: 1 });
      g.rect(x, y, width, height);
      g.stroke();
    }
  }, [workspaces, drawing, selectedWorkspaceId, agents]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Focus task input when activated
  useEffect(() => {
    if (focusedTaskInput && taskInputRef.current) {
      taskInputRef.current.focus();
    }
  }, [focusedTaskInput]);

  // Focus name input when editing starts
  useEffect(() => {
    if (editingWorkspaceId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingWorkspaceId]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if we're in position edit mode and clicking on the workspace being edited
      if (positionEditWorkspaceId && e.button === 0) {
        const clickedWorkspace = Object.values(workspaces).find(
          (ws) => x >= ws.x && x <= ws.x + ws.width && y >= ws.y && y <= ws.y + ws.height && ws.id === positionEditWorkspaceId
        );

        if (clickedWorkspace) {
          // Start dragging
          const offsetX = x - clickedWorkspace.x;
          const offsetY = y - clickedWorkspace.y;
          setDraggingWorkspace({ id: clickedWorkspace.id, offsetX, offsetY });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // If we're wiring and click on empty space, create a workspace and connect to it!
      if (wiring.isWiring && wiring.fromWorkspaceId && e.button === 0) {
        const clickedWorkspace = Object.values(workspaces).find(
          (ws) => x >= ws.x && x <= ws.x + ws.width && y >= ws.y && y <= ws.y + ws.height
        );

        if (!clickedWorkspace) {
          // Create new workspace and connect
          const newId = addWorkspace({
            name: `Workspace ${Object.keys(workspaces).length + 1}`,
            x: x - QUICK_CREATE_SIZE / 2,
            y: y - QUICK_CREATE_SIZE / 2,
            width: QUICK_CREATE_SIZE,
            height: QUICK_CREATE_SIZE,
            state: 'empty',
            agentId: null,
            messiness: Math.floor(Math.random() * 30),
            systemPrompt: null,
            model: 'claude-sonnet-4-20250514',
          });

          // Connect based on direction
          if (wiring.fromType === 'output') {
            connectWorkspaces(wiring.fromWorkspaceId, newId);
            setAutoRun(newId, true);
          } else {
            connectWorkspaces(newId, wiring.fromWorkspaceId);
          }

          playSound('connect');
          playSound('create');
          endWiring();
          selectWorkspace(newId);
          setFocusedTaskInput(newId);
          setTaskInputValue('');
          return;
        } else {
          // Clicked on a workspace - connect to it
          if (wiring.fromType === 'output') {
            connectWorkspaces(wiring.fromWorkspaceId, clickedWorkspace.id);
            setAutoRun(clickedWorkspace.id, true);
          } else {
            connectWorkspaces(clickedWorkspace.id, wiring.fromWorkspaceId);
          }
          playSound('connect');
          endWiring();
          return;
        }
      }

      const clickedWorkspace = Object.values(workspaces).find(
        (ws) => x >= ws.x && x <= ws.x + ws.width && y >= ws.y && y <= ws.y + ws.height
      );

      if (clickedWorkspace) {
        if (selectedWorkspaceId !== clickedWorkspace.id) {
          playSound('select');
        }
        selectWorkspace(clickedWorkspace.id);
      } else if (e.button === 0 && !positionEditWorkspaceId) {
        // Left click on empty space - start drawing (only if not in position edit mode)
        startDrawing(x, y);
      }
    },
    [workspaces, startDrawing, selectWorkspace, selectedWorkspaceId, wiring, addWorkspace, connectWorkspaces, setAutoRun, endWiring, positionEditWorkspaceId]
  );

  // Right-click to quick-create
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if right-clicking on a workspace
      const clickedWorkspace = Object.values(workspaces).find(
        (ws) => x >= ws.x && x <= ws.x + ws.width && y >= ws.y && y <= ws.y + ws.height
      );

      if (clickedWorkspace) {
        // Could show context menu here in future
        selectWorkspace(clickedWorkspace.id);
      } else {
        // Quick-create on empty space
        quickCreateWorkspace(x, y, true);
      }
    },
    [workspaces, selectWorkspace, quickCreateWorkspace]
  );

  const handlePointerUp = useCallback(() => {
    // Handle position dragging completion
    if (draggingWorkspace) {
      setDraggingWorkspace(null);
      return;
    }

    // Handle wiring completion
    if (wiring.isWiring) {
      // Find any workspace we're hovering over (not just the port - ANYWHERE on the workspace)
      const targetWorkspace = Object.values(workspaces).find((ws) => {
        if (ws.id === wiring.fromWorkspaceId) return false;
        // Check if mouse is anywhere inside the workspace bounds
        return wiring.mouseX >= ws.x &&
               wiring.mouseX <= ws.x + ws.width &&
               wiring.mouseY >= ws.y &&
               wiring.mouseY <= ws.y + ws.height;
      });

      if (targetWorkspace && wiring.fromWorkspaceId) {
        if (wiring.fromType === 'output') {
          connectWorkspaces(wiring.fromWorkspaceId, targetWorkspace.id);
          setAutoRun(targetWorkspace.id, true);
        } else {
          connectWorkspaces(targetWorkspace.id, wiring.fromWorkspaceId);
          setAutoRun(wiring.fromWorkspaceId, true);
        }
        playSound('connect');
      }
      endWiring();
      return;
    }

    const result = finishDrawing();
    if (result) {
      const id = addWorkspace({
        name: `Workspace ${Object.keys(workspaces).length + 1}`,
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        state: 'empty',
        agentId: null,
        messiness: Math.floor(Math.random() * 30),
        systemPrompt: null,
        model: 'claude-sonnet-4-20250514',
      });

      // Auto-connect if there's a selected workspace
      if (selectedWorkspaceId) {
        connectWorkspaces(selectedWorkspaceId, id);
        setAutoRun(id, true);
        playSound('connect');
      } else {
        playSound('create');
      }

      selectWorkspace(id);
      // Go straight to task input
      setFocusedTaskInput(id);
      setTaskInputValue('');
    }
  }, [finishDrawing, addWorkspace, selectWorkspace, wiring, workspaces, connectWorkspaces, endWiring, selectedWorkspaceId, setAutoRun, draggingWorkspace]);

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle position dragging
      if (draggingWorkspace) {
        const newX = Math.max(0, x - draggingWorkspace.offsetX);
        const newY = Math.max(0, y - draggingWorkspace.offsetY);
        updateWorkspacePosition(draggingWorkspace.id, newX, newY);
        return;
      }

      if (wiring.isWiring) {
        updateWiring(x, y);
      } else if (drawing.isDrawing) {
        updateDrawing(x, y);
      }
    },
    [drawing.isDrawing, updateDrawing, wiring.isWiring, updateWiring, draggingWorkspace, updateWorkspacePosition]
  );

  // Handle task submission
  const handleTaskSubmit = useCallback(async (workspaceId: string, task: string) => {
    if (!task.trim()) return;

    setTaskTemplate(workspaceId, task.trim());
    playSound('start');
    await startTask(workspaceId, task.trim(), { useWorkflowInputs: true });
    setFocusedTaskInput(null);
    setTaskInputValue('');
  }, [setTaskTemplate, startTask]);

  return (
    <div
      ref={containerRef}
      data-canvas
      className="flex-1 relative overflow-hidden cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {/* Workspace cards */}
      {Object.values(workspaces).map((workspace, index) => {
        const agent = workspace.agentId ? agents[workspace.agentId] : null;
        const isSelected = selectedWorkspaceId === workspace.id;
        const isEditingName = editingWorkspaceId === workspace.id;
        const isEditingTask = focusedTaskInput === workspace.id;
        const hasInputs = (workspace.inputConnections?.length || 0) > 0;
        const hasOutputs = (workspace.outputConnections?.length || 0) > 0;
        const isAgentBusy = agent && !['idle', 'success', 'error'].includes(agent.state);

        const getStatusInfo = () => {
          if (!agent) return { label: 'READY', color: '#6b7280', bg: 'bg-gray-700' };
          switch (agent.state) {
            case 'thinking': return { label: 'THINKING', color: '#fbbf24', bg: 'bg-yellow-600' };
            case 'reading': return { label: 'READING', color: '#60a5fa', bg: 'bg-blue-600' };
            case 'writing': return { label: 'WRITING', color: '#a78bfa', bg: 'bg-purple-600' };
            case 'running': return { label: 'RUNNING', color: '#34d399', bg: 'bg-green-600' };
            case 'searching': return { label: 'SEARCHING', color: '#f472b6', bg: 'bg-pink-600' };
            case 'success': return { label: 'DONE', color: '#10b981', bg: 'bg-emerald-600' };
            case 'error': return { label: 'ERROR', color: '#ef4444', bg: 'bg-red-600' };
            default: return { label: 'IDLE', color: '#9ca3af', bg: 'bg-gray-600' };
          }
        };
        const status = getStatusInfo();

        const isPositionEditing = positionEditWorkspaceId === workspace.id;
        const borderColor = isPositionEditing ? '#60a5fa' :
          isSelected ? '#ffd700' :
          workspace.state === 'working' ? '#3182ce' :
          workspace.state === 'success' ? '#38a169' :
          workspace.state === 'error' ? '#e53e3e' :
          '#4a5568';

        const getBgColor = () => {
          if (workspace.state === 'success') return 'rgba(16, 185, 129, 0.15)';
          if (workspace.state === 'error') return 'rgba(239, 68, 68, 0.15)';
          if (workspace.state === 'working') return 'rgba(59, 130, 246, 0.1)';
          if (isSelected) return 'rgba(255, 215, 0, 0.05)';
          return 'rgba(26, 26, 46, 0.95)';
        };

        const lastMessage = agent?.logs?.filter(l => l.type === 'message').pop();

        return (
          <div
            key={workspace.id}
            className={`absolute rounded-lg transition-all duration-200 group ${
              isSelected ? 'shadow-lg shadow-yellow-500/30 z-20' : 'z-10'
            } ${workspace.state === 'success' ? 'shadow-lg shadow-emerald-500/30' : ''} ${
              isPositionEditing ? 'ring-4 ring-blue-500/50 shadow-lg shadow-blue-500/30' : ''
            }`}
            style={{
              left: workspace.x,
              top: workspace.y,
              width: workspace.width,
              height: workspace.height,
              border: `3px solid ${borderColor}`,
              backgroundColor: getBgColor(),
              cursor: positionEditWorkspaceId === workspace.id ? 'move' : 'default',
            }}
            onPointerDown={(e) => {
              // Don't select workspace if we're in the middle of wiring
              if (wiring.isWiring) {
                e.stopPropagation();
                return;
              }
              // If in position edit mode and this is the workspace being edited, handle drag
              if (positionEditWorkspaceId === workspace.id && e.button === 0) {
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  const offsetX = x - workspace.x;
                  const offsetY = y - workspace.y;
                  setDraggingWorkspace({ id: workspace.id, offsetX, offsetY });
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            }}
            onPointerUp={(e) => {
              if (draggingWorkspace && draggingWorkspace.id === workspace.id) {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              }
            }}
          >
            {/* Workspace number badge */}
            <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center text-xs font-bold text-gray-300">
              {index + 1}
            </div>

            {/* Delete button */}
            <button
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-xs text-white pointer-events-auto opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                playSound('delete');
                removeWorkspace(workspace.id);
                if (selectedWorkspaceId === workspace.id) {
                  selectWorkspace(null);
                }
              }}
              title="Delete (Del)"
            >
              ×
            </button>

            {/* Drag zone highlight when wiring is active */}
            {wiring.isWiring && wiring.fromWorkspaceId !== workspace.id && (
              <div className="absolute inset-0 rounded-lg border-4 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none animate-pulse" />
            )}
            
            {/* Position edit mode indicator and drag overlay */}
            {isPositionEditing && (
              <>
                <div className="absolute inset-0 rounded-lg border-4 border-dashed border-blue-400 bg-blue-500/10 pointer-events-none flex items-center justify-center z-30">
                  <div className="bg-blue-600/90 text-white px-3 py-1 rounded text-xs font-bold">
                    Drag to move
                  </div>
                </div>
                {/* Transparent drag overlay - allows dragging from anywhere on the workspace */}
                <div
                  className="absolute inset-0 rounded-lg cursor-move z-20"
                  onPointerDown={(e) => {
                    if (e.button === 0) {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        const offsetX = x - workspace.x;
                        const offsetY = y - workspace.y;
                        setDraggingWorkspace({ id: workspace.id, offsetX, offsetY });
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }
                  }}
                  onPointerUp={(e) => {
                    if (draggingWorkspace && draggingWorkspace.id === workspace.id) {
                      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                    }
                  }}
                />
              </>
            )}

            {/* INPUT PORT */}
            <div
              className="absolute pointer-events-auto cursor-grab group"
              style={{ left: -14, top: 0, bottom: 0, width: 50 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  startWiring(workspace.id, 'input', e.clientX - rect.left, e.clientY - rect.top);
                }
              }}
              onPointerMove={(e) => {
                if (wiring.isWiring) {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    updateWiring(e.clientX - rect.left, e.clientY - rect.top);
                  }
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                // Complete connection if wiring is active
                if (wiring.isWiring && wiring.fromWorkspaceId) {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // Find any workspace we're hovering over
                    const targetWorkspace = Object.values(workspaces).find((ws) => {
                      if (ws.id === wiring.fromWorkspaceId) return false;
                      return x >= ws.x && x <= ws.x + ws.width &&
                             y >= ws.y && y <= ws.y + ws.height;
                    });

                    if (targetWorkspace) {
                      if (wiring.fromType === 'output') {
                        connectWorkspaces(wiring.fromWorkspaceId, targetWorkspace.id);
                        setAutoRun(targetWorkspace.id, true);
                      } else {
                        connectWorkspaces(targetWorkspace.id, wiring.fromWorkspaceId);
                        setAutoRun(wiring.fromWorkspaceId, true);
                      }
                      playSound('connect');
                    }
                    endWiring();
                  }
                }
              }}
            >
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                hasInputs
                  ? 'bg-blue-500 border-blue-300 shadow-lg shadow-blue-500/50'
                  : 'bg-gray-700 border-gray-500 group-hover:border-blue-400 group-hover:bg-blue-900 group-hover:scale-125'
              }`}>
                <span className="text-sm text-white font-bold">+</span>
              </div>
            </div>

            {/* OUTPUT PORT + Large drag zone on right edge */}
            <div
              className="absolute pointer-events-auto cursor-grab active:cursor-grabbing group"
              style={{ right: -14, top: 0, bottom: 0, width: 50 }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Capture pointer to track it even when moving fast
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  startWiring(workspace.id, 'output', e.clientX - rect.left, e.clientY - rect.top);
                }
              }}
              onPointerMove={(e) => {
                if (wiring.isWiring) {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    updateWiring(e.clientX - rect.left, e.clientY - rect.top);
                  }
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                // Complete connection if wiring is active
                if (wiring.isWiring && wiring.fromWorkspaceId) {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // Find any workspace we're hovering over
                    const targetWorkspace = Object.values(workspaces).find((ws) => {
                      if (ws.id === wiring.fromWorkspaceId) return false;
                      return x >= ws.x && x <= ws.x + ws.width &&
                             y >= ws.y && y <= ws.y + ws.height;
                    });

                    if (targetWorkspace) {
                      if (wiring.fromType === 'output') {
                        connectWorkspaces(wiring.fromWorkspaceId, targetWorkspace.id);
                        setAutoRun(targetWorkspace.id, true);
                      } else {
                        connectWorkspaces(targetWorkspace.id, wiring.fromWorkspaceId);
                        setAutoRun(wiring.fromWorkspaceId, true);
                      }
                      playSound('connect');
                    }
                    endWiring();
                  }
                }
              }}
            >
              {/* Visual port indicator */}
              <div
                className={`absolute right-0 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                  hasOutputs
                    ? 'bg-green-500 border-green-300 shadow-lg shadow-green-500/50'
                    : 'bg-gray-700 border-gray-500 group-hover:border-green-400 group-hover:bg-green-900 group-hover:scale-125'
                }`}
              >
                <span className="text-sm text-white font-bold">&gt;</span>
              </div>
              {/* Drag hint */}
              <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-green-400 whitespace-nowrap bg-black/80 px-2 py-1 rounded">
                Drag to connect →
              </div>
            </div>

            {/* Card content */}
            <div className="w-full h-full flex flex-col p-3 pointer-events-none">
              {/* Header */}
              <div className={`flex items-center justify-between mb-2 px-2 py-1.5 rounded ${
                isSelected ? 'bg-yellow-500/20' : 'bg-black/40'
              }`}>
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => {
                      if (editingName.trim()) {
                        renameWorkspace(workspace.id, editingName.trim());
                      }
                      setEditingWorkspace(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingName.trim()) {
                          renameWorkspace(workspace.id, editingName.trim());
                        }
                        setEditingWorkspace(null);
                        // Auto-focus task input after naming
                        setFocusedTaskInput(workspace.id);
                        setTaskInputValue('');
                      } else if (e.key === 'Escape') {
                        setEditingWorkspace(null);
                      }
                    }}
                    placeholder="Name it..."
                    className="flex-1 bg-transparent border-b-2 border-yellow-400 text-yellow-400 font-bold text-sm outline-none pointer-events-auto px-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={`text-sm font-bold truncate flex-1 cursor-pointer pointer-events-auto hover:underline ${isSelected ? 'text-yellow-400' : 'text-white'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingWorkspace(workspace.id);
                      setEditingName(workspace.name || '');
                    }}
                  >
                    {workspace.name || 'Untitled'}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${status.bg}`} style={{ color: 'white' }}>
                  {status.label}
                </span>
              </div>

              {/* Connection indicators */}
              {(hasInputs || workspace.autoRun) && (
                <div className="flex items-center gap-2 mb-2 text-[10px]">
                  {hasInputs && (
                    <span className="text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded">
                      {workspace.inputConnections?.length} input
                    </span>
                  )}
                  {workspace.autoRun && (
                    <span className="text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded">
                      ⚡ auto
                    </span>
                  )}
                </div>
              )}

              {/* Main content area */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                {isAgentBusy ? (
                  // Working state
                  <div className="flex flex-col items-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center border-4 border-blue-500 bg-blue-900/50"
                      style={{ animation: 'pulse 1.5s infinite' }}
                    >
                      <span className="text-2xl">{AGENT_EMOJIS[agent.state]}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400 truncate max-w-full px-2">
                      {agent.task?.slice(0, 40)}...
                    </div>
                    <button
                      className="mt-2 px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded pointer-events-auto transition-colors"
                      onClick={() => stopTask(agent.id)}
                    >
                      Stop
                    </button>
                  </div>
                ) : agent?.state === 'success' ? (
                  // Success state
                  <div
                    className="flex flex-col items-center cursor-pointer pointer-events-auto hover:opacity-80 transition-opacity"
                    onClick={() => showOutputModal(agent.id)}
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center border-4 border-emerald-500 bg-emerald-900/50">
                      <span className="text-2xl">🎉</span>
                    </div>
                    <div className="mt-2 px-2 py-1 bg-emerald-900/50 rounded text-xs text-emerald-200 max-w-full truncate">
                      {lastMessage?.content.slice(0, 50)}...
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">Click to view</div>
                  </div>
                ) : isEditingTask ? (
                  // Task input mode
                  <div className="w-full flex flex-col pointer-events-auto">
                    <textarea
                      ref={taskInputRef}
                      value={taskInputValue}
                      onChange={(e) => setTaskInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleTaskSubmit(workspace.id, taskInputValue);
                        } else if (e.key === 'Escape') {
                          setFocusedTaskInput(null);
                        }
                      }}
                      onBlur={() => {
                        if (taskInputValue.trim()) {
                          setTaskTemplate(workspace.id, taskInputValue.trim());
                        }
                        setFocusedTaskInput(null);
                      }}
                      placeholder="What should Claude do?"
                      className="w-full h-20 bg-gray-900 border border-blue-500 rounded px-2 py-1.5 text-sm text-white placeholder-gray-500 outline-none resize-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-gray-500">⌘+Enter to run</span>
                      <button
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
                        disabled={!taskInputValue.trim()}
                        onClick={() => handleTaskSubmit(workspace.id, taskInputValue)}
                      >
                        Run
                      </button>
                    </div>
                  </div>
                ) : workspace.taskTemplate ? (
                  // Has template, ready to run
                  <div className="flex flex-col items-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-purple-500 bg-purple-900/30 cursor-pointer pointer-events-auto hover:scale-110 transition-transform"
                      onClick={() => {
                        playSound('start');
                        startTask(workspace.id, workspace.taskTemplate!, { useWorkflowInputs: true });
                      }}
                      title="Click to run"
                    >
                      <span className="text-2xl">▶️</span>
                    </div>
                    <div className="mt-2 text-xs text-purple-300 truncate max-w-full px-2">
                      {workspace.taskTemplate.slice(0, 40)}...
                    </div>
                    <button
                      className="mt-1 text-[10px] text-gray-500 hover:text-gray-300 pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFocusedTaskInput(workspace.id);
                        setTaskInputValue(workspace.taskTemplate || '');
                      }}
                    >
                      edit
                    </button>
                  </div>
                ) : (
                  // Empty state - prompt to add task
                  <div
                    className="flex flex-col items-center cursor-pointer pointer-events-auto group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFocusedTaskInput(workspace.id);
                      setTaskInputValue('');
                    }}
                  >
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-900/20 transition-all">
                      <span className="text-2xl opacity-50 group-hover:opacity-100">+</span>
                    </div>
                    <span className="text-xs text-gray-500 mt-2 group-hover:text-blue-400">
                      Add task
                    </span>
                    <span className="text-[10px] text-gray-600 mt-1">
                      or press T
                    </span>
                  </div>
                )}
              </div>

              {/* Output connections */}
              {hasOutputs && (
                <div className="mt-auto pt-2 border-t border-gray-700/50 text-[10px] text-green-400 truncate">
                  → {workspace.outputConnections?.map(id => workspaces[id]?.name || 'Untitled').join(', ')}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Connection lines between workspaces - SVG overlay above cards */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 25, overflow: 'visible' }}
      >
        <defs>
          <marker id="arrowhead-connection" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill="#60a5fa" />
          </marker>
          <marker id="arrowhead-connection-active" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
            <polygon points="0 0, 10 4, 0 8" fill="#60a5fa" />
          </marker>
          <filter id="glow-connection">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {Object.values(workspaces).flatMap((fromWs) => {
          return (fromWs.outputConnections || []).map((toId) => {
            const toWs = workspaces[toId];
            if (!toWs) return null;

            const fromX = fromWs.x + fromWs.width;
            const fromY = fromWs.y + fromWs.height / 2;
            const toX = toWs.x;
            const toY = toWs.y + toWs.height / 2;

            const controlOffset = Math.min(100, Math.abs(toX - fromX) / 2);
            const isActive = fromWs.state === 'working' || toWs.state === 'working';

            const pathD = `M ${fromX} ${fromY} C ${fromX + controlOffset} ${fromY}, ${toX - controlOffset} ${toY}, ${toX} ${toY}`;

            return (
              <g key={`${fromWs.id}-${toId}`}>
                {/* Glow for active connections */}
                {isActive && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="8"
                    strokeOpacity="0.2"
                    filter="url(#glow-connection)"
                  />
                )}
                {/* Main connection line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={isActive ? "4" : "3"}
                  strokeOpacity={isActive ? "1" : "0.6"}
                  strokeLinecap="round"
                  markerEnd="url(#arrowhead-connection)"
                />
                {/* Source dot */}
                <circle cx={fromX} cy={fromY} r="6" fill="#60a5fa" />
              </g>
            );
          }).filter(Boolean);
        })}
      </svg>

      {/* Wiring line - ALWAYS visible when wiring */}
      {wiring.isWiring && wiring.fromWorkspaceId && (() => {
        const fromWs = workspaces[wiring.fromWorkspaceId];
        if (!fromWs) return null;

        const fromX = wiring.fromType === 'output' ? fromWs.x + fromWs.width : fromWs.x;
        const fromY = fromWs.y + fromWs.height / 2;

        return (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 9999, overflow: 'visible' }}
          >
            <defs>
              <marker id="arrowhead-active" markerWidth="12" markerHeight="9" refX="10" refY="4.5" orient="auto">
                <polygon points="0 0, 12 4.5, 0 9" fill="#22d3ee" />
              </marker>
              <filter id="glow-active">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {/* Glow layer */}
            <path
              d={`M ${fromX} ${fromY} C ${fromX + (wiring.fromType === 'output' ? 80 : -80)} ${fromY}, ${wiring.mouseX + (wiring.fromType === 'output' ? -80 : 80)} ${wiring.mouseY}, ${wiring.mouseX} ${wiring.mouseY}`}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="8"
              strokeOpacity="0.4"
              filter="url(#glow-active)"
            />
            {/* Main line */}
            <path
              d={`M ${fromX} ${fromY} C ${fromX + (wiring.fromType === 'output' ? 80 : -80)} ${fromY}, ${wiring.mouseX + (wiring.fromType === 'output' ? -80 : 80)} ${wiring.mouseY}, ${wiring.mouseX} ${wiring.mouseY}`}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="5"
              strokeLinecap="round"
              markerEnd="url(#arrowhead-active)"
            />
            {/* Animated dots */}
            <circle r="6" fill="#22d3ee">
              <animateMotion
                dur="0.8s"
                repeatCount="indefinite"
                path={`M ${fromX} ${fromY} C ${fromX + (wiring.fromType === 'output' ? 80 : -80)} ${fromY}, ${wiring.mouseX + (wiring.fromType === 'output' ? -80 : 80)} ${wiring.mouseY}, ${wiring.mouseX} ${wiring.mouseY}`}
              />
            </circle>
            {/* Start point */}
            <circle cx={fromX} cy={fromY} r="8" fill="#22d3ee" />
            {/* End point */}
            <circle cx={wiring.mouseX} cy={wiring.mouseY} r="10" fill="#22d3ee" fillOpacity="0.6">
              <animate attributeName="r" values="10;14;10" dur="0.5s" repeatCount="indefinite" />
            </circle>
          </svg>
        );
      })()}

      {/* Wiring mode indicator */}
      {wiring.isWiring && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-cyan-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg z-50 pointer-events-none">
          🔗 Click workspace to connect, or click empty space to create new
        </div>
      )}

      {/* Empty state */}
      {Object.keys(workspaces).length === 0 && !drawing.isDrawing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-black/60 backdrop-blur px-12 py-10 rounded-2xl border border-gray-700">
            <div className="text-4xl mb-4">🚀</div>
            <p className="text-xl mb-2 text-white font-semibold">Right-click to create a workspace</p>
            <p className="text-sm text-gray-400 mb-6">or drag to draw a custom size</p>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
              <div className="text-left">
                <div className="font-mono text-blue-400">N / Space</div>
                <div>New workspace</div>
              </div>
              <div className="text-left">
                <div className="font-mono text-blue-400">T / Enter</div>
                <div>Add task</div>
              </div>
              <div className="text-left">
                <div className="font-mono text-blue-400">R</div>
                <div>Run task</div>
              </div>
              <div className="text-left">
                <div className="font-mono text-blue-400">Tab</div>
                <div>Cycle workspaces</div>
              </div>
              <div className="text-left">
                <div className="font-mono text-blue-400">C</div>
                <div>Connect</div>
              </div>
              <div className="text-left">
                <div className="font-mono text-blue-400">Del</div>
                <div>Delete</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotkey hints (when workspaces exist) */}
      {Object.keys(workspaces).length > 0 && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-black/60 backdrop-blur px-3 py-2 rounded-lg pointer-events-none">
          <span className="text-blue-400 font-mono">N</span> new &nbsp;
          <span className="text-blue-400 font-mono">T</span> task &nbsp;
          <span className="text-blue-400 font-mono">R</span> run &nbsp;
          <span className="text-blue-400 font-mono">C</span> connect &nbsp;
          <span className="text-blue-400 font-mono">Tab</span> cycle
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -15;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
