# Gigafactory Canvas User Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Basic Operations](#basic-operations)
4. [Navigation & Viewport](#navigation--viewport)
5. [Workspace Management](#workspace-management)
6. [Connections & Workflows](#connections--workflows)
7. [Advanced Features](#advanced-features)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Tips & Tricks](#tips--tricks)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Gigafactory Canvas is an interactive visual editor for creating and managing AI agent workflows. Workspaces represent agent nodes that can execute tasks, and connections define data flow between them.

### Key Concepts

- **Workspace**: A node that can run AI agent tasks
- **Connection**: A link between workspaces that passes data/output
- **Task Template**: Pre-defined prompt that a workspace executes
- **Auto-Run**: Automatically execute a workspace when its inputs complete
- **Viewport**: The canvas view with zoom and pan capabilities

---

## Getting Started

### First Steps

1. **Create Your First Workspace**
   - Right-click anywhere on the canvas
   - Or press `N` or `Space` at your mouse position
   - Or drag to draw a custom-sized workspace

2. **Add a Task**
   - Click the workspace to select it
   - Press `T` or `Enter` to focus the task input
   - Type your task description
   - Press `Ctrl+Enter` (or `Cmd+Enter` on Mac) to run

3. **Connect Workspaces**
   - Click the green output port (right side) of a workspace
   - Drag to another workspace's blue input port (left side)
   - Or press `C` while a workspace is selected to start connecting

---

## Basic Operations

### Creating Workspaces

**Method 1: Quick Create**
- Right-click on empty canvas → Creates workspace at click position
- Press `N` or `Space` → Creates workspace at mouse cursor

**Method 2: Draw to Create**
- Click and drag on empty canvas
- Release to create workspace with custom size
- Minimum size: 200x200 pixels

**Method 3: Auto-Create During Connection**
- Start connecting from a workspace
- Click empty space → Creates new workspace and connects automatically

### Selecting Workspaces

- **Click** a workspace to select it
- **Tab** to cycle through all workspaces
- **Shift+Tab** to cycle backwards
- **1-9** to select workspace by index
- **Click empty space** to deselect

### Editing Workspace Properties

**Quick Edit (Name)**
- Click the workspace name
- Type new name
- Press `Enter` to save, `Escape` to cancel

**Advanced Edit (Context Menu)**
- Right-click a workspace
- Select "Edit Properties"
- Modify: name, task template, system prompt, model, messiness, size

**Position Edit**
- Right-click workspace → "Edit Position"
- Drag the workspace to new location
- Press `Escape` to exit position edit mode

### Running Tasks

**Method 1: Quick Run**
- Select workspace with task template
- Press `R` to run immediately

**Method 2: Manual Run**
- Click the play button (▶️) in the workspace
- Or use context menu → "Simulate Phase"

**Method 3: Auto-Run**
- Connect workspaces (auto-run enabled by default)
- When input workspace completes, output workspace runs automatically

### Stopping Tasks

- Press `S` while workspace is selected
- Or click "Stop" button in the workspace card

### Deleting Workspaces

- Select workspace and press `Delete` or `Backspace`
- Or use context menu → "Delete"
- Or click the × button (top-right, appears on hover)

---

## Navigation & Viewport

### Zooming

**Mouse Wheel**
- Scroll up to zoom in
- Scroll down to zoom out
- Zooms toward mouse cursor position

**Keyboard**
- Press `0` to reset zoom to 100%

### Panning

**Method 1: Space + Drag**
- Hold `Space` key
- Click and drag to pan
- Cursor changes to "grab" when panning

**Method 2: Middle Mouse**
- Hold middle mouse button
- Drag to pan

**Tip**: Panning is useful for navigating large graphs with many workspaces.

### Viewport Reset

- Press `0` to reset zoom and pan to default position

### Coordinate System

The canvas uses a world coordinate system that works at any zoom level:
- Workspaces are positioned in world coordinates
- Zoom/pan transforms the view, not the workspace positions
- Clicking always interacts with the correct workspace regardless of zoom

---

## Workspace Management

### Workspace States

Workspaces have different visual states:

- **Empty** (gray): No task assigned
- **Occupied** (blue-gray): Has task template, ready to run
- **Working** (blue): Currently executing task
- **Success** (green): Task completed successfully
- **Error** (red): Task failed

### Workspace Ports

**Input Port** (left side, blue)
- Receives data from connected workspaces
- Click and drag to create incoming connection
- Shows blue when connected

**Output Port** (right side, green)
- Sends data to connected workspaces
- Click and drag to create outgoing connection
- Shows green when connected

### Workspace Properties

**Basic Properties**
- **Name**: Display name (editable)
- **Task Template**: The prompt/instruction to execute
- **System Prompt**: Optional system-level instructions
- **Model**: AI model to use (Claude, DeepSeek, etc.)
- **Messiness**: Visual indicator (0-100 slider)

**Advanced Properties** (via context menu)
- **Size**: Width and height in pixels
- **Position**: X and Y coordinates
- **Auto-Run**: Enable/disable automatic execution

### Workspace Connections

**Viewing Connections**
- Input connections shown as blue badge: "X input"
- Output connections shown at bottom: "→ Workspace1, Workspace2"
- Auto-run indicator: "⚡ auto" badge

**Connection States**
- **Inactive**: Gray/blue line (normal state)
- **Active**: Glowing blue line (data flowing)
- **Error**: Red line (connection failed)

---

## Connections & Workflows

### Creating Connections

**Method 1: Drag to Connect**
1. Click output port (green, right side)
2. Drag to input port (blue, left side) of target workspace
3. Release to complete connection

**Method 2: Keyboard Shortcut**
1. Select source workspace
2. Press `C` to start connecting
3. Click target workspace or empty space

**Method 3: Auto-Create**
1. Start connecting from a workspace
2. Click empty space
3. New workspace created and connected automatically

### Connection Types

**Output → Input**
- Most common connection type
- Data flows from source to target
- Target workspace receives output as input

**Input → Output** (reverse)
- Less common, but supported
- Useful for feedback loops

### Workflow Execution

**Sequential Execution**
```
Workspace A → Workspace B → Workspace C
```
- A runs first
- When A completes, B runs (if auto-run enabled)
- When B completes, C runs

**Parallel Execution**
```
Workspace A → Workspace B
Workspace A → Workspace C
```
- A runs first
- B and C both receive A's output
- B and C can run in parallel

**Auto-Run Behavior**
- Enabled by default for new connections
- Workspace runs automatically when all inputs complete
- Disable via context menu if manual control needed

### Data Flow

- Each workspace's output becomes available to connected workspaces
- Output is passed as input to downstream workspaces
- Use workflow inputs in task templates: `{{input}}` or similar syntax

---

## Advanced Features

### Performance Monitor

**Toggle Display**
- Press `P` to show/hide performance overlay
- Located in top-right corner

**Metrics Shown**
- **FPS**: Frames per second (green = good, yellow = okay, red = poor)
- **Nodes**: Total number of workspaces
- **Connections**: Total number of connections
- **Active**: Currently working workspaces

**Use Cases**
- Monitor performance with large graphs (100+ workspaces)
- Identify bottlenecks
- Optimize workflow complexity

### Context Menu

**Access**
- Right-click any workspace

**Actions Available**
- **✏️ Edit Properties**: Open advanced editor
- **📍 Edit Position**: Enable drag-to-move mode
- **▶️ Simulate Phase**: Run workspace task (if template exists)
- **🗑️ Delete**: Remove workspace and connections

**Keyboard Navigation**
- Use arrow keys to navigate menu
- Press `Escape` to close

### Timeline Simulator

**Location**
- Appears at bottom center when workspaces exist

**Features**
- **Phase Scrubber**: Drag to navigate through phases
  - Q1 2026: Ingestion
  - Q2 2026: Stress Testing
  - Q3 2026: Production
  - Q4 2026: Optimization
  - 2027+: Autonomy

- **Play/Pause**: Control simulation playback
- **Phase Display**: Shows current phase name

**Use Cases**
- Simulate phased execution
- Test workflow timing
- Plan deployment schedules

### Export & Import

**Export Graph**
- Press `Ctrl+E` (Windows/Linux) or `Cmd+E` (Mac)
- Graph saved as JSON file
- Includes all workspaces, connections, and properties

**Import Graph**
- Press `Ctrl+I` (Windows/Linux) or `Cmd+I` (Mac)
- Select JSON file to import
- Restores complete graph state

**Use Cases**
- Backup workflows
- Share configurations with team
- Version control workflows
- Template workflows for reuse

### Node Editor

**Access**
- Right-click workspace → "Edit Properties"
- Or use context menu

**Editable Properties**
- Name
- Task Template (multi-line)
- System Prompt (multi-line)
- Model selection
- Messiness (slider: 0-100)
- Width and Height (pixels)

**Save Changes**
- Click "Save" button
- Or press `Enter` in text fields

---

## Keyboard Shortcuts

### Workspace Operations

| Key | Action |
|-----|--------|
| `N` or `Space` | Create workspace at mouse position |
| `T` or `Enter` | Focus task input for selected workspace |
| `R` | Run task on selected workspace |
| `S` | Stop task on selected workspace |
| `C` | Start connecting from selected workspace |
| `Delete` or `Backspace` | Delete selected workspace |
| `Tab` | Cycle to next workspace |
| `Shift+Tab` | Cycle to previous workspace |
| `1-9` | Select workspace by index |

### Navigation

| Key | Action |
|-----|--------|
| `Space` + Drag | Pan canvas |
| `Wheel` | Zoom in/out |
| `0` | Reset viewport (zoom & pan) |
| `Escape` | Deselect workspace / Exit edit modes |

### Advanced Features

| Key | Action |
|-----|--------|
| `P` | Toggle performance monitor |
| `Ctrl+E` / `Cmd+E` | Export graph to JSON |
| `Ctrl+I` / `Cmd+I` | Import graph from JSON |
| `L` | Toggle logs panel |

### Context Menu

| Key | Action |
|-----|--------|
| Right-click | Show context menu |
| `Escape` | Close context menu |
| Arrow keys | Navigate menu items |
| `Enter` | Select menu item |

---

## Tips & Tricks

### Efficient Workflow Creation

1. **Quick Creation Chain**
   - Create first workspace
   - Press `C` to start connecting
   - Click empty space repeatedly
   - Each click creates and connects a new workspace

2. **Batch Operations**
   - Use `Tab` to quickly cycle through workspaces
   - Press `R` on each to queue up tasks
   - All will execute in sequence

3. **Template Workflows**
   - Create a workflow template
   - Export it (`Ctrl+E`)
   - Import when needed (`Ctrl+I`)
   - Modify as needed

### Performance Optimization

1. **Large Graphs**
   - Use zoom to focus on specific areas
   - Pan to navigate without losing context
   - Monitor FPS with `P` key
   - Consider breaking into sub-graphs

2. **Connection Management**
   - Keep connections organized (avoid crossing)
   - Use auto-run judiciously (disable when debugging)
   - Monitor active connections (glowing lines)

### Workflow Design

1. **Sequential Processing**
   ```
   Input → Process → Validate → Output
   ```
   - Clear data flow
   - Easy to debug
   - Predictable execution

2. **Parallel Processing**
   ```
   Input → [Process A, Process B, Process C] → Merge
   ```
   - Faster execution
   - Independent processing
   - Merge results at end

3. **Error Handling**
   - Add validation workspaces
   - Use error states to identify issues
   - Create fallback paths

### Visual Organization

1. **Grouping**
   - Arrange related workspaces together
   - Use consistent spacing
   - Align to grid (when dragging)

2. **Naming**
   - Use descriptive names
   - Include purpose in name
   - Number sequences for similar workspaces

3. **Color Coding**
   - Success (green) = completed
   - Working (blue) = in progress
   - Error (red) = needs attention
   - Empty (gray) = needs configuration

---

## Troubleshooting

### Common Issues

**Workspace Not Responding**
- Check if workspace is selected (highlighted border)
- Verify task template is set
- Check workspace state (should be "occupied" or "working")
- Try stopping and restarting task (`S` then `R`)

**Connection Not Working**
- Verify ports are connected (colored indicators)
- Check auto-run is enabled (⚡ badge visible)
- Ensure source workspace has completed
- Check for error states

**Performance Issues**
- Press `P` to check FPS
- Zoom out to reduce rendering load
- Close performance monitor if not needed
- Consider breaking large graphs into smaller ones

**Zoom/Pan Not Working**
- Check if input field is focused (click canvas)
- Verify mouse wheel is working
- Try resetting viewport (`0` key)
- Check if Space key is stuck (try pressing it)

**Export/Import Fails**
- Verify file is valid JSON
- Check file permissions
- Ensure graph has at least one workspace
- Try exporting first, then importing the same file

**Context Menu Not Appearing**
- Right-click directly on workspace (not empty space)
- Check if another menu is open (close with `Escape`)
- Verify workspace is not in edit mode

### Getting Help

1. **Check Performance Monitor**
   - Press `P` to see system stats
   - Low FPS indicates performance issues

2. **Review Workspace States**
   - Green = success
   - Blue = working
   - Red = error (check logs)

3. **Inspect Connections**
   - Active connections glow blue
   - Verify data flow direction
   - Check for disconnected workspaces

4. **Reset Viewport**
   - Press `0` to reset zoom/pan
   - Useful if navigation is confusing

---

## Quick Reference Card

### Essential Shortcuts
```
N/Space    Create workspace
T/Enter    Add task
R          Run task
C          Connect
Tab        Cycle workspaces
Delete     Delete workspace
P          Performance monitor
Ctrl+E     Export
Ctrl+I     Import
0          Reset viewport
```

### Mouse Actions
```
Left Click       Select workspace
Right Click      Context menu / Create workspace
Drag             Draw workspace / Move workspace
Wheel            Zoom
Space + Drag     Pan
Middle + Drag    Pan
```

### Workspace States
```
Gray     Empty (no task)
Blue     Working (executing)
Green    Success (completed)
Red      Error (failed)
```

---

## Examples

### Example 1: Simple Chain

1. Create workspace A
2. Add task: "Generate a report"
3. Press `C` to start connecting
4. Click empty space (creates B)
5. Add task to B: "Format the report"
6. Press `C` on B, create C
7. Add task to C: "Send the report"
8. Press `R` on A to start chain

### Example 2: Parallel Processing

1. Create workspace "Input"
2. Add task: "Fetch data"
3. Connect to three new workspaces:
   - "Process A"
   - "Process B"  
   - "Process C"
4. Each processes input independently
5. Connect all three to "Merge" workspace
6. "Merge" combines results

### Example 3: Error Handling

1. Create "Validate" workspace
2. Connect from "Process"
3. If validation fails (error state):
   - Connect to "Retry" workspace
   - Or connect to "Fallback" workspace
4. If validation succeeds:
   - Connect to "Continue" workspace

---

## Best Practices

1. **Name Clearly**: Use descriptive workspace names
2. **Organize Visually**: Group related workspaces
3. **Test Incrementally**: Run one workspace at a time when debugging
4. **Use Auto-Run Wisely**: Disable for manual control when needed
5. **Monitor Performance**: Check FPS with large graphs
6. **Export Regularly**: Save your work frequently
7. **Document Workflows**: Add comments in task templates
8. **Version Control**: Export workflows for Git tracking

---

## Additional Resources

- **Architecture Guide**: `docs/GRAPH_ARCHITECTURE_IMPROVEMENTS.md`
- **Implementation Details**: `docs/CANVAS_IMPROVEMENTS_IMPLEMENTATION.md`
- **UI Improvements**: `docs/UI_IMPROVEMENTS_SUMMARY.md`

---

*Last Updated: January 2026*
