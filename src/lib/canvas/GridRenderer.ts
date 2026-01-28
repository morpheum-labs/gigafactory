/**
 * Grid Renderer
 * Renders the canvas grid background
 */

import { Graphics } from 'pixi.js';
import type { ViewportController } from './ViewportController';
import { GRID_SIZE, GRID_MAJOR_SIZE, calculateVisibleBounds, calculateGridBounds } from './CanvasUtils';

export interface GridRendererOptions {
  gridSize?: number;
  majorSize?: number;
  minorColor?: number;
  minorAlpha?: number;
  majorColor?: number;
  majorAlpha?: number;
  dotColor?: number;
  dotAlpha?: number;
}

const DEFAULT_OPTIONS: Required<GridRendererOptions> = {
  gridSize: GRID_SIZE,
  majorSize: GRID_MAJOR_SIZE,
  minorColor: 0x404060,
  minorAlpha: 0.2,
  majorColor: 0x505070,
  majorAlpha: 0.4,
  dotColor: 0x606080,
  dotAlpha: 0.4,
};

/**
 * Render grid with viewport-aware culling
 */
export function renderGrid(
  graphics: Graphics,
  viewport: ViewportController | null,
  containerRect: DOMRect | null,
  options: GridRendererOptions = {}
): void {
  graphics.clear();
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { gridSize, majorSize, minorColor, minorAlpha, majorColor, majorAlpha, dotColor, dotAlpha } = opts;

  if (viewport && containerRect) {
    // Viewport-aware rendering - only render visible grid
    const bounds = calculateVisibleBounds(viewport, containerRect);
    const gridBounds = calculateGridBounds(bounds, gridSize);
    const viewportState = viewport.getState();
    const scale = viewportState.scale;

    const { startX, startY, endX, endY } = gridBounds;

    // Only draw minor grid lines when zoomed in enough (scale > 0.2)
    // When very zoomed out, minor lines become too dense and cause lag
    if (scale > 0.2) {
      graphics.setStrokeStyle({ width: 1, color: minorColor, alpha: minorAlpha });
      for (let x = startX; x <= endX; x += gridSize) {
        graphics.moveTo(x, startY);
        graphics.lineTo(x, endY);
        graphics.stroke();
      }
      for (let y = startY; y <= endY; y += gridSize) {
        graphics.moveTo(startX, y);
        graphics.lineTo(endX, y);
        graphics.stroke();
      }
    }

    // Draw major grid lines (always visible)
    graphics.setStrokeStyle({ width: 1.5, color: majorColor, alpha: majorAlpha });
    const majorStartX = Math.floor(startX / majorSize) * majorSize;
    const majorStartY = Math.floor(startY / majorSize) * majorSize;
    for (let x = majorStartX; x <= endX; x += majorSize) {
      graphics.moveTo(x, startY);
      graphics.lineTo(x, endY);
      graphics.stroke();
    }
    for (let y = majorStartY; y <= endY; y += majorSize) {
      graphics.moveTo(startX, y);
      graphics.lineTo(endX, y);
      graphics.stroke();
    }

    // Only draw grid dots when zoomed in enough (scale > 0.3)
    // Grid dots are expensive (O(n²)) and cause severe lag when zoomed out
    if (scale > 0.3) {
      graphics.setFillStyle({ color: dotColor, alpha: dotAlpha });
      for (let x = startX; x <= endX; x += gridSize) {
        for (let y = startY; y <= endY; y += gridSize) {
          graphics.circle(x, y, 1.5);
          graphics.fill();
        }
      }
    }
  } else {
    // Fallback: render full grid when viewport not available
    const fallbackSize = 2000;
    
    graphics.setStrokeStyle({ width: 1, color: minorColor, alpha: minorAlpha });
    for (let x = 0; x <= fallbackSize; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, fallbackSize);
      graphics.stroke();
    }
    for (let y = 0; y <= fallbackSize; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(fallbackSize, y);
      graphics.stroke();
    }

    // Major grid lines
    graphics.setStrokeStyle({ width: 1.5, color: majorColor, alpha: majorAlpha });
    for (let x = 0; x <= fallbackSize; x += majorSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, fallbackSize);
      graphics.stroke();
    }
    for (let y = 0; y <= fallbackSize; y += majorSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(fallbackSize, y);
      graphics.stroke();
    }
  }
}
