/**
 * Canvas Utility Functions
 * Reusable utilities for canvas operations
 */

import type { ViewportController } from './ViewportController';

// Grid configuration constants
export const GRID_SIZE = 40; // Grid cell size in pixels
export const GRID_MAJOR_SIZE = 200; // Major grid lines every 5 cells (40 * 5)

// Re-export for backward compatibility
export { GRID_SIZE as DEFAULT_GRID_SIZE, GRID_MAJOR_SIZE as DEFAULT_GRID_MAJOR_SIZE };

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Snap position to grid
 */
export function snapPositionToGrid(
  x: number,
  y: number,
  gridSize: number = GRID_SIZE,
  enabled: boolean = true
): { x: number; y: number } {
  if (!enabled) return { x, y };
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

/**
 * Calculate visible world bounds from viewport
 */
export function calculateVisibleBounds(
  viewport: ViewportController,
  containerRect: DOMRect
): Bounds {
  const topLeft = viewport.screenToWorld(0, 0);
  const bottomRight = viewport.screenToWorld(containerRect.width, containerRect.height);
  
  return {
    minX: Math.min(topLeft.x, bottomRight.x),
    minY: Math.min(topLeft.y, bottomRight.y),
    maxX: Math.max(topLeft.x, bottomRight.x),
    maxY: Math.max(topLeft.y, bottomRight.y),
  };
}

/**
 * Calculate grid bounds for rendering
 */
export function calculateGridBounds(
  bounds: Bounds,
  gridSize: number = GRID_SIZE
): { startX: number; startY: number; endX: number; endY: number } {
  return {
    startX: Math.floor(bounds.minX / gridSize) * gridSize - gridSize,
    startY: Math.floor(bounds.minY / gridSize) * gridSize - gridSize,
    endX: Math.ceil(bounds.maxX / gridSize) * gridSize + gridSize,
    endY: Math.ceil(bounds.maxY / gridSize) * gridSize + gridSize,
  };
}

/**
 * Check if a workspace is visible in the viewport
 */
export function isWorkspaceVisible(
  workspace: { x: number; y: number; width: number; height: number },
  bounds: Bounds
): boolean {
  return !(
    workspace.x + workspace.width < bounds.minX ||
    workspace.x > bounds.maxX ||
    workspace.y + workspace.height < bounds.minY ||
    workspace.y > bounds.maxY
  );
}

/**
 * Check if a point is visible in the viewport
 */
export function isPointVisible(x: number, y: number, bounds: Bounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}
