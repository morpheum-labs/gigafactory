/**
 * Drawing Preview Renderer
 * Renders the preview rectangle when drawing a new workspace
 */

import { Graphics } from 'pixi.js';

export interface DrawingState {
  isDrawing: boolean;
  start: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
}

export interface DrawingPreviewRendererOptions {
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeWidth?: number;
  strokeAlpha?: number;
}

const DEFAULT_OPTIONS: Required<DrawingPreviewRendererOptions> = {
  fillColor: 0x4299e1,
  fillAlpha: 0.15,
  strokeColor: 0x4299e1,
  strokeWidth: 3,
  strokeAlpha: 1,
};

/**
 * Render drawing preview rectangle
 */
export function renderDrawingPreview(
  graphics: Graphics,
  drawing: DrawingState,
  options: DrawingPreviewRendererOptions = {}
): void {
  if (!drawing.isDrawing || !drawing.start || !drawing.current) {
    return;
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { fillColor, fillAlpha, strokeColor, strokeWidth, strokeAlpha } = opts;

  const x = Math.min(drawing.start.x, drawing.current.x);
  const y = Math.min(drawing.start.y, drawing.current.y);
  const width = Math.abs(drawing.current.x - drawing.start.x);
  const height = Math.abs(drawing.current.y - drawing.start.y);

  // Draw fill
  graphics.setFillStyle({ color: fillColor, alpha: fillAlpha });
  graphics.rect(x, y, width, height);
  graphics.fill();

  // Draw stroke
  graphics.setStrokeStyle({
    width: strokeWidth,
    color: strokeColor,
    alpha: strokeAlpha,
  });
  graphics.rect(x, y, width, height);
  graphics.stroke();
}
