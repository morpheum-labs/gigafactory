/**
 * Connection Renderer
 * Renders connections between workspaces
 */

import { Graphics } from 'pixi.js';
import type { Workspace } from '../../types/workspace';
import type { ViewportController } from './ViewportController';
import type { WiringState } from '../../stores/ui';
import { calculateVisibleBounds, isPointVisible } from './CanvasUtils';
import { routeBezierCurve, bezierToCubicSegments, type Point, type BezierRoute, SegmentType } from './BezierRouter';

export interface ConnectionRendererOptions {
  lineColor?: number;
  lineWidth?: number;
  lineAlpha?: number;
  activeGlowWidth?: number;
  activeGlowAlpha?: number;
  arrowSize?: number;
  dotRadius?: number;
  showDebugControlPoints?: boolean;
  debugControlPointColor?: number;
  debugControlPointRadius?: number;
  debugLineColor?: number;
  debugLineAlpha?: number;
}

const DEFAULT_OPTIONS: Required<ConnectionRendererOptions> = {
  lineColor: 0x60a5fa,
  lineWidth: 3,
  lineAlpha: 0.6,
  activeGlowWidth: 8,
  activeGlowAlpha: 0.2,
  arrowSize: 10,
  dotRadius: 6,
  showDebugControlPoints: false,
  debugControlPointColor: 0xff6b6b,
  debugControlPointRadius: 5,
  debugLineColor: 0xff6b6b,
  debugLineAlpha: 0.4,
};

/**
 * Render debug control points for a Bezier route
 * OPTIMIZED: Batches graphics operations to reduce expensive fill/stroke calls
 */
function renderDebugControlPoints(
  graphics: Graphics,
  route: BezierRoute | null,
  start: Point,
  end: Point,
  options: Required<ConnectionRendererOptions>
): void {
  if (!route || !options.showDebugControlPoints) return;

  const {
    debugControlPointColor,
    debugControlPointRadius,
    debugLineColor,
    debugLineAlpha,
  } = options;

  // Helper to check if two points are the same (within tolerance)
  const pointsEqual = (p1: Point, p2: Point, tolerance: number = 0.1): boolean => {
    return Math.abs(p1.x - p2.x) < tolerance && Math.abs(p1.y - p2.y) < tolerance;
  };

  // Filter out control points that match start or end to avoid duplicates
  const filteredControlPoints = route.controlPoints.filter(
    cp => !pointsEqual(cp, start) && !pointsEqual(cp, end)
  );

  // Draw lines connecting control points
  graphics.setStrokeStyle({
    width: 1,
    color: debugLineColor,
    alpha: debugLineAlpha,
  });

  // Draw lines between consecutive control points (without duplicates)
  const allPoints = [start, ...filteredControlPoints, end];
  for (let i = 0; i < allPoints.length - 1; i++) {
    graphics.moveTo(allPoints[i].x, allPoints[i].y);
    graphics.lineTo(allPoints[i + 1].x, allPoints[i + 1].y);
  }
  graphics.stroke();

  // OPTIMIZED: Batch all circles with same style together
  // Draw start point (green)
  graphics.setFillStyle({ color: 0x4ade80, alpha: 0.9 });
  graphics.setStrokeStyle({
    width: 2,
    color: 0x4ade80,
    alpha: 1,
  });
  graphics.circle(start.x, start.y, debugControlPointRadius + 1);
  graphics.fill();
  graphics.stroke();

  // Draw control points (batched - all same style)
  if (filteredControlPoints.length > 0) {
    graphics.setFillStyle({ color: debugControlPointColor, alpha: 0.8 });
    graphics.setStrokeStyle({
      width: 2,
      color: debugControlPointColor,
      alpha: 1,
    });
    // Draw all circles first, then fill/stroke once
    for (const cp of filteredControlPoints) {
      graphics.circle(cp.x, cp.y, debugControlPointRadius);
    }
    graphics.fill();
    graphics.stroke();
  }

  // Draw end point (blue)
  graphics.setFillStyle({ color: 0x3b82f6, alpha: 0.9 });
  graphics.setStrokeStyle({
    width: 2,
    color: 0x3b82f6,
    alpha: 1,
  });
  graphics.circle(end.x, end.y, debugControlPointRadius + 1);
  graphics.fill();
  graphics.stroke();

  // Draw waypoints if available (batched)
  if (route.waypoints && route.waypoints.length > 0) {
    graphics.setFillStyle({ color: 0xfbbf24, alpha: 0.7 });
    graphics.setStrokeStyle({
      width: 1,
      color: 0xf59e0b,
      alpha: 0.8,
    });
    // Draw all waypoint circles first, then fill/stroke once
    for (const wp of route.waypoints) {
      graphics.circle(wp.x, wp.y, debugControlPointRadius - 1);
    }
    graphics.fill();
    graphics.stroke();
  }

  // Draw segment classification (batched by color)
  if (route.segments && route.segments.length > 0) {
    // Group segments by color to minimize style changes
    const segmentsByColor = new Map<number, Array<{ x: number; y: number }>>();
    
    for (const seg of route.segments) {
      const midX = (seg.start.x + seg.end.x) / 2;
      const midY = (seg.start.y + seg.end.y) / 2;
      
      let segColor = 0x94a3b8; // gray (default)
      if (seg.type === SegmentType.CRITICAL) {
        segColor = 0xef4444; // red
      } else if (seg.type === SegmentType.FREE) {
        segColor = 0x22c55e; // green
      } else if (seg.type === SegmentType.TRANSITION) {
        segColor = 0xf59e0b; // amber
      }

      if (!segmentsByColor.has(segColor)) {
        segmentsByColor.set(segColor, []);
      }
      segmentsByColor.get(segColor)!.push({ x: midX, y: midY });
    }

    // Draw all segments of the same color together
    for (const [color, points] of segmentsByColor) {
      graphics.setFillStyle({ color, alpha: 0.3 });
      for (const point of points) {
        graphics.circle(point.x, point.y, debugControlPointRadius + 2);
      }
      graphics.fill();
    }
  }
}

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

          // Draw debug control points if enabled
          renderDebugControlPoints(graphics, route, start, destination, opts);
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

        // Draw debug control points if enabled (for simple forward routing)
        if (opts.showDebugControlPoints) {
          const start: Point = { x: fromX, y: fromY };
          const end: Point = { x: lineEndX, y: lineEndY };
          const simpleRoute: BezierRoute = {
            controlPoints: [
              { x: control1X, y: control1Y },
              { x: control2X, y: control2Y },
            ],
            order: 3,
            cost: 0,
            clearance: Infinity,
          };
          renderDebugControlPoints(graphics, simpleRoute, start, end, opts);
        }
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

          // Draw debug control points if enabled
          renderDebugControlPoints(graphics, route, start, destination, opts);
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

          // Draw debug control points if enabled (for fallback routing)
          if (opts.showDebugControlPoints) {
            const start: Point = { x: fromX, y: fromY };
            const end: Point = { x: worldMouse.x, y: worldMouse.y };
            const simpleRoute: BezierRoute = {
              controlPoints: [
                { x: control1X, y: control1Y },
                { x: control2X, y: control2Y },
              ],
              order: 3,
              cost: 0,
              clearance: Infinity,
            };
            renderDebugControlPoints(graphics, simpleRoute, start, end, opts);
          }
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

        // Draw debug control points if enabled (for forward routing)
        if (opts.showDebugControlPoints) {
          const start: Point = { x: fromX, y: fromY };
          const end: Point = { x: worldMouse.x, y: worldMouse.y };
          const simpleRoute: BezierRoute = {
            controlPoints: [
              { x: control1X, y: control1Y },
              { x: control2X, y: control2Y },
            ],
            order: 3,
            cost: 0,
            clearance: Infinity,
          };
          renderDebugControlPoints(graphics, simpleRoute, start, end, opts);
        }
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
