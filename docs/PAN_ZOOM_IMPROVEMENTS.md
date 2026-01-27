# Pan & Zoom Improvements - Classic Behavior

## Overview

Implemented classic pan and zoom behavior for the canvas:
- **Zoom**: Mouse wheel zooms in/out centered on mouse pointer position
- **Pan**: Right-click drag to pan, release to end

## Features

### 1. ✅ Mouse Wheel Zoom (Classic)

**Behavior**:
- Scroll **up** (deltaY < 0) = Zoom **in**
- Scroll **down** (deltaY > 0) = Zoom **out**
- Zoom is **centered on mouse pointer position**
- Smooth zooming with 1.1x zoom factor per scroll step

**Implementation**:
```typescript
const handleWheel = (e: React.WheelEvent) => {
  const x = e.clientX - rect.left;  // Mouse X relative to container
  const y = e.clientY - rect.top;    // Mouse Y relative to container
  viewportRef.current.zoom(zoomDelta, x, y);  // Zoom at mouse position
};
```

**Zoom Range**:
- Minimum: 0.1x (10% zoom)
- Maximum: 5x (500% zoom)
- Default: 1x (100% zoom)

### 2. ✅ Right-Click Drag Pan (Classic)

**Behavior**:
- **Hold right mouse button** and drag to pan
- **Release** to end panning
- Cursor changes to "grabbing" while panning
- Smooth panning with immediate response

**Smart Context Menu**:
- **Right-click drag** = Pan (no context menu)
- **Right-click click** (no drag) = Context menu or create workspace
- Detects drag vs click by movement threshold (5px)

**Implementation**:
```typescript
// On right-click down
if (e.button === 2) {
  panningRef.current = { isPanning: true, startX: x, startY: y };
  rightClickStartRef.current = { x, y, time: Date.now() };
}

// On pointer move
if (panningRef.current?.isPanning) {
  viewportRef.current.pan(dx, dy);
}

// On right-click up
if (wasDrag) {
  // Just panning, no menu
} else {
  // Show context menu or create workspace
}
```

### 3. ✅ Alternative Pan Methods

**Still Supported**:
- **Space + Drag**: Hold Space and drag to pan
- **Middle Mouse**: Hold middle mouse button and drag to pan

These are alternative methods for users who prefer them.

## Usage

### Zooming

1. **Position mouse** where you want to zoom in/out
2. **Scroll wheel up** to zoom in
3. **Scroll wheel down** to zoom out
4. Zoom centers on mouse position

**Example**:
- Mouse over a workspace → Scroll up → Zooms in toward that workspace
- Mouse over empty space → Scroll up → Zooms in toward that area

### Panning

1. **Hold right mouse button** down
2. **Drag** mouse in any direction
3. **Release** to stop panning

**Example**:
- Right-click and drag right → Canvas pans right
- Right-click and drag down → Canvas pans down

### Context Menu (Right-Click Click)

1. **Right-click** (quick, no drag) on workspace → Shows context menu
2. **Right-click** (quick, no drag) on empty space → Creates workspace

**Note**: If you drag while right-clicking, it pans instead of showing menu.

## Technical Details

### Zoom Implementation

**ViewportController.zoomAt()**:
- Calculates zoom delta
- Adjusts viewport position to keep zoom center point fixed
- Formula: `newPos = center - (center - oldPos) * scaleDelta`

**Coordinate System**:
- Mouse position converted to container-relative coordinates
- Viewport applies zoom transform to Pixi stage
- World coordinates remain unchanged (workspaces don't move)

### Pan Implementation

**ViewportController.pan()**:
- Adds delta to current viewport position
- Updates Pixi stage position
- Smooth, immediate response

**Drag Detection**:
- Tracks start position on right-click down
- Compares to end position on right-click up
- If moved > 5px = drag (pan)
- If moved < 5px = click (context menu)

### Cursor Feedback

- **Default**: `crosshair`
- **Panning**: `grabbing`
- **Space pressed**: `grab`
- Updates in real-time based on interaction state

## Benefits

### 1. **Intuitive Navigation**
- Classic behavior users expect
- Right-click drag is standard in design tools
- Mouse wheel zoom is universal

### 2. **Precise Zooming**
- Zoom centered on mouse = zoom where you're looking
- No need to reposition after zooming
- Natural workflow

### 3. **Efficient Panning**
- Right-click drag is fast and natural
- No keyboard required
- Works at any zoom level

### 4. **Smart Context Menu**
- Doesn't interfere with panning
- Still accessible with quick right-click
- Best of both worlds

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `0` | Reset viewport (zoom & pan) |
| `Space` + Drag | Alternative pan method |
| `Wheel` | Zoom in/out |

## Mouse Controls

| Action | Behavior |
|-------|----------|
| **Wheel Up** | Zoom in (centered on mouse) |
| **Wheel Down** | Zoom out (centered on mouse) |
| **Right-Click Drag** | Pan canvas |
| **Right-Click Click** | Context menu / Create workspace |
| **Middle Mouse Drag** | Pan canvas (alternative) |

## Visual Feedback

1. **Cursor Changes**:
   - Normal: Crosshair
   - Panning: Grabbing hand
   - Space pressed: Grab hand

2. **Smooth Transitions**:
   - Zoom animates smoothly
   - Pan responds immediately
   - No lag or stuttering

## Performance

- **Zoom**: Instant, no lag
- **Pan**: Smooth 60fps
- **Coordinate Conversion**: Efficient screen ↔ world transforms
- **Viewport Culling**: Only renders visible area

## Testing Checklist

- ✅ Mouse wheel zooms in/out
- ✅ Zoom centers on mouse position
- ✅ Right-click drag pans canvas
- ✅ Right-click click shows context menu
- ✅ Right-click click on empty space creates workspace
- ✅ Cursor changes to "grabbing" while panning
- ✅ Pan works at all zoom levels
- ✅ Zoom works at all pan positions
- ✅ Reset viewport (0 key) works
- ✅ Alternative pan methods (Space, middle mouse) still work

## Known Behavior

### Right-Click Interaction

**Right-Click Drag** (> 5px movement):
- Pans the canvas
- No context menu shown
- Cursor shows "grabbing"

**Right-Click Click** (< 5px movement):
- Shows context menu (if on workspace)
- Creates workspace (if on empty space)
- No panning occurs

This dual behavior is intentional and follows classic design tool patterns.

## Files Modified

- `src/canvas/CanvasRoot.tsx`
  - Enhanced `handleWheel` for mouse-centered zoom
  - Added right-click drag panning
  - Smart context menu detection
  - Cursor state management
  - Pointer capture for smooth dragging

## Comparison with Previous Implementation

**Before**:
- Zoom with wheel (but not clearly centered)
- Pan with Space+drag or middle mouse
- Right-click always showed context menu

**After**:
- ✅ Zoom clearly centered on mouse pointer
- ✅ Right-click drag for panning (classic behavior)
- ✅ Right-click click for context menu (smart detection)
- ✅ All previous methods still work

---

*Last Updated: January 2026*
