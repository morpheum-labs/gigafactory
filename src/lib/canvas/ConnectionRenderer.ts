/**
 * Connection Renderer
 * Renders connections between workspaces
 */

import { Graphics } from 'pixi.js';
import type { Workspace } from '../../types/workspace';
import type { ViewportController } from './ViewportController';
import type { WiringState } from '../../stores/ui';
import { calculateVisibleBounds, isPointVisible } from './CanvasUtils';
import { routeBezierCurve, bezierToCubicSegments, type Point } from './BezierRouter';

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
  wiring?: WiringState,
  viewport?: ViewportController | null,
  containerRect?: DOMRect | null,
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

  // Calculate visible bounds for viewport culling
  let visibleBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (viewport && containerRect) {
    visibleBounds = calculateVisibleBounds(viewport, containerRect);
  }

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

      // Viewport culling: only render if at least one endpoint is visible
      // This significantly improves performance when zoomed out
      if (visibleBounds) {
        const fromVisible = isPointVisible(fromX, fromY, visibleBounds);
        const toVisible = isPointVisible(toX, toY, visibleBounds);
        if (!fromVisible && !toVisible) {
          return; // Skip rendering this connection
        }
      }

      // Calculate bezier control offset in world space
      const horizontalDistance = toX - fromX;
      const isBackward = horizontalDistance < 0; // Target is to the left of source
      
      const isActive = fromWs.state === 'working' || toWs.state === 'working';

      // Calculate where the line should end (just before the arrow base)
      // The arrow tip is at toX, and the base is at toX - arrowSize
      const lineEndX = toX - arrowSize;
      const lineEndY = toY;

      // Use optimized Bézier routing for backward connections or when workspaces need avoidance
      let useOptimizedRouting = isBackward;
      
      // For backward routing, use the A*-inspired router
      if (useOptimizedRouting) {
        const start: Point = { x: fromX, y: fromY };
        const destination: Point = { x: lineEndX, y: lineEndY };
        
        const route = routeBezierCurve(
          start,
          destination,
          workspaces
        );
        
        if (route && route.controlPoints.length > 0) {
          // Convert higher-order Bézier to cubic segments for rendering
          const segments = bezierToCubicSegments(route.controlPoints);
          
          // Draw active glow
          if (isActive) {
            graphics.setStrokeStyle({
              width: activeGlowWidth,
              color: lineColor,
              alpha: activeGlowAlpha,
            });
            graphics.moveTo(fromX, fromY);
            for (const segment of segments) {
              graphics.bezierCurveTo(
                segment.cp1.x,
                segment.cp1.y,
                segment.cp2.x,
                segment.cp2.y,
                segment.end.x,
                segment.end.y
              );
            }
            graphics.stroke();
          }

          // Draw connection line
          graphics.setStrokeStyle({
            width: lineWidth,
            color: lineColor,
            alpha: isActive ? 1 : lineAlpha,
          });
          graphics.moveTo(fromX, fromY);
          for (const segment of segments) {
            graphics.bezierCurveTo(
              segment.cp1.x,
              segment.cp1.y,
              segment.cp2.x,
              segment.cp2.y,
              segment.end.x,
              segment.end.y
            );
          }
          graphics.stroke();
        } else {
          // Fallback to simple routing if optimization fails
          const maxHeight = Math.max(fromWs.height, toWs.height);
          const verticalOffset = maxHeight * 0.8;
          const midY = (fromY + toY) / 2;
          const curveUp = fromY > midY || toY > midY;
          const curveY = curveUp 
            ? Math.min(fromY, toY) - verticalOffset
            : Math.max(fromY, toY) + verticalOffset;
          const horizontalOffset = Math.max(80, Math.abs(horizontalDistance) * 0.3);
          
          if (isActive) {
            graphics.setStrokeStyle({
              width: activeGlowWidth,
              color: lineColor,
              alpha: activeGlowAlpha,
            });
            graphics.moveTo(fromX, fromY);
            graphics.bezierCurveTo(
              fromX + horizontalOffset,
              curveY,
              lineEndX - horizontalOffset,
              curveY,
              lineEndX,
              lineEndY
            );
            graphics.stroke();
          }

          graphics.setStrokeStyle({
            width: lineWidth,
            color: lineColor,
            alpha: isActive ? 1 : lineAlpha,
          });
          graphics.moveTo(fromX, fromY);
          graphics.bezierCurveTo(
            fromX + horizontalOffset,
            curveY,
            lineEndX - horizontalOffset,
            curveY,
            lineEndX,
            lineEndY
          );
          graphics.stroke();
        }
      } else {
        // Normal forward routing (simple cubic Bézier)
        const controlOffset = Math.min(100, Math.abs(horizontalDistance) / 2);
        const control1X = fromX + controlOffset;
        const control1Y = fromY;
        const control2X = lineEndX - controlOffset;
        const control2Y = lineEndY;

        // Draw active glow
        if (isActive) {
          graphics.setStrokeStyle({
            width: activeGlowWidth,
            color: lineColor,
            alpha: activeGlowAlpha,
          });
          graphics.moveTo(fromX, fromY);
          graphics.bezierCurveTo(
            control1X,
            control1Y,
            control2X,
            control2Y,
            lineEndX,
            lineEndY
          );
          graphics.stroke();
        }

        // Draw connection line
        graphics.setStrokeStyle({
          width: lineWidth,
          color: lineColor,
          alpha: isActive ? 1 : lineAlpha,
        });
        graphics.moveTo(fromX, fromY);
        graphics.bezierCurveTo(
          control1X,
          control1Y,
          control2X,
          control2Y,
          lineEndX,
          lineEndY
        );
        graphics.stroke();
      }

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

  // Render wiring preview if active
  if (wiring?.isWiring && wiring.fromWorkspaceId && wiring.fromType && viewport) {
    const fromWs = workspaces[wiring.fromWorkspaceId];
    if (fromWs) {
      // Convert mouse position from screen to world coordinates
      const worldMouse = viewport.screenToWorld(wiring.mouseX, wiring.mouseY);
      
      // Calculate start point
      const fromX = wiring.fromType === 'output' 
        ? fromWs.x + fromWs.width 
        : fromWs.x;
      const fromY = fromWs.y + fromWs.height / 2;
      
      // Calculate bezier control points for wiring preview
      const horizontalDistance = worldMouse.x - fromX;
      const isBackward = (wiring.fromType === 'output' && horizontalDistance < 0) || 
                         (wiring.fromType === 'input' && horizontalDistance > 0);
      
      const wiringColor = 0x22d3ee; // cyan
      
      // Use optimized routing for backward wiring preview
      if (isBackward) {
        const start: Point = { x: fromX, y: fromY };
        const destination: Point = { x: worldMouse.x, y: worldMouse.y };
        
        const route = routeBezierCurve(
          start,
          destination,
          workspaces
        );
        
        if (route && route.controlPoints.length > 0) {
          const segments = bezierToCubicSegments(route.controlPoints);
          
          // Draw glow layer
          graphics.setStrokeStyle({
            width: 8,
            color: wiringColor,
            alpha: 0.4,
          });
          graphics.moveTo(fromX, fromY);
          for (const segment of segments) {
            graphics.bezierCurveTo(
              segment.cp1.x,
              segment.cp1.y,
              segment.cp2.x,
              segment.cp2.y,
              segment.end.x,
              segment.end.y
            );
          }
          graphics.stroke();
          
          // Draw main wiring line
          graphics.setStrokeStyle({
            width: 5,
            color: wiringColor,
            alpha: 1,
          });
          graphics.moveTo(fromX, fromY);
          for (const segment of segments) {
            graphics.bezierCurveTo(
              segment.cp1.x,
              segment.cp1.y,
              segment.cp2.x,
              segment.cp2.y,
              segment.end.x,
              segment.end.y
            );
          }
          graphics.stroke();
        } else {
          // Fallback to simple routing
          const verticalOffset = fromWs.height * 0.8;
          const curveY = fromY - verticalOffset;
          const horizontalOffset = Math.max(80, Math.abs(horizontalDistance) * 0.3);
          const control1X = wiring.fromType === 'output' 
            ? fromX + horizontalOffset 
            : fromX - horizontalOffset;
          const control1Y = curveY;
          const control2X = wiring.fromType === 'output'
            ? worldMouse.x - horizontalOffset
            : worldMouse.x + horizontalOffset;
          const control2Y = curveY;
          
          graphics.setStrokeStyle({
            width: 8,
            color: wiringColor,
            alpha: 0.4,
          });
          graphics.moveTo(fromX, fromY);
          graphics.bezierCurveTo(control1X, control1Y, control2X, control2Y, worldMouse.x, worldMouse.y);
          graphics.stroke();
          
          graphics.setStrokeStyle({
            width: 5,
            color: wiringColor,
            alpha: 1,
          });
          graphics.moveTo(fromX, fromY);
          graphics.bezierCurveTo(control1X, control1Y, control2X, control2Y, worldMouse.x, worldMouse.y);
          graphics.stroke();
        }
      } else {
        // Normal forward routing
        const controlOffset = wiring.fromType === 'output' ? 80 : -80;
        const control1X = fromX + controlOffset;
        const control1Y = fromY;
        const control2X = worldMouse.x + (wiring.fromType === 'output' ? -80 : 80);
        const control2Y = worldMouse.y;
        
        // Draw glow layer
        graphics.setStrokeStyle({
          width: 8,
          color: wiringColor,
          alpha: 0.4,
        });
        graphics.moveTo(fromX, fromY);
        graphics.bezierCurveTo(control1X, control1Y, control2X, control2Y, worldMouse.x, worldMouse.y);
        graphics.stroke();
        
        // Draw main wiring line
        graphics.setStrokeStyle({
          width: 5,
          color: wiringColor,
          alpha: 1,
        });
        graphics.moveTo(fromX, fromY);
        graphics.bezierCurveTo(control1X, control1Y, control2X, control2Y, worldMouse.x, worldMouse.y);
        graphics.stroke();
      }
      
      // Draw arrow at end
      graphics.setFillStyle({ color: wiringColor, alpha: 1 });
      graphics.moveTo(worldMouse.x, worldMouse.y);
      graphics.lineTo(worldMouse.x - 12, worldMouse.y - 4.5);
      graphics.lineTo(worldMouse.x - 12, worldMouse.y + 4.5);
      graphics.closePath();
      graphics.fill();
      
      // Draw start dot
      graphics.setFillStyle({ color: wiringColor, alpha: 1 });
      graphics.circle(fromX, fromY, 8);
      graphics.fill();
      
      // Draw end point (animated pulsing effect via size)
      graphics.setFillStyle({ color: wiringColor, alpha: 0.6 });
      graphics.circle(worldMouse.x, worldMouse.y, 10);
      graphics.fill();
    }
  }
}
