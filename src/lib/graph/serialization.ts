/**
 * Graph Serialization Utilities
 * Export/Import workflows for rapid iterations and auditing
 */

import { GraphModel } from './GraphModel';
import type { GraphSerialized } from './types';

/**
 * Export graph to JSON string
 */
export function exportGraphToJSON(model: GraphModel, pretty: boolean = true): string {
  const serialized = model.serialize();
  return pretty
    ? JSON.stringify(serialized, null, 2)
    : JSON.stringify(serialized);
}

/**
 * Import graph from JSON string
 */
export function importGraphFromJSON(json: string): GraphModel | null {
  try {
    const data: GraphSerialized = JSON.parse(json);
    return GraphModel.deserialize(data);
  } catch (error) {
    console.error('Failed to import graph:', error);
    return null;
  }
}

/**
 * Download graph as JSON file
 */
export function downloadGraphAsFile(model: GraphModel, filename: string = 'gigafactory-graph.json'): void {
  const json = exportGraphToJSON(model, true);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Load graph from file
 */
export function loadGraphFromFile(file: File): Promise<GraphModel | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      resolve(importGraphFromJSON(json));
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
