# Grid Background & Snap-to-Grid Improvements

## Overview

Enhanced the canvas grid system to provide better visual alignment and snap-to-grid functionality for positioning workspaces.

## Features Implemented

### 1. ✅ Enhanced Grid Rendering

**Before**: Simple dots at grid intersections
**After**: Multi-layer grid system with:
- **Minor grid lines**: Every 40px (GRID_SIZE) - subtle lines for fine alignment
- **Major grid lines**: Every 200px (GRID_MAJOR_SIZE) - bolder lines for orientation
- **Grid dots**: At all intersections for precise alignment points

**Visual Hierarchy**:
- Minor lines: `0x404060` color, 0.2 alpha, 1px width
- Major lines: `0x505070` color, 0.4 alpha, 1.5px width
- Dots: `0x606080` color, 0.4 alpha, 1.5px radius

### 2. ✅ Snap-to-Grid Functionality

**Enabled by default** - Workspaces automatically snap to grid when:
- Creating new workspaces (right-click, N key, or drag)
- Dragging/repositioning workspaces
- Drawing custom-sized workspaces

**Grid Size**: 40px cells (configurable via `GRID_SIZE` constant)

**Snap Function**:
```typescript
const snapPositionToGrid = (x: number, y: number) => {
  return {
    x: Math.round(x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(y / GRID_SIZE) * GRID_SIZE,
  };
};
```

### 3. ✅ Toggle Snap-to-Grid

**Keyboard Shortcut**: Press `G` to toggle snap-to-grid on/off

**Visual Indicators**:
- Hotkey hints show: `G grid ✓` or `G grid ✗`
- Top-left indicator: "Grid snap: ON" when enabled

### 4. ✅ Viewport-Aware Grid

**Optimized Rendering**:
- Grid only renders in visible viewport area
- Automatically adjusts when zooming/panning
- Efficient calculation using world coordinate bounds

**Fallback**: Full grid rendered when viewport not available

## Usage

### Creating Aligned Workspaces

1. **Right-click** anywhere → Workspace snaps to nearest grid point
2. **Press N** → Workspace created at mouse position, snapped to grid
3. **Drag to draw** → Workspace position snaps to grid on release

### Repositioning with Alignment

1. **Right-click workspace** → "Edit Position"
2. **Drag workspace** → Automatically snaps to grid as you move
3. **Release** → Workspace stays aligned to grid

### Toggle Grid Snap

- Press **`G`** to toggle snap-to-grid
- Indicator shows current state
- When OFF, workspaces can be positioned freely

## Grid Configuration

### Constants

```typescript
const GRID_SIZE = 40;           // Minor grid cell size (px)
const GRID_MAJOR_SIZE = 200;    // Major grid line interval (5 cells)
```

### Customization

To change grid size, modify constants at top of `CanvasRoot.tsx`:
- `GRID_SIZE`: Controls snap granularity and minor grid spacing
- `GRID_MAJOR_SIZE`: Controls major grid line frequency

## Visual Design

### Grid Layers (from back to front)

1. **Minor Grid Lines** (40px intervals)
   - Subtle gray lines
   - Helps with fine alignment
   - Always visible

2. **Major Grid Lines** (200px intervals)
   - More prominent gray lines
   - Helps with orientation
   - Easier to see at distance

3. **Grid Dots** (at all intersections)
   - Small dots for precise alignment
   - Visible at all zoom levels
   - Helps identify exact grid points

### Color Scheme

- Minor lines: `#404060` (dark gray-blue)
- Major lines: `#505070` (medium gray-blue)
- Dots: `#606080` (lighter gray-blue)
- All with appropriate alpha for subtlety

## Benefits

### 1. **Easy Alignment**
- Workspaces automatically align to grid
- No manual pixel-perfect positioning needed
- Consistent spacing between workspaces

### 2. **Visual Organization**
- Clear grid structure helps organize layouts
- Major lines provide orientation reference
- Easy to see workspace relationships

### 3. **Professional Appearance**
- Clean, organized canvas
- Consistent spacing
- Easy to read and navigate

### 4. **Flexible Control**
- Toggle snap on/off with `G` key
- Free positioning when snap disabled
- Grid always visible for reference

## Technical Details

### Snap-to-Grid Implementation

**Function**: `snapPositionToGrid(x, y)`
- Rounds coordinates to nearest grid cell
- Respects `snapToGrid` state
- Returns snapped coordinates

**Applied To**:
- Workspace creation (all methods)
- Workspace dragging/repositioning
- Custom workspace drawing

### Grid Rendering Optimization

**Viewport Culling**:
- Only renders grid in visible area
- Calculates world bounds from viewport
- Efficient for large canvases

**Performance**:
- Grid lines drawn once per frame
- No caching needed (lines are simple)
- Scales well with zoom level

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `G` | Toggle snap-to-grid |

## Visual Indicators

1. **Hotkey Hints** (bottom-left)
   - Shows `G grid ✓` when enabled
   - Shows `G grid ✗` when disabled

2. **Grid Snap Indicator** (top-left)
   - "Grid snap: ON" when enabled
   - Hidden when disabled

## Future Enhancements (Optional)

1. **Grid Size Presets**: Quick switch between 20px, 40px, 80px
2. **Alignment Guides**: Show alignment lines when dragging near other workspaces
3. **Grid Opacity Control**: Adjustable grid visibility
4. **Custom Grid Colors**: User-configurable grid appearance
5. **Smart Alignment**: Auto-align to nearby workspaces in addition to grid

## Files Modified

- `src/canvas/CanvasRoot.tsx`
  - Added grid constants
  - Enhanced grid rendering with lines
  - Added snap-to-grid function
  - Integrated snap in all workspace operations
  - Added toggle shortcut and indicators

## Testing Checklist

- ✅ Grid lines visible at all zoom levels
- ✅ Major/minor grid lines render correctly
- ✅ Grid dots appear at intersections
- ✅ Snap-to-grid works when creating workspaces
- ✅ Snap-to-grid works when dragging workspaces
- ✅ Toggle (G key) works correctly
- ✅ Visual indicators update properly
- ✅ Grid renders efficiently in viewport

---

*Last Updated: January 2026*
