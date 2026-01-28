# Canvas Layer Architecture

## PixiJS Rendering Layers

| Layer | Type | What It Renders | Rendering Area | Connection Arrows |
|-------|------|-----------------|----------------|-------------------|
| **gridLayer** | `Graphics` (PixiJS) | • Minor grid lines (1px, gray, 20% opacity)<br>• Major grid lines (1.5px, gray, 40% opacity)<br>• Grid dots at intersections (1.5px radius) | Viewport-aware culling:<br>• Only renders visible grid cells<br>• Calculates bounds from viewport + container<br>• Uses world coordinates<br>• Falls back to 2000x2000 area if viewport unavailable | ❌ No |
| **connectionLayer** | `Graphics` (PixiJS) | • Bezier curves connecting workspaces<br>• **Arrow heads** at connection endpoints (triangular, 10px size)<br>• Source dots (6px radius) at connection start points<br>• Active glow effect (8px width, 20% opacity) when workspace is working | World coordinates:<br>• From: `workspace.x + workspace.width, workspace.y + workspace.height/2`<br>• To: `workspace.x, workspace.y + workspace.height/2`<br>• Bezier control offset: `min(100, distance/2)` | ✅ **Yes** - Renders arrow heads at destination workspaces |
| **nodeLayer** | `Graphics` (PixiJS) | • Workspace rectangles (fill + border)<br>• Selection effects (glow, border, fill highlight)<br>• Agent indicator circles (28px radius) when workspace has agent<br>• Drawing preview rectangle (when creating new workspace) | World coordinates:<br>• Workspace position: `workspace.x, workspace.y`<br>• Workspace size: `workspace.width, workspace.height`<br>• Agent circle: center of workspace<br>• Drawing preview: from start to current mouse position | ❌ No |

## Layer Order (Bottom to Top)

1. **gridLayer** (bottom) - Background grid
2. **connectionLayer** (middle) - Connection lines and arrows
3. **nodeLayer** (top) - Workspace nodes and overlays

## Additional Rendering (Not in PixiJS Layers)

- **SVG Connections** (HTML overlay, z-index: 25): Also renders connection lines with arrows, but uses screen coordinates and is separate from PixiJS layers
- **Wiring Preview** (HTML SVG, z-index: 9999): Temporary connection line when wiring mode is active
- **Workspace Cards** (HTML divs): The actual workspace UI cards positioned absolutely

## ⚠️ Double Rendering Issue

**Problem**: Connections are rendered **twice**:
1. **PixiJS `connectionLayer`** (via `renderConnections()` at line 466)
2. **SVG overlay** (lines 1413-1485)

Both render the same connections with arrows, causing:
- Performance waste (rendering same data twice)
- Potential visual artifacts (overlapping lines)
- Unnecessary GPU/CPU usage

**Recommendation**: Remove one or the other. See `RENDERING_FLOW_ANALYSIS.md` for details.

## Key Functions

- `renderGrid()` - Renders grid with viewport culling
- `renderConnections()` - Renders connection lines with **arrow heads** in connectionLayer
- `renderNodes()` - Renders workspace rectangles and effects
- `renderDrawingPreview()` - Renders preview rectangle when drawing

## Coordinate Systems

- **World Coordinates**: Used by all PixiJS layers (gridLayer, connectionLayer, nodeLayer)
- **Screen Coordinates**: Used by HTML overlays (SVG connections, workspace cards)
- **Viewport Transform**: Applied to PixiJS stage, automatically converts world → screen for rendering
