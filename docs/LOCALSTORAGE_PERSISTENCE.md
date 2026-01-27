# LocalStorage Persistence

## Overview

Workspaces and viewport state (zoom/pan) are now automatically saved to browser localStorage and restored when the UI is fired up again.

## Features

### 1. ✅ Workspace Persistence

**What's Saved**:
- All workspace data (positions, sizes, names, states)
- Workspace connections (input/output relationships)
- Task templates
- System prompts
- Model settings
- CLI settings
- All workspace properties

**What's NOT Saved** (temporary state):
- Drawing state (in-progress drawing)
- Agent runtime state (handled separately)

**Storage Key**: `gigafactory-workspaces`

**Implementation**:
```typescript
// src/stores/workspaces.ts
export const useWorkspacesStore = create<WorkspacesState>()(
  persist(
    immer((set, get) => ({
      // ... store implementation
    })),
    {
      name: 'gigafactory-workspaces',
      partialize: (state) => ({
        workspaces: state.workspaces, // Only persist workspaces, not drawing
      }),
    }
  )
);
```

### 2. ✅ Viewport State Persistence

**What's Saved**:
- Viewport position (x, y)
- Zoom scale
- Pan position

**Storage Key**: `gigafactory-viewport`

**Implementation**:
```typescript
// src/stores/viewport.ts
export const useViewportStore = create<ViewportStore>()(
  persist(
    (set) => ({
      viewportState: null,
      setViewportState: (state) => {
        set({ viewportState: state });
      },
    }),
    {
      name: 'gigafactory-viewport',
    }
  )
);
```

### 3. ✅ Automatic Save & Load

**Save**:
- Workspaces: Automatically saved on every change (Zustand persist middleware)
- Viewport: Saved whenever viewport state changes (zoom/pan)

**Load**:
- Workspaces: Automatically loaded on app startup
- Viewport: Loaded and applied when canvas initializes

**Code**:
```typescript
// Load saved viewport state on initialization
const savedViewportState = viewportState;
viewportRef.current = new ViewportController(savedViewportState || undefined);

// Apply saved state to stage immediately
if (app.stage && savedViewportState) {
  app.stage.x = savedViewportState.x ?? 0;
  app.stage.y = savedViewportState.y ?? 0;
  app.stage.scale.set(savedViewportState.scale ?? 1);
}

// Save viewport state on every change
viewportRef.current.setOnStateChange((state) => {
  // Update stage
  app.stage.x = state.x;
  app.stage.y = state.y;
  app.stage.scale.set(state.scale);
  
  // Persist to localStorage
  setViewportState({
    x: state.x,
    y: state.y,
    scale: state.scale,
  });
});
```

## Usage

### Automatic Behavior

**No Action Required**:
- Workspaces are automatically saved and loaded
- Viewport state is automatically saved and loaded
- Everything happens transparently

**On App Startup**:
1. Workspaces are loaded from localStorage
2. Viewport state is loaded from localStorage
3. Canvas is initialized with saved viewport position/zoom
4. User continues from where they left off

**During Use**:
1. Every workspace change is saved automatically
2. Every zoom/pan action is saved automatically
3. No manual save required

### Manual Clear (if needed)

**Clear Workspaces**:
```typescript
localStorage.removeItem('gigafactory-workspaces');
```

**Clear Viewport**:
```typescript
localStorage.removeItem('gigafactory-viewport');
```

**Clear All**:
```typescript
localStorage.removeItem('gigafactory-workspaces');
localStorage.removeItem('gigafactory-viewport');
```

## Technical Details

### Storage Format

**Workspaces**:
```json
{
  "state": {
    "workspaces": {
      "workspace-id-1": {
        "id": "workspace-id-1",
        "name": "Workspace 1",
        "x": 100,
        "y": 200,
        "width": 280,
        "height": 280,
        "state": "empty",
        // ... all workspace properties
      }
    }
  },
  "version": 0
}
```

**Viewport**:
```json
{
  "state": {
    "viewportState": {
      "x": 0,
      "y": 0,
      "scale": 1.0
    }
  },
  "version": 0
}
```

### Zustand Persist Middleware

**Version**: Zustand v5
**Middleware**: `zustand/middleware/persist`

**Features**:
- Automatic serialization/deserialization
- JSON storage
- Version management
- Selective persistence (partialize)

### Browser Compatibility

**Supported**:
- All modern browsers with localStorage support
- Chrome, Firefox, Safari, Edge
- Mobile browsers

**Limitations**:
- localStorage size limit (~5-10MB)
- Private/Incognito mode may clear on close
- Cross-tab synchronization not included (future enhancement)

## Benefits

### 1. **Seamless Experience**
- No data loss on refresh
- Continue where you left off
- No manual save required

### 2. **Persistent Layout**
- Workspace positions remembered
- Zoom level remembered
- Pan position remembered

### 3. **Workflow Continuity**
- Task templates preserved
- Connections preserved
- Settings preserved

## Files Modified

- `src/stores/workspaces.ts`
  - Added `persist` middleware
  - Configured to save only workspaces (not drawing state)

- `src/stores/viewport.ts` (NEW)
  - Created viewport store with persistence
  - Saves viewport position and zoom

- `src/canvas/CanvasRoot.tsx`
  - Load saved viewport state on initialization
  - Save viewport state on every change
  - Apply saved state to Pixi stage

## Testing

### Test Scenarios

1. **Create Workspaces**:
   - Create several workspaces
   - Refresh page
   - ✅ Workspaces should still be there

2. **Move Workspaces**:
   - Move workspaces around
   - Refresh page
   - ✅ Workspaces should be in new positions

3. **Zoom & Pan**:
   - Zoom in/out
   - Pan around
   - Refresh page
   - ✅ Viewport should be at saved position/zoom

4. **Connections**:
   - Connect workspaces
   - Refresh page
   - ✅ Connections should be preserved

5. **Settings**:
   - Change workspace names, models, etc.
   - Refresh page
   - ✅ Settings should be preserved

## Known Behavior

### Temporary State Not Saved

**Drawing State**:
- In-progress drawing is not saved
- Drawing state is reset on refresh
- This is intentional (drawing is temporary)

**Agent Runtime State**:
- Agent execution state is not saved
- Tasks need to be re-run after refresh
- This is intentional (runtime state is ephemeral)

### Viewport Reset

**Default State**:
- If no saved viewport state exists, defaults to:
  - Position: (0, 0)
  - Scale: 1.0 (100%)

**Reset Viewport**:
- Press `0` key to reset viewport
- This will save the reset state to localStorage

---

*Last Updated: January 2026*
