/**
 * Workspace Node Adapter - Bridges existing Workspace system with GraphModel
 * Converts Workspace entities to GraphNode instances
 */

import { GraphNode } from './GraphNode';
import type { Workspace } from '../../types/workspace';
import type { GraphSlot } from './types';

/**
 * Create a GraphNode from a Workspace
 */
export function createNodeFromWorkspace(workspace: Workspace): GraphNode {
  // Default slots for workspace nodes
  const inputSlot: GraphSlot = {
    id: 'input',
    name: 'input',
    type: 'any',
    label: 'Input',
  };

  const outputSlot: GraphSlot = {
    id: 'output',
    name: 'output',
    type: 'any',
    label: 'Output',
  };

  const node = new GraphNode({
    id: workspace.id,
    type: 'workspace',
    title: workspace.name,
    x: workspace.x,
    y: workspace.y,
    width: workspace.width,
    height: workspace.height,
    inputs: [inputSlot],
    outputs: [outputSlot],
    properties: {
      state: workspace.state,
      agentId: workspace.agentId,
      taskTemplate: workspace.taskTemplate,
      lastOutput: workspace.lastOutput,
      autoRun: workspace.autoRun,
      model: workspace.model,
      cli: workspace.cli,
      mode: workspace.mode,
      systemPrompt: workspace.systemPrompt,
    },
  });

  return node;
}

/**
 * Update workspace from graph node
 */
export function updateWorkspaceFromNode(_workspace: Workspace, node: GraphNode): Partial<Workspace> {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    name: node.title,
  };
}
