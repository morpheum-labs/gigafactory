# CanvasRoot.tsx Modularity Analysis

## Current State

**File Size**: 1,785 lines - **Very Large** ⚠️

**Current Modularity**: **Partial** ✅❌

### ✅ What's Already Modular

1. **ViewportController** (`src/lib/canvas/ViewportController.ts`)
   - ✅ Extracted viewport logic
   - ✅ Reusable coordinate transformations
   - ✅ Clean API

2. **GraphModel** (`src/lib/graph/`)
   - ✅ Graph logic separated
   - ✅ Serialization utilities
   - ✅ Node management

3. **UI Components** (`src/components/canvas/`)
   - ✅ PerformanceMonitor
   - ✅ ContextMenu
   - ✅ TimelineSimulator

### ❌ What's NOT Modular (Should Be Extracted)

1. **Rendering Logic** (448-639 lines)
   - ❌ Grid rendering (80+ lines)
   - ❌ Connection rendering (50+ lines)
   - ❌ Node rendering (40+ lines)
   - ❌ Drawing preview (15+ lines)

2. **Event Handlers** (700+ lines)
   - ❌ Pointer events
   - ❌ Keyboard shortcuts
   - ❌ Wheel events
   - ❌ Context menu

3. **Particle System** (50+ lines)
   - ❌ Particle creation
   - ❌ Particle updates
   - ❌ Particle rendering

4. **Workspace Creation** (100+ lines)
   - ❌ Quick create logic
   - ❌ Grid snapping
   - ❌ Auto-connect logic

## Efficiency Issues

### 1. **Large Component** ⚠️
- 1,785 lines in single file
- Hard to maintain
- Hard to test
- Hard to understand

### 2. **Mixed Concerns** ⚠️
- Rendering + Event handling + State management
- Should be separated

### 3. **Inline Rendering Logic** ⚠️
- Grid rendering could be a module
- Connection rendering could be a module
- Node rendering could be a module

### 4. **Repeated Calculations** ⚠️
- Coordinate transformations repeated
- Viewport calculations repeated
- Grid calculations repeated

## Recommended Modular Structure

### Proposed `src/lib/canvas/` Modules

```
src/lib/canvas/
├── ViewportController.ts          ✅ Already exists
├── GridRenderer.ts                 ❌ NEW - Grid rendering logic
├── ConnectionRenderer.ts           ❌ NEW - Connection rendering
├── NodeRenderer.ts                 ❌ NEW - Node/workspace rendering
├── DrawingPreviewRenderer.ts      ❌ NEW - Drawing preview
├── ParticleSystem.ts               ❌ NEW - Particle effects
├── CanvasEventHandlers.ts         ❌ NEW - Event handling
├── WorkspaceFactory.ts             ❌ NEW - Workspace creation
└── CanvasUtils.ts                  ❌ NEW - Utility functions
```

### Benefits of Modularization

1. **Testability** ✅
   - Each module can be tested independently
   - Easier to mock dependencies

2. **Reusability** ✅
   - Grid renderer can be used elsewhere
   - Connection renderer can be reused
   - Event handlers can be shared

3. **Maintainability** ✅
   - Smaller files are easier to understand
   - Changes are isolated
   - Less merge conflicts

4. **Performance** ✅
   - Can optimize individual modules
   - Can memoize rendering functions
   - Can lazy load modules

5. **Code Organization** ✅
   - Clear separation of concerns
   - Easy to find code
   - Better IDE navigation

## Proposed Refactoring

### Step 1: Extract Rendering Modules

**`src/lib/canvas/GridRenderer.ts`**
```typescript
export function renderGrid(
  graphics: Graphics,
  viewport: ViewportController,
  containerRect: DOMRect,
  gridSize: number,
  majorSize: number
): void {
  // Grid rendering logic
}
```

**`src/lib/canvas/ConnectionRenderer.ts`**
```typescript
export function renderConnections(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  viewport?: ViewportController
): void {
  // Connection rendering logic
}
```

**`src/lib/canvas/NodeRenderer.ts`**
```typescript
export function renderNodes(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  agents: Record<string, Agent>,
  selectedId: string | null
): void {
  // Node rendering logic
}
```

### Step 2: Extract Event Handlers

**`src/lib/canvas/CanvasEventHandlers.ts`**
```typescript
export function createCanvasEventHandlers({
  viewport,
  workspaces,
  onWorkspaceCreate,
  onWorkspaceSelect,
  // ... other handlers
}): CanvasEventHandlers {
  return {
    onPointerDown: (e) => { /* ... */ },
    onPointerMove: (e) => { /* ... */ },
    onWheel: (e) => { /* ... */ },
    // ... other events
  };
}
```

### Step 3: Extract Utilities

**`src/lib/canvas/CanvasUtils.ts`**
```typescript
export function snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number };
export function calculateVisibleBounds(viewport: ViewportController, container: DOMRect): Bounds;
export function worldToScreen(viewport: ViewportController, x: number, y: number): { x: number; y: number };
```

### Step 4: Extract Particle System

**`src/lib/canvas/ParticleSystem.ts`**
```typescript
export class ParticleSystem {
  createParticle(...): Particle;
  updateParticles(): void;
  renderParticles(stage: Container): void;
}
```

## Efficiency Improvements

### 1. **Memoization**
```typescript
// Memoize rendering functions
const renderGrid = useMemo(
  () => createGridRenderer(gridSize, majorSize),
  [gridSize, majorSize]
);
```

### 2. **Lazy Loading**
```typescript
// Load heavy modules only when needed
const ParticleSystem = lazy(() => import('./lib/canvas/ParticleSystem'));
```

### 3. **Dirty Flag System**
```typescript
// Only re-render when needed
const [dirtyFlags, setDirtyFlags] = useState({
  grid: false,
  connections: false,
  nodes: false,
});
```

### 4. **Viewport Culling**
```typescript
// Only render visible elements
const visibleWorkspaces = useMemo(
  () => getVisibleWorkspaces(workspaces, viewport),
  [workspaces, viewport]
);
```

## Current Import Structure

```typescript
// ✅ Good - Using lib modules
import { ViewportController } from '../lib/canvas/ViewportController';
import { GraphModel, createNodeFromWorkspace } from '../lib/graph';

// ❌ Bad - Inline logic that should be extracted
// 200+ lines of grid rendering
// 100+ lines of connection rendering
// 50+ lines of event handling
```

## Recommended Action Plan

### Phase 1: Extract Rendering (High Priority)
1. Extract `GridRenderer.ts`
2. Extract `ConnectionRenderer.ts`
3. Extract `NodeRenderer.ts`
4. Reduce CanvasRoot by ~200 lines

### Phase 2: Extract Event Handlers (Medium Priority)
1. Extract `CanvasEventHandlers.ts`
2. Extract `WorkspaceFactory.ts`
3. Reduce CanvasRoot by ~300 lines

### Phase 3: Extract Utilities (Low Priority)
1. Extract `CanvasUtils.ts`
2. Extract `ParticleSystem.ts`
3. Reduce CanvasRoot by ~100 lines

### Target Size
- **Current**: 1,785 lines
- **Target**: ~800-1000 lines (main component)
- **Extracted**: ~800 lines (modules)

## Conclusion

**Current Design**: ⚠️ **Partially Modular**

**Efficiency**: ⚠️ **Could Be Better**

**Recommendation**: ✅ **Extract Rendering Modules**

The canvas is functional but could be much more modular and efficient by extracting rendering logic, event handlers, and utilities into separate modules in `src/lib/canvas/`.

---

*Last Updated: January 2026*
