# Workspace Scaling with Zoom

## Overview

Workspaces now scale with the viewport zoom and show only the title when zoomed out below 40%. This provides a clean overview at low zoom levels while maintaining full detail when zoomed in.

## Features

### 1. ✅ Zoom Limits

**Zoom Range**:
- **Minimum**: 5% (0.05x) - Maximum zoom out
- **Maximum**: 200% (2.0x) - Maximum zoom in
- **Default**: 100% (1.0x)

**Implementation**:
```typescript
// ViewportController.ts
minScale: 0.05,  // 5% minimum
maxScale: 2.0,   // 200% maximum
```

### 2. ✅ Workspace Scaling

**Behavior**:
- Workspaces scale proportionally with viewport zoom
- Position and size scale together
- Smooth transitions during zoom

**Implementation**:
- Workspaces are HTML divs positioned absolutely
- World coordinates converted to screen coordinates for positioning
- CSS `transform: scale()` applied to match viewport scale
- Transform origin: `0 0` (top-left corner)

**Code**:
```typescript
// Get viewport scale
const currentScale = viewport?.scale ?? 1;

// Convert world to screen coordinates
const screenPos = viewportRef.current 
  ? viewportRef.current.worldToScreen(workspace.x, workspace.y)
  : { x: workspace.x, y: workspace.y };

// Apply scale transform
const transform = `scale(${currentScale})`;
```

### 3. ✅ Title-Only Mode (< 40% Zoom)

**Behavior**:
- When zoomed out below 40% (0.4x), workspaces show **only the title**
- All other content (ports, buttons, status, content) is hidden
- Provides clean overview of workspace names at low zoom levels

**Threshold**:
- **Show full content**: Scale ≥ 40% (0.4x)
- **Show title only**: Scale < 40% (0.4x)

**Implementation**:
```typescript
const showTitleOnly = currentScale < 0.4;

// Conditionally render content
{!showTitleOnly && (
  // Ports, buttons, status, main content
)}
```

**What's Hidden in Title-Only Mode**:
- ❌ Workspace number badge
- ❌ Delete button
- ❌ Input/output ports
- ❌ Connection indicators
- ❌ Main content area (agent status, task input, etc.)
- ❌ Output connections list
- ❌ Position edit indicators
- ❌ Wiring highlights

**What's Shown in Title-Only Mode**:
- ✅ Workspace title/name
- ✅ Status badge (IDLE, WORKING, SUCCESS, ERROR, etc.)
- ✅ Border and background colors (for state indication)

## Technical Details

### Coordinate System

**World Coordinates**:
- Workspaces stored in world coordinates (workspace.x, workspace.y)
- Independent of viewport position/scale
- Used for graph logic and connections

**Screen Coordinates**:
- Converted from world coordinates for HTML positioning
- Formula: `screenX = worldX * scale + viewportX`
- Used for CSS positioning (`left`, `top`)

**Conversion**:
```typescript
// World to screen
const screenPos = viewportRef.current.worldToScreen(worldX, worldY);

// Screen to world (for interactions)
const worldPos = viewportRef.current.screenToWorld(screenX, screenY);
```

### Scaling Implementation

**HTML Workspaces**:
- Positioned using screen coordinates
- Scaled using CSS `transform: scale()`
- Transform origin: `0 0` (top-left)

**Pixi Graphics**:
- Grid, connections, nodes rendered in world coordinates
- Automatically scaled by Pixi stage transform
- No additional scaling needed

**SVG Connections**:
- Converted to screen coordinates for rendering
- Scale automatically with viewport

### Performance

**Optimizations**:
- `willChange: 'transform'` hint for CSS optimization
- Conditional rendering (hide content when zoomed out)
- Efficient coordinate conversions
- Smooth transitions

**Rendering**:
- Workspaces re-render on viewport change
- Title-only mode reduces DOM complexity
- Smooth 60fps during zoom/pan

## Usage

### Zooming

1. **Mouse wheel** to zoom in/out
2. Zoom centers on mouse pointer position
3. Workspaces scale proportionally
4. Below 40% zoom, only titles shown

### Zoom Levels

**5% - 40%** (Title-Only Mode):
- Clean overview
- See all workspace names
- Minimal visual clutter
- Fast navigation

**40% - 100%** (Full Content):
- Full workspace details
- All controls visible
- Normal interaction

**100% - 200%** (Detailed View):
- Maximum zoom for precision
- Large, readable text
- Precise positioning

## Visual Examples

### Title-Only Mode (< 40%)
```
┌─────────────────┐
│ Workspace 1 IDLE│
└─────────────────┘

┌─────────────────┐
│ Workspace 2 WORK│
└─────────────────┘
```

### Full Content Mode (≥ 40%)
```
┌─────────────────────────┐
│ Workspace 1      [IDLE]  │
│ ┌─────────────────────┐ │
│ │  [Agent Status]     │ │
│ │  [Task Input]       │ │
│ └─────────────────────┘ │
│ → Workspace 2, 3        │
└─────────────────────────┘
```

## Benefits

### 1. **Clean Overview**
- See many workspaces at once
- Identify workspaces by name
- Quick navigation

### 2. **Progressive Detail**
- Zoom in for more detail
- Zoom out for overview
- Smooth transition

### 3. **Performance**
- Less DOM when zoomed out
- Faster rendering
- Smooth interactions

### 4. **User Experience**
- Intuitive scaling
- Familiar zoom behavior
- Clear visual feedback

## Testing Checklist

- ✅ Workspaces scale with zoom
- ✅ Position scales correctly
- ✅ Title-only mode at < 40%
- ✅ Full content at ≥ 40%
- ✅ Smooth transitions
- ✅ Connections scale correctly
- ✅ Zoom limits (5% - 200%)
- ✅ Mouse wheel zoom works
- ✅ Right-click pan works
- ✅ No visual glitches

## Known Behavior

### Scaling Behavior

**Workspaces**:
- Scale proportionally with zoom
- Position converted to screen coordinates
- CSS transform applied

**Connections**:
- SVG paths converted to screen coordinates
- Scale automatically with viewport

**Grid**:
- Pixi graphics in world coordinates
- Scale automatically with stage

### Title-Only Threshold

**40% (0.4x)** is the threshold:
- Above: Full content
- Below: Title only

This threshold provides a good balance between overview and detail.

## Files Modified

- `src/lib/canvas/ViewportController.ts`
  - Updated `minScale` to 0.05 (5%)
  - Updated `maxScale` to 2.0 (200%)

- `src/canvas/CanvasRoot.tsx`
  - Added viewport scale detection
  - Converted world to screen coordinates
  - Applied CSS scale transform
  - Added title-only mode logic
  - Conditionally render content based on zoom
  - Updated SVG connections to use screen coordinates

---

*Last Updated: January 2026*
