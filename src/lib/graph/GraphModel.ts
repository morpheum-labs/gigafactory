/**
 * Graph Model - LiteGraph.js inspired LGraph equivalent
 * Manages nodes, connections, and execution logic independently of UI
 */

import { GraphNode } from './GraphNode';
import type { GraphConnection, GraphSerialized, ExecutionTrace } from './types';
import { nanoid } from 'nanoid';

export class GraphModel {
  private nodes: Map<string, GraphNode> = new Map();
  private connections: Map<string, GraphConnection> = new Map();
  private executionTraces: ExecutionTrace[] = [];
  private executionOrder: string[] = [];

  /**
   * Add node to graph
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    this.invalidateExecutionOrder();
  }

  /**
   * Remove node and its connections
   */
  removeNode(nodeId: string): void {
    // Remove all connections involving this node
    const connectionsToRemove: string[] = [];
    this.connections.forEach((conn, id) => {
      if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
        connectionsToRemove.push(id);
      }
    });
    connectionsToRemove.forEach(id => this.connections.delete(id));

    this.nodes.delete(nodeId);
    this.invalidateExecutionOrder();
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Connect two nodes with type checking
   */
  connect(
    fromNodeId: string,
    fromSlotId: string,
    toNodeId: string,
    toSlotId: string,
    label?: string
  ): string | null {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);

    if (!fromNode || !toNode) return null;

    // Find slots
    const fromSlot = fromNode.outputs.find(s => s.id === fromSlotId);
    const toSlot = toNode.inputs.find(s => s.id === toSlotId);

    if (!fromSlot || !toSlot) return null;

    // Type compatibility check
    if (!GraphNode.areSlotsCompatible(fromSlot.type, toSlot.type)) {
      console.warn(`Type mismatch: ${fromSlot.type} -> ${toSlot.type}`);
      return null;
    }

    // Check for duplicate connection
    const existing = Array.from(this.connections.values()).find(
      c => c.fromNodeId === fromNodeId &&
           c.fromSlotId === fromSlotId &&
           c.toNodeId === toNodeId &&
           c.toSlotId === toSlotId
    );
    if (existing) return existing.id;

    const connectionId = nanoid();
    const connection: GraphConnection = {
      id: connectionId,
      fromNodeId,
      fromSlotId,
      toNodeId,
      toSlotId,
      label,
    };

    this.connections.set(connectionId, connection);
    toNode.markDirty();
    this.invalidateExecutionOrder();

    return connectionId;
  }

  /**
   * Disconnect nodes
   */
  disconnect(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const toNode = this.nodes.get(connection.toNodeId);
      if (toNode) {
        toNode.markDirty();
      }
      this.connections.delete(connectionId);
      this.invalidateExecutionOrder();
    }
  }

  /**
   * Get connections for a node
   */
  getNodeConnections(nodeId: string): GraphConnection[] {
    return Array.from(this.connections.values()).filter(
      c => c.fromNodeId === nodeId || c.toNodeId === nodeId
    );
  }

  /**
   * Get input connections for a node
   */
  getInputConnections(nodeId: string): GraphConnection[] {
    return Array.from(this.connections.values()).filter(c => c.toNodeId === nodeId);
  }

  /**
   * Get output connections for a node
   */
  getOutputConnections(nodeId: string): GraphConnection[] {
    return Array.from(this.connections.values()).filter(c => c.fromNodeId === nodeId);
  }

  /**
   * Compute topological sort for execution order
   */
  private computeExecutionOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) {
        // Cycle detected
        console.warn(`Cycle detected in graph at node ${nodeId}`);
        return false;
      }
      if (visited.has(nodeId)) return true;

      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (!node) return false;

      // Visit dependencies first
      const inputConnections = this.getInputConnections(nodeId);
      for (const conn of inputConnections) {
        if (!visit(conn.fromNodeId)) return false;
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
      return true;
    };

    // Visit all nodes
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (!visit(nodeId)) {
          return []; // Cycle detected
        }
      }
    }

    return order;
  }

  /**
   * Invalidate and recompute execution order
   */
  private invalidateExecutionOrder(): void {
    this.executionOrder = [];
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(): string[] {
    if (this.executionOrder.length === 0) {
      this.executionOrder = this.computeExecutionOrder();
    }
    return [...this.executionOrder];
  }

  /**
   * Execute graph (only dirty nodes)
   */
  async executeGraph(): Promise<ExecutionTrace[]> {
    const traces: ExecutionTrace[] = [];
    const order = this.getExecutionOrder();

    for (const nodeId of order) {
      const node = this.nodes.get(nodeId);
      if (!node || (!node.dirty && node.executed)) continue;

      try {
        // Gather inputs from connections
        const inputs: Record<string, unknown> = {};
        const inputConnections = this.getInputConnections(nodeId);

        for (const conn of inputConnections) {
          const fromNode = this.nodes.get(conn.fromNodeId);
          if (fromNode && fromNode.lastOutput[conn.fromSlotId] !== undefined) {
            inputs[conn.toSlotId] = fromNode.lastOutput[conn.fromSlotId];
          }
        }

        const startTime = performance.now();
        const outputs = await node.execute(inputs);
        const executionTime = performance.now() - startTime;

        traces.push({
          nodeId,
          executionTime,
          inputs,
          outputs,
        });
      } catch (error) {
        traces.push({
          nodeId,
          executionTime: 0,
          inputs: {},
          outputs: {},
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.executionTraces = traces;
    return traces;
  }

  /**
   * Get execution traces for auditing
   */
  getExecutionTraces(): ExecutionTrace[] {
    return [...this.executionTraces];
  }

  /**
   * Clear execution traces
   */
  clearTraces(): void {
    this.executionTraces = [];
  }

  /**
   * Serialize graph to JSON (like LiteGraph.serialize)
   */
  serialize(): GraphSerialized {
    return {
      nodes: Array.from(this.nodes.values()).map(n => n.serialize()),
      connections: Array.from(this.connections.values()),
      version: '1.0.0',
      metadata: {
        nodeCount: this.nodes.size,
        connectionCount: this.connections.size,
      },
    };
  }

  /**
   * Deserialize graph from JSON
   */
  static deserialize(data: GraphSerialized): GraphModel {
    const model = new GraphModel();

    // Deserialize nodes
    for (const nodeData of data.nodes) {
      const node = GraphNode.deserialize(nodeData);
      model.addNode(node);
    }

    // Deserialize connections
    for (const conn of data.connections) {
      model.connect(
        conn.fromNodeId,
        conn.fromSlotId,
        conn.toNodeId,
        conn.toSlotId,
        conn.label
      );
    }

    return model;
  }

  /**
   * Clear all nodes and connections
   */
  clear(): void {
    this.nodes.clear();
    this.connections.clear();
    this.executionTraces = [];
    this.executionOrder = [];
  }
}
