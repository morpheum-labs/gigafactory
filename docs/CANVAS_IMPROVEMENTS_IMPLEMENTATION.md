# Canvas Improvements Implementation Guide

## Overview

This document describes the UI tooling improvements implemented for `CanvasRoot.tsx` to transform it into a powerful editor/simulator for agent fleets.

## New Components Created

### 1. `NodeEditor.tsx` (`src/components/panels/NodeEditor.tsx`)
- Advanced node property editor
- Supports: name, task template, system prompt, model selection, messiness slider, size controls
- Can be used in side panel or context menu

### 2. `PerformanceMonitor.tsx` (`src/components/canvas/PerformanceMonitor.tsx`)
- FPS, node count, connection count, active nodes display
- Toggleable via hotkey (P key)
- Real-time performance metrics

### 3. `ContextMenu.tsx` (`src/components/canvas/ContextMenu.tsx`)
- Right-click context menu for nodes
- Actions: Edit Properties, Edit Position, Simulate Phase, Delete
- Keyboard navigation support

### 4. `TimelineSimulator.tsx` (`src/components/canvas/TimelineSimulator.tsx`)
- Phase scrubber for timeline simulation
- Supports Q1 2026 - 2030+ phases
- Play/pause controls

## Integration Steps

### Step 1: Add Viewport Support

In `CanvasRoot.tsx`, add:

```typescript
import { ViewportController } from '../lib/canvas/ViewportController';

// In component:
const viewportRef = useRef<ViewportController | null>(null);

// Initialize viewport
useEffect(() => {
  viewportRef.current = new ViewportController();
  viewportRef.current.setOnStateChange((state) => {
    if (appRef.current) {
      appRef.current.stage.x = state.x;
      appRef.current.stage.y = state.y;
      appRef.current.stage.scale.set(state.scale);
    }
  });
}, []);

// Add wheel handler for zoom
const handleWheel = useCallback((e: React.WheelEvent) => {
  if (!viewportRef.current) return;
  e.preventDefault();
  const rect = containerRef.current?.getBoundingClientRect();
  if (rect) {
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    viewportRef.current.zoom(e.deltaY < 0 ? 1 : -1, x, y);
  }
}, []);
```

### Step 2: Add Layering System

Replace single Graphics with layered containers:

```typescript
const gridLayerRef = useRef<Graphics | null>(null);
const connectionLayerRef = useRef<Graphics | null>(null);
const nodeLayerRef = useRef<Graphics | null>(null);

// In init:
const gridLayer = new Graphics();
const connectionLayer = new Graphics();
const nodeLayer = new Graphics();

app.stage.addChild(gridLayer);
app.stage.addChild(connectionLayer);
app.stage.addChild(nodeLayer);

gridLayerRef.current = gridLayer;
connectionLayerRef.current = connectionLayer;
nodeLayerRef.current = nodeLayer;
```

### Step 3: Add Dirty Flag Rendering

Track which elements need redrawing:

```typescript
const dirtyNodesRef = useRef<Set<string>>(new Set());
const dirtyConnectionsRef = useRef<Set<string>>(new Set());

// Mark nodes/connections as dirty when they change
useEffect(() => {
  Object.keys(workspaces).forEach(id => {
    dirtyNodesRef.current.add(id);
  });
}, [workspaces]);

// Only redraw dirty elements in renderCanvas
```

### Step 4: Add New Components

```typescript
import { PerformanceMonitor } from '../components/canvas/PerformanceMonitor';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { TimelineSimulator } from '../components/canvas/TimelineSimulator';

// State for context menu
const [contextMenu, setContextMenu] = useState<{ workspaceId: string; x: number; y: number } | null>(null);
const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
const [fps, setFps] = useState(60);
```

### Step 5: Enhance Keyboard Shortcuts

Add to `useKeyboardShortcuts`:

```typescript
// P = Toggle performance monitor
case 'p':
  if (!e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    setShowPerformanceMonitor(!showPerformanceMonitor);
  }
  break;

// E = Export graph
case 'e':
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    // Export logic
  }
  break;

// I = Import graph
case 'i':
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    // Import logic
  }
  break;
```

## Performance Optimizations

### 1. Viewport Culling
Only render nodes/connections within viewport bounds:

```typescript
const viewportBounds = viewportRef.current?.getState();
if (viewportBounds) {
  // Only render elements in viewport
  const visibleNodes = Object.values(workspaces).filter(ws => {
    const screenPos = viewportRef.current!.worldToScreen(ws.x, ws.y);
    return screenPos.x > -ws.width && screenPos.x < containerWidth + ws.width;
  });
}
```

### 2. Dirty Flag System
Track changes and only redraw what's needed:

```typescript
const needsGridRedraw = useRef(false);
const needsConnectionRedraw = useRef(false);
const needsNodeRedraw = useRef(false);

// Set flags when data changes
useEffect(() => {
  needsNodeRedraw.current = true;
}, [workspaces]);

// In renderCanvas, check flags before redrawing
if (needsGridRedraw.current) {
  // Redraw grid
  needsGridRedraw.current = false;
}
```

### 3. Display Objects Instead of Graphics
Use Pixi Containers/Sprites for reusable elements:

```typescript
// Create container per node
const nodeContainersRef = useRef<Map<string, Container>>(new Map());

// Update containers instead of redrawing
Object.values(workspaces).forEach(ws => {
  let container = nodeContainersRef.current.get(ws.id);
  if (!container) {
    container = new Container();
    nodeContainersRef.current.set(ws.id, container);
    nodeLayerRef.current.addChild(container);
  }
  // Update container properties
  container.x = ws.x;
  container.y = ws.y;
});
```

## Usage Examples

### Export Graph
```typescript
import { exportGraphToJSON, downloadGraphAsFile } from '../lib/graph';
import { GraphModel } from '../lib/graph';
import { createNodeFromWorkspace } from '../lib/graph/WorkspaceNodeAdapter';

const handleExport = () => {
  const model = new GraphModel();
  Object.values(workspaces).forEach(ws => {
    const node = createNodeFromWorkspace(ws);
    model.addNode(node);
  });
  downloadGraphAsFile(model, 'gigafactory-graph.json');
};
```

### Import Graph
```typescript
import { importGraphFromJSON } from '../lib/graph';

const handleImport = async (file: File) => {
  const model = await loadGraphFromFile(file);
  if (model) {
    // Convert nodes back to workspaces
    // Update store
  }
};
```

## Next Steps

1. **Integrate viewport** into CanvasRoot.tsx
2. **Add layering system** for optimized rendering
3. **Implement dirty flags** for performance
4. **Add context menu** on right-click
5. **Add performance monitor** toggle
6. **Add export/import** functionality
7. **Add timeline simulator** for phase stepping

## Testing

- Test with 100+ nodes for performance
- Test zoom/pan with large graphs
- Test context menu interactions
- Test export/import roundtrip
- Test keyboard shortcuts

## Performance Targets

- **FPS**: Maintain 60fps with 100+ nodes
- **Memory**: Efficient display object reuse
- **Rendering**: 50-80% reduction in CPU/GPU load
- **Navigation**: Smooth zoom/pan at all scales
