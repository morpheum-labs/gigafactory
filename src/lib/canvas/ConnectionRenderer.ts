/**
 * Connection Renderer
 * Renders connections between workspaces
 */

import { Graphics } from 'pixi.js';
import type { Workspace } from '../../types/workspace';

export interface ConnectionRendererOptions {
  lineColor?: number;
  lineWidth?: number;
  lineAlpha?: number;
  activeGlowWidth?: number;
  activeGlowAlpha?: number;
  arrowSize?: number;
  dotRadius?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionRendererOptions> = {
  lineColor: 0x60a5fa,
  lineWidth: 3,
  lineAlpha: 0.6,
  activeGlowWidth: 8,
  activeGlowAlpha: 0.2,
  arrowSize: 10,
  dotRadius: 6,
};

/**
 * Render connections between workspaces
 */
export function renderConnections(
  graphics: Graphics,
  workspaces: Record<string, Workspace>,
  options: ConnectionRendererOptions = {}
): void {
  graphics.clear();

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    lineColor,
    lineWidth,
    lineAlpha,
    activeGlowWidth,
    activeGlowAlpha,
    arrowSize,
    dotRadius,
  } = opts;

  Object.values(workspaces).forEach((fromWs) => {
    fromWs.outputConnections?.forEach((toId) => {
      const toWs = workspaces[toId];
      if (!toWs) return;

      // Calculate connection points in world coordinates
      // Note: The stage transform handles conversion to screen coordinates,
      // so we use world coordinates directly (consistent with NodeRenderer and GridRenderer)
      const fromX = fromWs.x + fromWs.width;
      const fromY = fromWs.y + fromWs.height / 2;
      const toX = toWs.x;
      const toY = toWs.y + toWs.height / 2;

      // Calculate bezier control offset in world space
      const controlOffset = Math.min(100, Math.abs(toX - fromX) / 2);
      const isActive = fromWs.state === 'working' || toWs.state === 'working';

      // Calculate where the line should end (just before the arrow base)
      // The arrow tip is at toX, and the base is at toX - arrowSize
      const lineEndX = toX - arrowSize;

      // Draw active glow
      if (isActive) {
        graphics.setStrokeStyle({
          width: activeGlowWidth,
          color: lineColor,
          alpha: activeGlowAlpha,
        });
        graphics.moveTo(fromX, fromY);
        graphics.bezierCurveTo(
          fromX + controlOffset,
          fromY,
          lineEndX - controlOffset,
          toY,
          lineEndX,
          toY
        );
        graphics.stroke();
      }

      // Draw connection line (ends just before arrow base, so arrow tip is visible)
      graphics.setStrokeStyle({
        width: lineWidth,
        color: lineColor,
        alpha: isActive ? 1 : lineAlpha,
      });
      graphics.moveTo(fromX, fromY);
      graphics.bezierCurveTo(
        fromX + controlOffset,
        fromY,
        lineEndX - controlOffset,
        toY,
        lineEndX,
        toY
      );
      graphics.stroke();

      // Draw arrow (tip at toX, base at toX - arrowSize)
      graphics.setFillStyle({ color: lineColor, alpha: 0.9 });
      graphics.moveTo(toX, toY);
      graphics.lineTo(toX - arrowSize, toY - arrowSize / 2);
      graphics.lineTo(toX - arrowSize, toY + arrowSize / 2);
      graphics.closePath();
      graphics.fill();

      // Draw source dot
      graphics.setFillStyle({ color: lineColor, alpha: 1 });
      graphics.circle(fromX, fromY, dotRadius);
      graphics.fill();
    });
  });
}
