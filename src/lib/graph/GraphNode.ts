/**
 * Base Graph Node Class - LiteGraph.js inspired
 * Extensible node with typed inputs/outputs and execution callbacks
 */

import type { GraphSlot, SlotType, GraphNodeData } from './types';

export interface NodeExecuteCallback {
  (inputs: Record<string, unknown>, context: { nodeId: string }): Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface NodeTraceCallback {
  (nodeId: string, data: unknown): void;
}

export class GraphNode {
  public id: string;
  public type: string;
  public title: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public inputs: GraphSlot[];
  public outputs: GraphSlot[];
  public properties: Record<string, unknown>;
  public dirty: boolean = true;
  public executed: boolean = false;
  public executionTime: number = 0;
  public lastOutput: Record<string, unknown> = {};

  private onExecute?: NodeExecuteCallback;
  private onTrace?: NodeTraceCallback;

  constructor(data: Partial<GraphNodeData> & { id: string; type: string; title: string }) {
    this.id = data.id;
    this.type = data.type;
    this.title = data.title;
    this.x = data.x ?? 0;
    this.y = data.y ?? 0;
    this.width = data.width ?? 280;
    this.height = data.height ?? 200;
    this.inputs = data.inputs ?? [];
    this.outputs = data.outputs ?? [];
    this.properties = data.properties ?? {};
    this.dirty = data.dirty ?? true;
    this.executed = data.executed ?? false;
    this.executionTime = data.executionTime ?? 0;
  }

  /**
   * Set execution callback (like LiteGraph's onExecute)
   */
  setExecuteCallback(callback: NodeExecuteCallback): void {
    this.onExecute = callback;
  }

  /**
   * Set trace callback for auditing
   */
  setTraceCallback(callback: NodeTraceCallback): void {
    this.onTrace = callback;
  }

  /**
   * Execute node with given inputs
   */
  async execute(inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    const startTime = performance.now();
    this.dirty = false;

    try {
      let outputs: Record<string, unknown> = {};

      if (this.onExecute) {
        outputs = await this.onExecute(inputs, { nodeId: this.id });
      } else {
        // Default: pass through inputs to outputs
        outputs = { ...inputs };
      }

      this.executionTime = performance.now() - startTime;
      this.executed = true;
      this.lastOutput = outputs;

      if (this.onTrace) {
        this.onTrace(this.id, { inputs, outputs, executionTime: this.executionTime });
      }

      return outputs;
    } catch (error) {
      this.executed = false;
      throw error;
    }
  }

  /**
   * Mark node as dirty (needs re-execution)
   */
  markDirty(): void {
    this.dirty = true;
    this.executed = false;
  }

  /**
   * Check if slot types are compatible
   */
  static areSlotsCompatible(outputType: SlotType, inputType: SlotType): boolean {
    if (outputType === 'any' || inputType === 'any') return true;
    if (outputType === inputType) return true;
    // Allow some type conversions
    if (outputType === 'number' && inputType === 'string') return true;
    if (outputType === 'string' && inputType === 'number') return true;
    return false;
  }

  /**
   * Serialize node to JSON
   */
  serialize(): GraphNodeData {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      inputs: this.inputs,
      outputs: this.outputs,
      properties: this.properties,
      dirty: this.dirty,
      executed: this.executed,
      executionTime: this.executionTime,
    };
  }

  /**
   * Deserialize node from JSON
   */
  static deserialize(data: GraphNodeData): GraphNode {
    return new GraphNode(data);
  }
}
