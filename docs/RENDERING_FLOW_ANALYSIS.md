# Rendering Flow & Double Rendering Analysis

## LocalStorage Loading Flow

### 1. App Startup (Automatic via Zustand Persist)

**Workspaces Store** (`src/stores/workspaces.ts`):
- ✅ Automatically loads from `localStorage.getItem('gigafactory-workspaces')` on app mount
- ✅ Zustand persist middleware handles this transparently
- ✅ Workspaces are immediately available in the store

**Viewport Store** (`src/stores/viewport.ts`):
- ✅ Automatically loads from `localStorage.getItem('gigafactory-viewport')` on app mount
- ✅ Zustand persist middleware handles this transparently
- ✅ Viewport state is immediately available in the store

### 2. Canvas Initialization Flow

**Location**: `src/canvas/CanvasRoot.tsx` (lines 268-376)

```typescript
// Step 1: Load saved viewport state from store (which was loaded from localStorage)
const savedViewportState = viewportState; // Line 311

// Step 2: Initialize ViewportController with saved state
viewportRef.current = new ViewportController(savedViewportState || undefined); // Line 312

// Step 3: Apply saved state to PixiJS stage immediately
if (app.stage && savedViewportState) {
  app.stage.x = savedViewportState.x ?? 0;      // Line 316
  app.stage.y = savedViewportState.y ?? 0;      // Line 317
  app.stage.scale.set(savedViewportState.scale ?? 1); // Line 318
}

// Step 4: Set up viewport state change handler (saves to localStorage)
viewportRef.current.setOnStateChange((state) => {
  // Update stage
  app.stage.x = state.x;
  app.stage.y = state.y;
  app.stage.scale.set(state.scale);
  // Persist to localStorage via store
  setViewportState({ x: state.x, y: state.y, scale: state.scale });
});

// Step 5: Start render loop (calls renderCanvas every frame)
app.ticker.add(() => {
  renderCanvas(); // Line 352 - Called every frame (~60fps)
  updateParticles();
});
```

## Rendering Flow

### Primary Rendering (PixiJS Layers)

**Function**: `renderCanvas()` (lines 452-481)

**Called from**:
1. **PixiJS Ticker** (line 352): Every frame (~60fps) - **PRIMARY RENDER LOOP**
2. **useEffect** (line 484): When `renderCanvas` dependency changes
3. **ResizeObserver** (line 493): When container size changes
4. **Sidebar toggle** (line 505): When `sidebarCollapsed` changes

**What it renders**:
```typescript
renderCanvas() {
  // 1. Grid layer (viewport-aware culling)
  renderGrid(gridLayer, viewportRef.current, containerRect);
  
  // 2. Connection layer (PixiJS Graphics)
  renderConnections(connectionLayer, workspaces);
  
  // 3. Node layer (workspaces + drawing preview)
  renderNodes(nodeLayer, workspaces, agents, selectedWorkspaceId);
  renderDrawingPreview(nodeLayer, drawing);
}
```

### Secondary Rendering (HTML/SVG Overlays)

**Location**: Lines 1413-1485 (SVG connections) + Lines 1487-1555 (wiring preview)

**What it renders**:
1. **SVG Connection Lines** (lines 1413-1485):
   - Same connections as PixiJS `connectionLayer`
   - Rendered as SVG `<path>` elements
   - Uses screen coordinates (converted from world via `viewportRef.current.worldToScreen()`)
   - Has arrow markers (`arrowhead-connection`)
   - Has glow effects for active connections

2. **SVG Wiring Preview** (lines 1487-1555):
   - Temporary connection line when wiring mode is active
   - Animated dots along the path
   - Uses screen coordinates

3. **HTML Workspace Cards** (lines 917-1411):
   - The actual workspace UI (React components)
   - Positioned absolutely with screen coordinates
   - Transformed to match viewport scale

## ⚠️ DOUBLE RENDERING ISSUE

### Problem: Connections Rendered Twice

**PixiJS Connection Layer** (`connectionLayer`):
- Rendered via `renderConnections()` in `renderCanvas()` (line 466)
- Uses PixiJS Graphics API
- Renders: bezier curves, arrow heads, source dots, active glow
- **Coordinates**: World coordinates (transformed by stage)

**SVG Connection Overlay**:
- Rendered in JSX (lines 1413-1485)
- Uses SVG `<path>` elements
- Renders: **SAME** bezier curves, arrow heads, source dots, active glow
- **Coordinates**: Screen coordinates (converted from world)

**Result**: 
- ✅ Both layers are visible
- ❌ Same connections drawn twice (wasteful)
- ❌ Potential visual artifacts (overlapping lines)
- ❌ Performance impact (rendering same data twice)

### Why This Happens

The SVG overlay was likely added later for:
- Better arrow rendering (SVG markers are cleaner)
- Easier styling/animations
- But the PixiJS layer was never removed

### Recommendation

**Option 1**: Remove PixiJS connection layer, keep only SVG
- Remove `renderConnections()` call (line 466)
- Keep SVG connections (lines 1413-1485)
- Pros: Cleaner arrows, easier styling
- Cons: SVG rendering may be slower for many connections

**Option 2**: Remove SVG overlay, keep only PixiJS
- Remove SVG connections (lines 1413-1485)
- Keep `renderConnections()` in PixiJS
- Pros: Better performance, single rendering system
- Cons: Need to improve arrow rendering in PixiJS

**Option 3**: Make it configurable
- Add a flag to choose rendering method
- Allow switching between PixiJS and SVG

## Rendering Triggers Summary

| Trigger | Location | Frequency | Purpose |
|---------|----------|-----------|---------|
| **PixiJS Ticker** | Line 352 | Every frame (~60fps) | Primary render loop |
| **useEffect (renderCanvas)** | Line 484 | When dependencies change | React state sync |
| **ResizeObserver** | Line 493 | On container resize | Grid recalculation |
| **Sidebar Toggle** | Line 505 | When sidebar opens/closes | Grid recalculation |
| **React Re-render** | Lines 1413-1485 | On workspace/state changes | SVG overlay update |

## Performance Considerations

1. **PixiJS Ticker**: Runs at ~60fps, calls `renderCanvas()` every frame
   - This is necessary for smooth animations
   - But could be optimized with dirty flags

2. **Double Connection Rendering**: 
   - Same data rendered twice (PixiJS + SVG)
   - Wastes GPU/CPU cycles
   - Should be fixed

3. **Viewport State Loading**:
   - ✅ Loaded once on mount (efficient)
   - ✅ Applied immediately to stage
   - ✅ No double loading

4. **Workspace Loading**:
   - ✅ Loaded once on mount via Zustand
   - ✅ Rendered immediately when available
   - ✅ No double loading

## Logic Flow Diagram

```
App Startup
    ↓
Zustand Persist Middleware
    ↓
Load from localStorage:
  - gigafactory-workspaces
  - gigafactory-viewport
    ↓
Store State Available
    ↓
CanvasRoot Mounts
    ↓
Initialize PixiJS App
    ↓
Load viewportState from store (line 311)
    ↓
Create ViewportController with saved state (line 312)
    ↓
Apply saved state to stage (lines 315-319)
    ↓
Start PixiJS Ticker (line 340)
    ↓
renderCanvas() called every frame (line 352)
    ├─→ renderGrid() → gridLayer
    ├─→ renderConnections() → connectionLayer ⚠️ DOUBLE RENDER
    └─→ renderNodes() → nodeLayer
    ↓
React Re-render (when workspaces/state change)
    ↓
SVG Connections rendered (lines 1413-1485) ⚠️ DOUBLE RENDER
    ↓
HTML Workspace Cards rendered (lines 917-1411)
```

## Conclusion

**LocalStorage Loading**: ✅ Efficient, no double loading
- Workspaces and viewport state loaded once on mount
- Applied immediately during initialization

**Rendering**: ⚠️ **DOUBLE RENDERING of connections**
- PixiJS `connectionLayer` renders connections
- SVG overlay also renders the same connections
- Both are visible and active
- Should remove one or the other

**Recommendation**: Remove the PixiJS connection layer and keep only the SVG overlay for better arrow rendering and styling flexibility.
