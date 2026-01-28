# Rendering Optimization Plan

## Current Issues

### 1. Double Rendering of Connections
- **PixiJS `connectionLayer`**: Renders connections via `renderConnections()` (line 466)
- **SVG Overlay**: Also renders same connections (lines 1413-1485)
- **Impact**: Performance waste, potential visual artifacts

### 2. Double Rendering of Nodes
- **PixiJS `nodeLayer`**: Renders workspace rectangles, borders, selection effects, agent circles (via `renderNodes()`)
- **HTML Divs**: Render full interactive workspace cards with UI (lines 917-1411)
- **Impact**: Overlapping visuals, unnecessary rendering

### 3. Missing Interactive Features in PixiJS
- **Wiring Preview**: Currently rendered as SVG (lines 1487-1555)
- **Dynamic Updates**: Connections need to update when nodes move

## Solution Plan: Keep PixiJS, Remove SVG, Optimize Nodes

### Phase 1: Remove SVG Connections ✅

**Files to modify**: `src/canvas/CanvasRoot.tsx`

**Changes**:
1. Remove SVG connection overlay (lines 1413-1485)
2. Keep PixiJS `connectionLayer` as the single source of truth
3. Connections will automatically update when workspace positions change (they read from `workspaces` state)

**Benefits**:
- Single rendering system for connections
- Better performance
- Consistent coordinate system (world coordinates)

### Phase 2: Add Wiring Preview to PixiJS ✅

**Files to modify**: 
- `src/lib/canvas/ConnectionRenderer.ts` - Add wiring preview rendering
- `src/canvas/CanvasRoot.tsx` - Pass wiring state to renderer

**Changes**:
1. Extend `renderConnections()` to accept optional wiring state
2. Render temporary wiring line in PixiJS when `wiring.isWiring === true`
3. Use same styling as SVG wiring (cyan color, animated dots)
4. Remove SVG wiring preview (lines 1487-1555)

**Implementation**:
```typescript
// In ConnectionRenderer.ts
export function renderConnections(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  wiring?: { isWiring: boolean; fromWorkspaceId?: string; fromType?: 'input' | 'output'; mouseX?: number; mouseY?: number },
  viewport?: ViewportController | null,
  options?: ConnectionRendererOptions
): void {
  // ... existing connection rendering ...
  
  // Render wiring preview if active
  if (wiring?.isWiring && wiring.fromWorkspaceId) {
    const fromWs = workspaces[wiring.fromWorkspaceId];
    if (fromWs && viewport) {
      // Convert mouse position from screen to world coordinates
      const worldMouse = viewport.screenToWorld(wiring.mouseX || 0, wiring.mouseY || 0);
      
      // Calculate start point
      const fromX = wiring.fromType === 'output' 
        ? fromWs.x + fromWs.width 
        : fromWs.x;
      const fromY = fromWs.y + fromWs.height / 2;
      
      // Draw wiring preview line
      graphics.setStrokeStyle({
        width: 5,
        color: 0x22d3ee, // cyan
        alpha: 1,
      });
      
      const controlOffset = wiring.fromType === 'output' ? 80 : -80;
      graphics.moveTo(fromX, fromY);
      graphics.bezierCurveTo(
        fromX + controlOffset,
        fromY,
        worldMouse.x + (wiring.fromType === 'output' ? -80 : 80),
        worldMouse.y,
        worldMouse.x,
        worldMouse.y
      );
      graphics.stroke();
      
      // Draw arrow at end
      graphics.setFillStyle({ color: 0x22d3ee, alpha: 1 });
      graphics.moveTo(worldMouse.x, worldMouse.y);
      graphics.lineTo(worldMouse.x - 12, worldMouse.y - 4.5);
      graphics.lineTo(worldMouse.x - 12, worldMouse.y + 4.5);
      graphics.closePath();
      graphics.fill();
      
      // Draw start dot
      graphics.circle(fromX, fromY, 8);
      graphics.fill();
    }
  }
}
```

### Phase 3: Optimize Node Rendering ⚠️

**Problem**: Both PixiJS and HTML render nodes, causing overlap.

**Options**:

#### Option A: Keep PixiJS for Visual Effects Only (Recommended)
- **PixiJS `nodeLayer`**: Render only visual effects (selection glow, agent circles)
- **HTML Divs**: Keep for interactivity (UI, inputs, buttons)
- **Benefit**: Best of both worlds - visual effects + interactivity
- **Implementation**: Make PixiJS rectangles transparent/remove fill, keep only effects

#### Option B: Remove PixiJS Node Layer Entirely
- **Remove**: `renderNodes()` call (line 472)
- **Keep**: Only HTML divs
- **Benefit**: Single rendering system
- **Drawback**: Lose selection glow effects, agent circles (would need to add to HTML)

#### Option C: Make PixiJS Optional
- Add flag to enable/disable PixiJS node rendering
- Default: disabled (use HTML only)
- Enable for performance testing or specific use cases

**Recommended: Option A** - Keep visual effects in PixiJS, UI in HTML

**Implementation**:
```typescript
// In NodeRenderer.ts - Modify to render only effects
export function renderNodes(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  agents: Record<string, Agent>,
  selectedWorkspaceId: string | null,
  options: NodeRendererOptions = {}
): void {
  graphics.clear();

  // Don't render workspace rectangles (handled by HTML)
  // Only render visual effects:
  
  Object.values(workspaces).forEach((workspace) => {
    const isSelected = selectedWorkspaceId === workspace.id;
    
    // Draw selection effects only (glow, border highlight)
    if (isSelected) {
      // Outer glow
      graphics.setStrokeStyle({
        width: selectedGlowWidth,
        color: 0xffd700,
        alpha: selectedGlowAlpha,
      });
      graphics.rect(/* ... */);
      graphics.stroke();
      
      // Selection border highlight
      graphics.setStrokeStyle({
        width: selectedBorderWidth,
        color: 0xffd700,
        alpha: selectedBorderAlpha,
      });
      graphics.rect(/* ... */);
      graphics.stroke();
    }

    // Draw agent indicator circle (if workspace has agent)
    const agent = workspace.agentId ? agents[workspace.agentId] : null;
    if (agent) {
      const cx = workspace.x + workspace.width / 2;
      const cy = workspace.y + workspace.height / 2;
      
      graphics.setFillStyle({ color: 0x1a1a2e, alpha: agentCircleFillAlpha });
      graphics.circle(cx, cy, agentCircleRadius);
      graphics.fill();
      
      graphics.setStrokeStyle({
        width: agentCircleStrokeWidth,
        color: colors.border,
        alpha: agentCircleStrokeAlpha,
      });
      graphics.circle(cx, cy, agentCircleRadius);
      graphics.stroke();
    }
  });
}
```

### Phase 4: Handle Dynamic Updates ✅

**Current State**: Connections already update automatically because:
- `renderCanvas()` is called every frame via PixiJS ticker (line 352)
- `renderConnections()` reads from `workspaces` state
- When workspace positions change, next frame will render updated connections

**Enhancement**: Add dirty flag optimization
- Only re-render connections when workspace positions actually change
- Track previous positions and compare

**Implementation** (optional optimization):
```typescript
// Track previous workspace positions
const prevWorkspacePositions = useRef<Record<string, { x: number; y: number }>>({});

// In renderCanvas, check if positions changed
const positionsChanged = Object.values(workspaces).some(ws => {
  const prev = prevWorkspacePositions.current[ws.id];
  if (!prev || prev.x !== ws.x || prev.y !== ws.y) {
    prevWorkspacePositions.current[ws.id] = { x: ws.x, y: ws.y };
    return true;
  }
  return false;
});

// Only re-render connections if positions changed
if (positionsChanged) {
  renderConnections(connectionLayer, workspaces, wiring, viewportRef.current);
}
```

## Implementation Steps

### Step 1: Remove SVG Connections
1. Delete SVG connection overlay (lines 1413-1485 in CanvasRoot.tsx)
2. Test: Verify connections still render via PixiJS

### Step 2: Add Wiring Preview to PixiJS
1. Modify `ConnectionRenderer.ts` to accept wiring state
2. Add wiring preview rendering logic
3. Update `CanvasRoot.tsx` to pass wiring state to renderer
4. Remove SVG wiring preview (lines 1487-1555)
5. Test: Verify wiring preview works in PixiJS

### Step 3: Optimize Node Rendering
1. Modify `NodeRenderer.ts` to render only effects (no rectangles)
2. Keep HTML divs for interactivity
3. Test: Verify selection effects and agent circles still visible

### Step 4: Test Dynamic Updates
1. Move a workspace
2. Verify connections update immediately
3. Verify no visual glitches

## Expected Results

### Before
- ❌ Connections rendered twice (PixiJS + SVG)
- ❌ Nodes rendered twice (PixiJS rectangles + HTML divs)
- ❌ Wiring preview in SVG only
- ✅ Connections update when nodes move (already working)

### After
- ✅ Connections rendered once (PixiJS only)
- ✅ Nodes: Visual effects in PixiJS, UI in HTML (no overlap)
- ✅ Wiring preview in PixiJS (consistent with connections)
- ✅ Connections update when nodes move (automatic via ticker)

## Performance Impact

**Expected Improvements**:
- **~50% reduction** in connection rendering (remove SVG)
- **~30% reduction** in node rendering (remove PixiJS rectangles)
- **Better frame rate** with fewer draw calls
- **Consistent coordinate system** (all PixiJS uses world coordinates)

## Files to Modify

1. `src/canvas/CanvasRoot.tsx`
   - Remove SVG connections (lines 1413-1485)
   - Remove SVG wiring (lines 1487-1555)
   - Pass wiring state to `renderConnections()`
   - Update `renderCanvas()` to include wiring

2. `src/lib/canvas/ConnectionRenderer.ts`
   - Add wiring parameter
   - Add wiring preview rendering
   - Handle screen-to-world coordinate conversion

3. `src/lib/canvas/NodeRenderer.ts`
   - Remove workspace rectangle rendering
   - Keep only visual effects (selection glow, agent circles)

## Testing Checklist

- [ ] Connections render correctly (PixiJS only)
- [ ] Wiring preview works when dragging from port
- [ ] Connections update when workspace moves
- [ ] Selection effects visible (glow, border)
- [ ] Agent circles visible
- [ ] No visual artifacts or overlaps
- [ ] Performance improved (check FPS)
- [ ] Workspace cards still interactive (HTML)
