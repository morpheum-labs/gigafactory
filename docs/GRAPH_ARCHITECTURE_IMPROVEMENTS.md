# Graph Architecture Improvements

## Overview

This document describes the LiteGraph.js-inspired architecture improvements to the Gigafactory canvas system. These enhancements add modularity, performance optimizations, and domain-specific features for blockchain research, financial algorithms, and auditing workflows.

## Architecture Components

### 1. Graph Model (`src/lib/graph/`)

#### `GraphModel.ts` - Core Graph Management
- **Purpose**: Manages nodes, connections, and execution logic independently of UI (like LiteGraph's LGraph)
- **Features**:
  - Topological sort for dependency resolution
  - Event-driven execution (only dirty nodes execute)
  - Type-safe connections with compatibility checking
  - JSON serialization for persistence/sharing
  - Execution traces for auditing

#### `GraphNode.ts` - Extensible Node Base Class
- **Purpose**: Base class for all graph nodes (like LiteGraph's LGraphNode)
- **Features**:
  - Typed input/output slots
  - Execution callbacks (`onExecute`)
  - Trace callbacks for auditing (`onTrace`)
  - Dirty flag for change detection
  - Serialization support

#### `types.ts` - Type Definitions
- **Slot Types**: Domain-specific types (`ETHBalance`, `DAGLoadData`, `TPSMetrics`, `BlockchainTx`, `FinancialData`)
- **Connection Types**: Typed connections with validation
- **Serialization Types**: JSON schema for export/import

#### `WorkspaceNodeAdapter.ts` - Bridge Layer
- **Purpose**: Converts existing `Workspace` entities to `GraphNode` instances
- **Usage**: Enables gradual migration from current system to graph model

#### `serialization.ts` - Export/Import Utilities
- **Features**:
  - Export graph to JSON (like `LiteGraph.serialize`)
  - Import graph from JSON
  - Download/upload graph files
  - Version control support

### 2. Canvas Rendering (`src/lib/canvas/`)

#### `ViewportController.ts` - Zoom and Pan
- **Purpose**: Efficient navigation for large graphs
- **Features**:
  - Zoom in/out with mouse wheel
  - Pan with drag
  - Coordinate transformation (screen ↔ world)
  - Configurable min/max scale

## Key Improvements

### 1. Separation of Concerns
- **Before**: UI and logic tightly coupled in `CanvasRoot.tsx`
- **After**: Graph model independent of rendering, enabling:
  - Server-side execution (Node.js simulations)
  - Off-canvas auditing
  - Unit testing of graph logic

### 2. Typed Connections
- **Before**: Simple string arrays for connections
- **After**: Type-safe slots with compatibility checking
  - Prevents invalid connections (e.g., string → math)
  - Domain-specific types for blockchain/finance
  - Visual feedback for type mismatches

### 3. Execution Engine
- **Before**: No execution model
- **After**: Topological sort-based execution
  - Only executes dirty nodes (performance)
  - Dependency resolution
  - Cycle detection
  - Execution traces for auditing

### 4. Performance Optimizations
- **Before**: Full redraw every frame in ticker
- **After**: (To be implemented in CanvasRoot.tsx)
  - Pixi display objects per node/connection
  - Dirty rect updates
  - Viewport culling for off-screen nodes

### 5. Zoom and Pan
- **Before**: Fixed view, no navigation
- **After**: ViewportController for:
  - Mouse wheel zoom
  - Drag to pan
  - Large graph navigation (1000+ nodes)

### 6. JSON Serialization
- **Before**: No export/import
- **After**: Full graph serialization
  - Export workflows for version control
  - Import for rapid iterations
  - Sharing between team members
  - Audit trail preservation

## Usage Examples

### Creating a Graph Node

```typescript
import { GraphNode } from './lib/graph';
import type { GraphSlot } from './lib/graph';

const node = new GraphNode({
  id: 'node-1',
  type: 'workspace',
  title: 'My Workspace',
  x: 100,
  y: 100,
  inputs: [
    { id: 'input', name: 'input', type: 'string', label: 'Input' }
  ],
  outputs: [
    { id: 'output', name: 'output', type: 'string', label: 'Output' }
  ],
  properties: { taskTemplate: 'Do something' }
});

// Set execution callback
node.setExecuteCallback(async (inputs, context) => {
  // Process inputs
  const result = await processData(inputs.input);
  return { output: result };
});
```

### Using GraphModel

```typescript
import { GraphModel } from './lib/graph';

const model = new GraphModel();
model.addNode(node1);
model.addNode(node2);

// Connect with type checking
const connId = model.connect(
  'node-1', 'output',
  'node-2', 'input'
);

// Execute graph (only dirty nodes)
const traces = await model.executeGraph();

// Serialize for export
const json = model.serialize();
```

### Viewport Navigation

```typescript
import { ViewportController } from './lib/canvas/ViewportController';

const viewport = new ViewportController();
viewport.setOnStateChange((state) => {
  // Update Pixi stage transform
  stage.x = state.x;
  stage.y = state.y;
  stage.scale.set(state.scale);
});

// Zoom at mouse position
viewport.zoomAt(1.5, mouseX, mouseY);

// Pan
viewport.pan(deltaX, deltaY);
```

### Export/Import

```typescript
import { exportGraphToJSON, downloadGraphAsFile, importGraphFromJSON } from './lib/graph';

// Export
const json = exportGraphToJSON(model);
downloadGraphAsFile(model, 'my-workflow.json');

// Import
const importedModel = importGraphFromJSON(jsonString);
```

## Integration with CanvasRoot.tsx

The new architecture is designed to integrate gradually with the existing `CanvasRoot.tsx`:

1. **Phase 1**: Use `WorkspaceNodeAdapter` to convert workspaces to nodes
2. **Phase 2**: Replace connection logic with `GraphModel.connect()`
3. **Phase 3**: Add viewport controller for zoom/pan
4. **Phase 4**: Optimize rendering with display objects
5. **Phase 5**: Add execution engine for simulations

## Benefits for Use Cases

### Blockchain Research
- **DAG Models**: Typed slots for `DAGLoadData`, `TPSMetrics`
- **Simulations**: Execute graph in Node.js without UI
- **Auditing**: Execution traces for compliance

### Financial Algorithms
- **Math Nodes**: Type-safe connections for `MathVector`, `FinancialData`
- **Rapid Iterations**: Export/import for version control
- **Live Simulations**: Execute financial models in real-time

### Auditing
- **Traceability**: Full execution traces with inputs/outputs
- **Verification**: Type checking prevents invalid data flows
- **Export**: JSON export for audit trails

## Next Steps

1. **Update CanvasRoot.tsx** to use `GraphModel` and `ViewportController`
2. **Add display object rendering** for performance
3. **Implement context menus** for node properties
4. **Add data flow visualization** (highlight paths on hover)
5. **Create domain-specific node types** (blockchain, finance, math)

## Performance Targets

- **Rendering**: 50-80% reduction in CPU/GPU load for large graphs
- **Execution**: Only dirty nodes execute (topological sort)
- **Navigation**: Smooth 60fps with 1000+ nodes via viewport culling

## References

- LiteGraph.js: https://github.com/jagenjo/litegraph.js
- Pixi.js Viewport: https://github.com/davidfig/pixi-viewport
- Topological Sort: https://en.wikipedia.org/wiki/Topological_sorting
