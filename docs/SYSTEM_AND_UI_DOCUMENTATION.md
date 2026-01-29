# System Design and UI Functions Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [UI Components and Functions](#ui-components-and-functions)
4. [Workspace Connection System](#workspace-connection-system)
5. [Workflow Execution](#workflow-execution)
6. [Data Flow](#data-flow)

---

## System Overview

**Gigafactory** is a visual agent orchestration platform that allows users to create, connect, and manage multiple AI agent workspaces in a canvas-based interface. Each workspace can run tasks using various AI CLI backends (Claude, Cursor, Kilo, Gemini, Grok, DeepSeek, Kimi, Qwen) and can be connected to other workspaces to create automated workflows.

### Key Features
- **Visual Canvas**: Interactive workspace management with pan, zoom, and grid snapping
- **Multi-Agent Support**: Run multiple AI agents simultaneously in separate workspaces
- **Workflow Automation**: Connect workspaces to create data pipelines and automated workflows
- **Multiple CLI Backends**: Support for 8+ AI CLI tools with model selection
- **Real-time Monitoring**: Live agent state updates, logs, and progress tracking
- **Persistent Storage**: Workspace configurations saved to localStorage

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
│  - Canvas UI (PixiJS)                                       │
│  - Workspace Management                                     │
│  - State Management (Zustand)                               │
│  - Event Handling                                           │
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │ API Calls / Events
                          │
        ┌─────────────────┴─────────────────┐
        │                                     │
┌───────▼────────┐                  ┌────────▼────────┐
│  Tauri Binary  │                  │  Web Server     │
│  (Desktop App) │                  │  (HTTP/WS)      │
│                │                  │                 │
│  - IPC         │                  │  - HTTP routes │
│  - Events      │                  │  - WebSocket   │
└───────┬────────┘                  └────────┬───────┘
        │                                     │
        └─────────────────┬───────────────────┘
                          │
        ┌─────────────────▼───────────────────┐
        │    Shared Core Library (Rust)         │
        │  - AgentManager                       │
        │  - Process Management                 │
        │  - CLI Builders                       │
        │  - Event Types                        │
        └───────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- React + TypeScript
- PixiJS (canvas rendering)
- Zustand (state management)
- Vite (build tool)
- Tailwind CSS (styling)

**Backend:**
- Rust (core library)
- Tauri (desktop app framework)
- Axum (web server framework)
- WebSocket (real-time communication)

**State Management:**
- `workspaces` store: Workspace data, connections, positions
- `agents` store: Agent states, logs, progress
- `ui` store: UI state, selections, modals
- `config` store: Application configuration
- `settings` store: User preferences, CLI availability

---

## UI Components and Functions

### Main Application Layout

```
┌─────────────────────────────────────────────────────────────┐
│                         Canvas Area                           │
│  - Workspace cards                                           │
│  - Connection lines (Bézier curves)                          │
│  - Grid overlay                                              │
│  - Pan/zoom controls                                         │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                         Sidebar                               │
│  - Workspace List                                            │
│  - Workspace Panel (details, settings)                        │
│  - Agent Detail                                              │
│  - Skills Panel                                              │
│  - Log Viewer                                                │
│  - Task Input                                                │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                         Status Bar                            │
│  - CLI availability indicators                               │
│  - Status messages                                           │
└─────────────────────────────────────────────────────────────┘
```

### Canvas Functions

#### Workspace Creation
- **Right-click**: Quick create workspace at cursor position
- **Drag to draw**: Create custom-sized workspace by dragging
- **Keyboard (N)**: Create workspace at current viewport center
- **Auto-connect**: New workspaces automatically connect to selected workspace

#### Workspace Interaction
- **Click**: Select workspace
- **Double-click name**: Edit workspace name
- **Press T**: Focus task input for selected workspace
- **Press R**: Run task in selected workspace
- **Press M**: Enter position edit mode (drag to move)
- **Press Del**: Delete selected workspace
- **Tab**: Cycle through workspaces

#### Canvas Navigation
- **Right-click drag**: Pan canvas
- **Space + drag**: Pan canvas (alternative)
- **Mouse wheel**: Zoom in/out (centered on cursor)
- **Press 0**: Reset viewport to default
- **Press G**: Toggle grid snapping
- **Press P**: Toggle performance monitor
- **Press Y**: Toggle timeline simulator

#### Connection Management
- **Drag from output port (→)**: Start wiring connection
- **Drag from input port (+)**: Start wiring connection
- **Click workspace while wiring**: Connect to that workspace
- **Click empty space while wiring**: Create new workspace and connect
- **Press C**: Start connection from selected workspace output
- **Context menu**: Access connection management options

### Sidebar Panels

#### 1. Workspace List Panel
- View all workspaces in a list
- Quick access to workspace details
- Filter and search capabilities

#### 2. Workspace Panel
**Configuration Options:**
- **Name**: Edit workspace name
- **Position**: View/edit X, Y coordinates (with drag-to-move)
- **Size**: View width and height
- **CLI Selection**: Choose AI backend (Claude, Cursor, Kilo, etc.)
- **Model Selection**: Select specific model for chosen CLI
- **System Prompt**: Custom instructions for the agent
- **Task Template**: Pre-defined task with `{{input}}` placeholder support
- **Auto-run**: Enable automatic execution when inputs complete

**Workflow Configuration:**
- **Input Connections**: Manage workspaces that feed data into this one
- **Output Connections**: Manage workspaces this one feeds data to
- **Last Output**: Preview of output available to connected workspaces
- **Connection Badges**: Visual indicators of connection count

**Special Settings:**
- **Cursor Mode**: Agent/Plan/Ask modes (Cursor CLI only)
- **Kimi Mode**: Direct/ACP server mode (Kimi CLI only)
- **MCP Config**: MCP configuration file path (Kimi CLI only)
- **MCP Management**: Add/remove/authenticate MCP servers (Kimi CLI only)

#### 3. Agent Detail Panel
- View agent state (thinking, reading, writing, running, searching, success, error)
- View task description
- View progress bar
- View agent logs
- Access output modal
- Stop running tasks

#### 4. Skills Panel
- View available agent skills
- Enable/disable specific skills
- Configure skill parameters

#### 5. Log Viewer
- Real-time log streaming
- Filter by log type (info, message, tool, result, error)
- Search and export capabilities

#### 6. Task Input Panel
- Quick task input at bottom of sidebar
- Submit tasks to selected workspace
- Keyboard shortcuts support

### Modals and Overlays

#### Output Modal
- View full agent output
- Copy output to clipboard
- Export output to file

#### Settings Panel
- Configure workspace directory
- Configure skills path
- Enable/disable CLI backends
- View CLI availability status

#### Context Menu
- Right-click on workspace for quick actions
- Create workspace
- Connect workspace
- Edit workspace
- Delete workspace

### Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| `N` | Create new workspace |
| `T` | Focus task input |
| `R` | Run task |
| `C` | Start connection |
| `M` | Move workspace (position edit) |
| `Tab` | Cycle workspaces |
| `Del` | Delete workspace |
| `P` | Toggle performance monitor |
| `Y` | Toggle timeline simulator |
| `G` | Toggle grid snap |
| `D` | Toggle debug control points |
| `0` | Reset viewport |
| `Ctrl+E` | Export graph |
| `Ctrl+I` | Import graph |
| `Space` | Pan mode (hold) |
| `Right-click drag` | Pan canvas |
| `Wheel` | Zoom in/out |

---

## Workspace Connection System

### Overview

The workspace connection system is the core feature that enables workflow automation. Workspaces can be connected to form **directed graphs** where data flows from source workspaces (outputs) to target workspaces (inputs).

### Connection Architecture

```
┌──────────────┐         ┌──────────────┐
│  Workspace A │ ──────→ │  Workspace B │
│  (Source)    │         │  (Target)    │
└──────────────┘         └──────────────┘
     │                         │
     │ outputConnections       │ inputConnections
     │ [B]                     │ [A]
     │                         │
     └─────────────────────────┘
```

### Connection Data Structure

Each workspace maintains two connection arrays:

```typescript
interface Workspace {
  id: string;
  // ... other properties
  
  inputConnections: string[];   // IDs of workspaces that feed INTO this one
  outputConnections: string[];  // IDs of workspaces this one feeds TO
}
```

**Example:**
- Workspace A has `outputConnections: ['B', 'C']`
- Workspace B has `inputConnections: ['A']`
- Workspace C has `inputConnections: ['A']`

This creates a graph: `A → B` and `A → C`

### Creating Connections

#### Method 1: Visual Wiring (Primary Method)

1. **Start Wiring:**
   - Click and drag from **output port (→)** on right side of source workspace
   - OR click and drag from **input port (+)** on left side of target workspace
   - OR press `C` while workspace is selected (starts from output)

2. **Complete Connection:**
   - **Click on target workspace**: Connects to that workspace
   - **Click on empty space**: Creates new workspace and connects to it
   - **Release mouse**: Completes connection if hovering over valid target

3. **Visual Feedback:**
   - Wiring line follows mouse cursor
   - Target workspaces highlight with dashed border
   - Connection ports show active state

#### Method 2: Sidebar Panel

1. Open **Workspace Panel** for target workspace
2. Expand **Workflow** section
3. Use **"Add input connection"** dropdown to select source workspace
4. Connection is created immediately

#### Method 3: Auto-Connect on Creation

- When creating a new workspace with a workspace selected
- New workspace automatically connects FROM the selected workspace
- Auto-run is enabled on the new workspace

### Connection Visualization

#### Bézier Curve Routing

Connections are rendered as **smooth Bézier curves** with intelligent routing:

1. **Hybrid Routing Algorithm:**
   - **Step routing** near workspaces (for clarity)
   - **Bump routing** in free space (for aesthetics)
   - **Blend zones** for smooth transitions

2. **Collision Avoidance:**
   - Routes avoid overlapping with other workspaces
   - Adjusts based on connection density
   - Handles backward connections (target left of source)

3. **Visual Features:**
   - Color-coded by connection state
   - Animated dash patterns for active connections
   - Control point visualization (debug mode: `D` key)

#### Connection Ports

- **Input Port (+)** on left side: Blue when connected, gray when empty
- **Output Port (→)** on right side: Green when connected, gray when empty
- Ports show hover effects and connection count badges

### Connection Types and Direction

#### Forward Connections (Standard)
```
Source (left) → Target (right)
```
- Source workspace's output feeds into target workspace's input
- Most common connection type

#### Backward Connections
```
Source (right) → Target (left)
```
- Target is positioned to the left of source
- Uses special routing algorithm with horizontal extension
- Routes above or below based on Y-position overlap

### Data Flow Through Connections

#### Input Aggregation

When a workspace receives data from multiple inputs:

```typescript
// Workspace B receives from A and C
workspaceB.inputConnections = ['A', 'C']

// When B runs, it receives:
inputs = [
  { id: 'A', output: workspaceA.lastOutput },
  { id: 'C', output: workspaceC.lastOutput }
]
```

#### Output Broadcasting

When a workspace sends data to multiple outputs:

```typescript
// Workspace A sends to B, C, and D
workspaceA.outputConnections = ['B', 'C', 'D']

// When A completes, all three receive A's lastOutput
```

### Task Template with Input Placeholders

Workspaces can use `{{input}}` placeholder in task templates:

```typescript
// Workspace B's task template:
"Review the following code and suggest improvements:\n\n{{input}}"

// When B runs, {{input}} is replaced with:
// "--- Input from 'Workspace A' ---\n[workspaceA.lastOutput]"
```

If no `{{input}}` placeholder exists, inputs are prepended as context:

```
Here is context from previous workflow steps:

--- Input from "Workspace A" ---
[workspaceA.lastOutput]

---

Now, your task:
[workspaceB.taskTemplate]
```

### Auto-Run Workflow

#### How Auto-Run Works

1. **Enable Auto-Run:**
   - Toggle "Auto-run when inputs complete" in Workspace Panel
   - OR automatically enabled when connecting via output port

2. **Trigger Conditions:**
   - All input workspaces must have `state === 'success'`
   - All input workspaces must have `lastOutput !== null`
   - Target workspace must have `autoRun === true`
   - Target workspace must have a `taskTemplate` defined

3. **Execution Flow:**
   ```
   Workspace A completes → 
   Checks downstream workspaces (B, C) →
   For each with autoRun enabled:
     - Check if all inputs are complete
     - If yes, trigger 'trigger-workflow-task' event →
     - startWorkflowTask() is called →
     - Task runs with aggregated inputs
   ```

#### Example Workflow

```
┌─────────────┐
│ Workspace A │ ──→ ┌─────────────┐
│  "Extract   │     │ Workspace B │
│   data"     │     │  "Analyze   │
└─────────────┘     │   results"  │
                    └─────────────┘
                           │
                           ↓
                    ┌─────────────┐
                    │ Workspace C │
                    │  "Generate  │
                    │   report"   │
                    └─────────────┘
```

**Execution:**
1. User runs A manually
2. A completes → stores output in `lastOutput`
3. B has `autoRun: true` → automatically starts
4. B receives A's output as input
5. B completes → stores output
6. C has `autoRun: true` → automatically starts
7. C receives B's output as input
8. C completes → workflow done

### Connection Management

#### Viewing Connections

- **Connection badges**: Show count of inputs/outputs on workspace card
- **Connection list**: View all connections in Workspace Panel
- **Visual lines**: Bézier curves on canvas show all connections

#### Disconnecting Workspaces

1. **Sidebar Method:**
   - Open Workspace Panel
   - Expand Workflow section
   - Click ✕ next to connection in Input/Output lists

2. **Programmatic:**
   ```typescript
   disconnectWorkspaces(fromId, toId)
   // Removes toId from fromId.outputConnections
   // Removes fromId from toId.inputConnections
   ```

#### Connection Validation

- **No self-connections**: Workspace cannot connect to itself
- **No duplicate connections**: Same connection cannot be added twice
- **Bidirectional updates**: Both workspaces updated when connecting/disconnecting

### Connection Persistence

Connections are stored in workspace state and persisted to localStorage:

```typescript
// Persisted via Zustand persist middleware
{
  workspaces: {
    "workspace-1": {
      id: "workspace-1",
      inputConnections: ["workspace-2"],
      outputConnections: ["workspace-3"],
      // ... other properties
    }
  }
}
```

### Advanced Connection Patterns

#### Fan-Out (One-to-Many)
```
     ┌───→ Workspace B
A ───┼───→ Workspace C
     └───→ Workspace D
```
- Single source feeds multiple targets
- All targets receive same output

#### Fan-In (Many-to-One)
```
A ───┐
B ───┼───→ Workspace D
C ───┘
```
- Multiple sources feed single target
- Target receives aggregated inputs

#### Pipeline (Sequential)
```
A → B → C → D
```
- Linear workflow chain
- Each step processes previous step's output

#### DAG (Directed Acyclic Graph)
```
     ┌───→ C ───┐
A ───┤          ├───→ E
     └───→ D ───┘
```
- Complex workflows with branching and merging
- Supports parallel execution paths

---

## Workflow Execution

### Task Execution Lifecycle

1. **Task Submission:**
   - User enters task in workspace
   - Task template saved to workspace
   - `startTask()` called with workspace ID and prompt

2. **Input Aggregation:**
   - If `useWorkflowInputs: true`, gather inputs from connected workspaces
   - Replace `{{input}}` placeholder or prepend context
   - Build final prompt with all context

3. **Agent Creation:**
   - Backend creates agent process
   - Agent ID returned to frontend
   - Workspace state updated to 'working'

4. **Event Streaming:**
   - Agent events streamed via WebSocket/IPC
   - Events: Started, Init, Message, ToolUse, ToolResult, Result, Error
   - UI updates in real-time

5. **Completion:**
   - On success: `lastOutput` stored, workspace state → 'success'
   - On error: workspace state → 'error'
   - Auto-run triggered for downstream workspaces

### Agent States

- **idle**: Agent created but not started
- **thinking**: Processing task, generating response
- **reading**: Using file read tools
- **writing**: Using file write/edit tools
- **running**: Executing code or commands
- **searching**: Performing web searches
- **success**: Task completed successfully
- **error**: Task failed or encountered error

### Workflow Input Processing

```typescript
// Example: Workspace B receives from A and C
const inputs = [
  { id: 'A', output: 'Extracted data: {...}' },
  { id: 'C', output: 'Processed results: {...}' }
]

// Task template with placeholder:
"Analyze the following:\n\n{{input}}"

// Final prompt:
"Analyze the following:

--- Input from 'Workspace A' ---
Extracted data: {...}

--- Input from 'Workspace C' ---
Processed results: {...}
"
```

---

## Data Flow

### State Management Flow

```
User Action (Canvas/Sidebar)
    ↓
UI Store (Zustand)
    ↓
API Call (Tauri IPC / HTTP)
    ↓
Backend (Rust Core Library)
    ↓
Agent Process (CLI Execution)
    ↓
Event Stream (WebSocket/IPC)
    ↓
Event Handler (useAgentEvents)
    ↓
State Update (Zustand Stores)
    ↓
UI Re-render (React)
```

### Workspace Data Flow

```
Workspace Creation
    ↓
Workspace Store (Zustand)
    ↓
localStorage (Persistence)
    ↓
Canvas Rendering (PixiJS)
    ↓
User Interaction
    ↓
State Update
    ↓
Re-render
```

### Connection Data Flow

```
Connection Created (connectWorkspaces)
    ↓
Both Workspaces Updated
    ↓
Canvas Re-renders Connections
    ↓
Bézier Router Calculates Path
    ↓
Connection Renderer Draws Curve
    ↓
User Sees Visual Connection
```

### Workflow Execution Flow

```
Task Started
    ↓
Input Aggregation (getInputsForWorkspace)
    ↓
Prompt Building (buildWorkflowPrompt)
    ↓
Agent Started (API call)
    ↓
Events Streamed
    ↓
State Updates
    ↓
Task Completes
    ↓
Output Stored (setLastOutput)
    ↓
Auto-run Check (getDownstreamWorkspaces)
    ↓
Downstream Tasks Triggered
    ↓
Workflow Continues
```

---

## Summary

The Gigafactory system provides a powerful visual interface for orchestrating multiple AI agents through connected workspaces. The **workspace connection system** is the core feature that enables:

1. **Visual Workflow Design**: Drag-and-drop connection creation
2. **Data Piping**: Automatic data flow between workspaces
3. **Automated Execution**: Auto-run based on input completion
4. **Complex Workflows**: Support for DAGs, pipelines, fan-in, fan-out patterns
5. **Real-time Monitoring**: Live updates of agent states and connections

The system combines the flexibility of a visual programming interface with the power of modern AI CLI tools, enabling users to build sophisticated multi-agent workflows with ease.
