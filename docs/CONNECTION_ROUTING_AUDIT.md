# Workspace Connection Routing Audit

**Date:** January 28, 2026  
**Purpose:** Comprehensive audit of how connections between workspace outputs and inputs are created, stored, routed, and rendered.

---

## Table of Contents
1. [Connection Data Structure](#connection-data-structure)
2. [Connection Creation Flow](#connection-creation-flow)
3. [Routing Algorithms](#routing-algorithms)
4. [Rendering Pipeline](#rendering-pipeline)
5. [Connection Point Calculation](#connection-point-calculation)
6. [Routing Decision Tree](#routing-decision-tree)
7. [Configuration Constants](#configuration-constants)

---

## Connection Data Structure

### Workspace Connection Fields

| Field | Type | Location | Description |
|-------|------|----------|-------------|
| `outputConnections` | `string[]` | `Workspace.outputConnections` | Array of workspace IDs that this workspace feeds TO (outputs) |
| `inputConnections` | `string[]` | `Workspace.inputConnections` | Array of workspace IDs that feed INTO this workspace (inputs) |
| Connection Direction | Implicit | Derived from arrays | One-way: Output → Input (unidirectional) |

### Storage Location

| Component | File | Purpose |
|-----------|------|---------|
| **Data Store** | `src/stores/workspaces.ts` | Zustand store with Immer middleware, persisted to localStorage |
| **Type Definition** | `src/types/workspace.ts` | TypeScript interface definitions |
| **Graph Model** | `src/lib/graph/GraphModel.ts` | Alternative graph-based connection model (for export/import) |

### Connection Relationship

```
Workspace A (output) → Workspace B (input)
  - A.outputConnections = [B.id]
  - B.inputConnections = [A.id]
```

---

## Connection Creation Flow

### Creation Methods

| Method | Location | Trigger | Action |
|--------|----------|---------|--------|
| `connectWorkspaces(fromId, toId)` | `src/stores/workspaces.ts:227` | User wiring action | Adds bidirectional references |
| Wiring UI | `src/canvas/CanvasRoot.tsx` | Mouse drag from workspace port | Interactive connection creation |
| Panel UI | `src/components/panels/WorkspacePanel.tsx` | Dropdown selection | Manual connection via UI |

### Connection Creation Process

| Step | Component | Action | Validation |
|------|-----------|--------|------------|
| 1 | User Action | Click workspace output port | Workspace exists |
| 2 | Wiring State | `startWiring(fromWorkspaceId, fromType)` | Valid workspace ID |
| 3 | Mouse Tracking | Track mouse position during drag | Viewport coordinates |
| 4 | Target Detection | Detect workspace under mouse | Workspace exists, not same as source |
| 5 | Connection Creation | `connectWorkspaces(fromId, toId)` | No duplicate check |
| 6 | State Update | Update both workspaces' arrays | Bidirectional sync |

### Code Flow

```typescript
// 1. Start wiring (CanvasRoot.tsx)
startWiring(workspaceId, 'output')

// 2. During drag, track mouse
wiring.mouseX, wiring.mouseY

// 3. On drop/click target workspace
connectWorkspaces(fromId, toId)

// 4. Store update (workspaces.ts:227)
fromWs.outputConnections.push(toId)  // Add to output
toWs.inputConnections.push(fromId)    // Add to input
```

### Duplicate Prevention

| Check | Location | Logic |
|-------|----------|-------|
| Duplicate Output | `workspaces.ts:233` | `if (!fromWs.outputConnections.includes(toId))` |
| Duplicate Input | `workspaces.ts:236` | `if (!toWs.inputConnections.includes(fromId))` |

---

## Routing Algorithms

### Routing Strategy Decision

| Condition | Algorithm | File | Function |
|----------|-----------|------|----------|
| **Forward** (destination.x > source.x) | Simple Cubic Bézier | `ConnectionRenderer.ts:347` | Direct control points |
| **Backward** (destination.x < source.x) | Hybrid Step-Bump | `BezierRouter.ts:876` | A* + Hybrid curves |
| **Direct Path Available** | Direct Path | `BezierRouter.ts:125` | Horizontal-first with curve |

### Forward Routing (Simple)

| Parameter | Calculation | Value |
|-----------|-------------|-------|
| Start Point | `fromX = ws.x + ws.width` | Right edge of source |
| End Point | `toX = ws.x - arrowSize` | Left edge of target (minus arrow) |
| Control 1 | `fromX + min(100, distance/2)` | Horizontal offset |
| Control 2 | `toX - min(100, distance/2)` | Horizontal offset |
| Curve Type | Cubic Bézier | Smooth S-curve |

**Formula:**
```
cp1 = (fromX + offset, fromY)
cp2 = (toX - offset, toY)
```

### Backward Routing (Hybrid Step-Bump)

#### Phase 1: A* Pathfinding

| Component | Value | Purpose |
|-----------|-------|---------|
| Grid Size | 40px | A* search resolution |
| Start Node | Destination | Backward routing (dest → source) |
| Goal Node | Source | Target of A* search |
| Max Iterations | 1000 | Prevent infinite loops |
| Heuristic | Manhattan Distance | `|x1-x2| + |y1-y2|` |
| Movement Cost | Base + Direction Penalty + Clearance Penalty | Optimize path quality |

**A* Cost Calculation:**
```
baseCost = |dx| + |dy|
directionPenalty = 10 (if direction change)
clearancePenalty = 50 * proximityFactor (if near obstacles)
totalCost = baseCost + directionPenalty + clearancePenalty
```

#### Phase 2: Segment Classification

| Segment Type | Clearance Range | Routing Strategy |
|--------------|-----------------|------------------|
| **CRITICAL** | < 32px (0.4 × threshold) | Step routing (axis-aligned) |
| **TRANSITION** | 32px - 80px | Blended (step + bump) |
| **FREE** | > 80px | Bump routing (smooth curves) |

**Classification Logic:**
```typescript
minClearance = min(segmentWorkspaceDistance(segment, allWorkspaces))
if (minClearance < 32) → CRITICAL
else if (minClearance < 80) → TRANSITION
else → FREE
```

#### Phase 3: Hybrid Curve Generation

| Segment Type | Command Type | Control Points |
|--------------|--------------|----------------|
| **CRITICAL** | Line segments (L) | Axis-aligned waypoints |
| **FREE** | Cubic Bézier (C) | Smooth S-curve with horizontal tangents |
| **TRANSITION** | Mixed (L + C) | Step start + curved end |

**Step Segment (CRITICAL):**
- Horizontal-first principle for backward connections
- Creates: `L(horizontal) → L(vertical) → L(horizontal)`

**Bump Segment (FREE):**
- Control points: `cp1 = (x1 + 0.3*dx, y1 + 0.7*curveHeight)`
- Control points: `cp2 = (x2 - 0.3*dx, y2 - 0.7*curveHeight)`
- Curve height: `min(dy*0.5, dx*0.3)` clamped to [20, 80]

**Blended Segment (TRANSITION):**
- Blend factor: `clearance / CLEARANCE_THRESHOLD`
- < 0.3: Pure step
- 0.3-0.7: Hybrid (short line + curve)
- > 0.7: Pure bump

### Direct Path Routing

| Condition | Path Strategy |
|-----------|--------------|
| No obstacles in path | Direct horizontal-first curve |
| Horizontal Buffer | 60px minimum horizontal extension |
| Vertical Buffer | 40px minimum vertical clearance |

**Direct Path Control Points:**
```
1. Start point
2. Horizontal buffer point (start.x ± 60px, start.y)
3. Curve control 1 (horizontal point + vertical offset)
4. Midpoint control (midX, start.y + curveHeight)
5. Curve control 2 (end.x, end.y - vertical offset)
6. End point
```

---

## Rendering Pipeline

### Rendering Flow

| Step | Component | Action |
|------|-----------|--------|
| 1 | `CanvasRoot.tsx` | Calls `renderConnections()` |
| 2 | `ConnectionRenderer.ts` | Iterates `workspaces[].outputConnections` |
| 3 | Calculate Points | Source: `(x + width, y + height/2)`, Target: `(x, y + height/2)` |
| 4 | Routing Decision | Check `isBackward = destination.x < source.x` |
| 5 | Route Calculation | Call `routeBezierCurve()` or use simple routing |
| 6 | Convert to Segments | `bezierToCubicSegments()` for complex routes |
| 7 | Render Graphics | PIXI.js `bezierCurveTo()` calls |
| 8 | Debug Overlay | `renderDebugControlPoints()` if enabled |

### Rendering Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Active Glow** | Visual feedback for working state | 8px width, 0.2 alpha |
| **Connection Line** | Main bezier curve | 3px width, 0.6 alpha (1.0 if active) |
| **Arrow** | Direction indicator | 10px triangle at target |
| **Source Dot** | Origin marker | 6px circle at source |
| **Debug Points** | Control point visualization | Red circles, yellow waypoints |

### Viewport Culling

| Check | Logic | Purpose |
|-------|-------|---------|
| Visibility | `isPointVisible(point, visibleBounds)` | Skip rendering off-screen connections |
| Performance | Only render if at least one endpoint visible | Reduce draw calls |

---

## Connection Point Calculation

### Source Point (Output Port)

| Coordinate | Calculation | Notes |
|------------|-------------|-------|
| X | `workspace.x + workspace.width` | Right edge of workspace |
| Y | `workspace.y + workspace.height / 2` | Vertical center |

### Destination Point (Input Port)

| Coordinate | Calculation | Notes |
|------------|-------------|-------|
| X | `workspace.x - arrowSize` | Left edge minus arrow (10px) |
| Y | `workspace.y + workspace.height / 2` | Vertical center |

### Coordinate System

| System | Usage | Conversion |
|--------|-------|------------|
| **World Coordinates** | All calculations | Direct use |
| **Screen Coordinates** | Viewport transform | PIXI stage handles conversion |
| **Viewport** | Pan/zoom | `ViewportController` manages transform |

---

## Routing Decision Tree

```
Connection Request
│
├─ Calculate: horizontalDistance = toX - fromX
│
├─ isBackward? (horizontalDistance < 0)
│  │
│  ├─ YES → Use Hybrid Step-Bump Router
│  │  │
│  │  ├─ Check: hasDirectPath(start, end, workspaces)?
│  │  │  │
│  │  │  ├─ YES → generateDirectPath()
│  │  │  │  └─ Return: 6 control points (horizontal-first)
│  │  │  │
│  │  │  └─ NO → hybridStepBumpRoute()
│  │  │     │
│  │  │     ├─ Phase 1: backwardAStarSearch()
│  │  │     │  └─ Return: waypoints array
│  │  │     │
│  │  │     ├─ Phase 2: classifySegments()
│  │  │     │  └─ Return: CRITICAL, FREE, or TRANSITION
│  │  │     │
│  │  │     ├─ Phase 3: generateHybridCurve()
│  │  │     │  └─ Return: PathCommand[] (L or C commands)
│  │  │     │
│  │  │     └─ Convert: commandsToControlPoints()
│  │  │        └─ Return: BezierRoute with controlPoints[]
│  │  │
│  │  └─ Convert: bezierToCubicSegments()
│  │     └─ Return: Array<{cp1, cp2, end}>
│  │
│  └─ NO → Use Simple Forward Routing
│     │
│     └─ Calculate: controlOffset = min(100, distance/2)
│        └─ Return: Simple cubic bezier with 2 control points
│
└─ Render: PIXI.js bezierCurveTo() for each segment
```

---

## Configuration Constants

### BezierRouter Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_CLEARANCE` | 30px | Minimum distance from workspaces |
| `GRID_SIZE` | 40px | A* search grid resolution |
| `CLEARANCE_THRESHOLD` | 80px | Segment classification threshold |
| `STEP_T` | 0.5 | Step transition point (0-1) |
| `MAX_ASTAR_ITERATIONS` | 1000 | A* max iterations |
| `HORIZONTAL_BUFFER` | 60px | Minimum horizontal distance before bending |
| `VERTICAL_BUFFER` | 40px | Minimum vertical clearance |

### ConnectionRenderer Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `lineWidth` | 3px | Connection line thickness |
| `lineAlpha` | 0.6 | Inactive line opacity |
| `activeGlowWidth` | 8px | Active state glow width |
| `activeGlowAlpha` | 0.2 | Active state glow opacity |
| `arrowSize` | 10px | Arrow triangle size |
| `dotRadius` | 6px | Source dot radius |

---

## Key Functions Reference

### Connection Management

| Function | File | Purpose |
|----------|------|---------|
| `connectWorkspaces(fromId, toId)` | `workspaces.ts:227` | Create bidirectional connection |
| `disconnectWorkspaces(fromId, toId)` | `workspaces.ts:243` | Remove connection |
| `getInputsForWorkspace(id)` | `workspaces.ts:256` | Get input workspaces with outputs |
| `getDownstreamWorkspaces(id)` | `workspaces.ts:267` | Get output workspace IDs |

### Routing Functions

| Function | File | Purpose |
|----------|------|---------|
| `routeBezierCurve(start, dest, workspaces)` | `BezierRouter.ts:876` | Main routing entry point |
| `hasDirectPath(start, end, workspaces)` | `BezierRouter.ts:74` | Check for obstacle-free path |
| `generateDirectPath(start, end)` | `BezierRouter.ts:125` | Create simple direct route |
| `hybridStepBumpRoute(dest, source, workspaces)` | `BezierRouter.ts:746` | Complex routing algorithm |
| `backwardAStarSearch(dest, source, workspaces)` | `BezierRouter.ts:267` | A* pathfinding |
| `classifySegments(waypoints, workspaces)` | `BezierRouter.ts:505` | Segment classification |
| `generateHybridCurve(segments, isBackward)` | `BezierRouter.ts:682` | Generate curve commands |
| `commandsToControlPoints(commands, start)` | `BezierRouter.ts:710` | Convert commands to points |
| `bezierToCubicSegments(controlPoints)` | `BezierRouter.ts:887` | Convert to renderable segments |

### Rendering Functions

| Function | File | Purpose |
|----------|------|---------|
| `renderConnections(graphics, workspaces, ...)` | `ConnectionRenderer.ts:181` | Main rendering entry |
| `renderDebugControlPoints(graphics, route, ...)` | `ConnectionRenderer.ts:47` | Debug visualization |

---

## Data Flow Summary

```
User Action (Wiring)
    ↓
connectWorkspaces(fromId, toId)
    ↓
Store Update (Zustand + Immer)
    ├─ fromWs.outputConnections.push(toId)
    └─ toWs.inputConnections.push(fromId)
    ↓
Persist to localStorage
    ↓
Canvas Render Cycle
    ↓
renderConnections()
    ├─ Iterate: workspaces[].outputConnections
    ├─ Calculate: source/dest points
    ├─ Route: routeBezierCurve() or simple routing
    ├─ Convert: bezierToCubicSegments()
    └─ Render: PIXI.js graphics
```

---

## Debug Features

### Debug Control Points

| Feature | Color | Purpose |
|---------|-------|---------|
| Start Point | Green (0x4ade80) | Connection origin |
| Control Points | Red (0xff6b6b) | Bézier control points |
| End Point | Blue (0x3b82f6) | Connection destination |
| Waypoints | Yellow (0xfbbf24) | A* pathfinding waypoints |
| Segment Types | Red/Green/Amber | CRITICAL/FREE/TRANSITION |

**Enable:** Set `showDebugControlPoints: true` in `ConnectionRendererOptions`

---

## Performance Optimizations

| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| Viewport Culling | Skip off-screen connections | Reduce draw calls |
| Batched Graphics | Group same-style operations | Reduce state changes |
| Grid-based A* | 40px grid resolution | Faster pathfinding |
| Waypoint Simplification | Remove unnecessary points | Fewer curve segments |
| Lazy Execution Order | Compute on-demand | Reduce computation |

---

## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| No cycle detection | Can create circular dependencies | Manual validation |
| No connection labels | All connections look identical | Use workspace names |
| No connection editing | Must delete and recreate | N/A |
| Single output port | One connection per output | Multiple workspaces if needed |
| No connection validation | Can connect to self | UI prevents this |

---

## Future Improvements

1. **Connection Labels**: Add text labels to connections
2. **Connection Types**: Support different connection types (data, control, etc.)
3. **Connection Validation**: Prevent cycles, validate types
4. **Connection Editing**: Edit connection properties without recreation
5. **Multi-port Support**: Multiple input/output ports per workspace
6. **Connection Animation**: Animate data flow along connections
7. **Connection Groups**: Group related connections visually

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026
