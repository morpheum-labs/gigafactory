/**
 * Graph Model Types - LiteGraph.js inspired architecture
 * Typed connection slots for data flow validation
 */

export type SlotType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'object' 
  | 'array'
  | 'any'
  | 'ETHBalance'
  | 'AlgoOutput'
  | 'MathVector'
  | 'DAGLoadData'
  | 'TPSMetrics'
  | 'BlockchainTx'
  | 'FinancialData';

export interface GraphSlot {
  id: string;
  name: string;
  type: SlotType;
  label?: string;
  optional?: boolean;
}

export interface GraphConnection {
  id: string;
  fromNodeId: string;
  fromSlotId: string;
  toNodeId: string;
  toSlotId: string;
  data?: unknown;
  label?: string;
}

export interface GraphNodeData {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  inputs: GraphSlot[];
  outputs: GraphSlot[];
  properties: Record<string, unknown>;
  dirty?: boolean;
  executed?: boolean;
  executionTime?: number;
}

export interface GraphSerialized {
  nodes: GraphNodeData[];
  connections: GraphConnection[];
  version: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  nodeId: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  timestamp: number;
}

export interface ExecutionTrace {
  nodeId: string;
  executionTime: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
}
