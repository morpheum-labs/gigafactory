/**
 * Bézier Curve Router with Workspace Avoidance
 * Implements A*-inspired optimization for backward routing with higher-order curves
 */

import type { Workspace } from '../../types/workspace';

export interface Point {
  x: number;
  y: number;
}

export interface WorkspaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export interface BezierRoute {
  controlPoints: Point[];
  order: number;
  cost: number;
  clearance: number;
}

// Configuration constants
const MIN_CLEARANCE = 20; // Minimum distance from workspaces
const MAX_BEZIER_ORDER = 6; // Maximum control points (order + 1)
const COLLISION_SAMPLES = 50; // Samples for collision detection
const OPTIMIZATION_ITERATIONS = 20; // Max iterations for gradient descent

/**
 * Convert workspace to bounds for collision detection
 */
function workspaceToBounds(ws: Workspace): WorkspaceBounds {
  return {
    x: ws.x,
    y: ws.y,
    width: ws.width,
    height: ws.height,
    right: ws.x + ws.width,
    bottom: ws.y + ws.height,
  };
}

/**
 * Check if a point is inside a workspace rectangle
 */
function pointInBounds(point: Point, bounds: WorkspaceBounds): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.right &&
    point.y >= bounds.y &&
    point.y <= bounds.bottom
  );
}

/**
 * Calculate distance from point to rectangle (0 if inside)
 */
function distanceToRectangle(point: Point, bounds: WorkspaceBounds): number {
  const dx = Math.max(bounds.x - point.x, 0, point.x - bounds.right);
  const dy = Math.max(bounds.y - point.y, 0, point.y - bounds.bottom);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Evaluate a Bézier curve at parameter t
 * Supports arbitrary order (n control points = degree n-1)
 */
function evaluateBezier(controlPoints: Point[], t: number): Point {
  const n = controlPoints.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return controlPoints[0];
  if (t <= 0) return controlPoints[0];
  if (t >= 1) return controlPoints[n - 1];

  // De Casteljau's algorithm for stability
  const points = [...controlPoints];
  for (let level = n - 1; level > 0; level--) {
    for (let i = 0; i < level; i++) {
      points[i] = {
        x: (1 - t) * points[i].x + t * points[i + 1].x,
        y: (1 - t) * points[i].y + t * points[i + 1].y,
      };
    }
  }
  return points[0];
}

/**
 * Calculate approximate length of Bézier curve
 */
function bezierLength(controlPoints: Point[], samples: number = 20): number {
  if (controlPoints.length < 2) return 0;
  
  let length = 0;
  let prev = controlPoints[0];
  
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const curr = evaluateBezier(controlPoints, t);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }
  
  return length;
}

/**
 * Check if Bézier curve collides with any workspace
 */
function curveCollides(
  controlPoints: Point[],
  workspaces: WorkspaceBounds[],
  samples: number = COLLISION_SAMPLES
): boolean {
  if (controlPoints.length < 2) return false;

  // Fast bounding box check first
  const bbox = bezierBoundingBox(controlPoints);
  if (!bboxIntersectsAny(bbox, workspaces)) {
    return false;
  }

  // Detailed sampling check
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateBezier(controlPoints, t);
    
    for (const ws of workspaces) {
      if (pointInBounds(point, ws)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate bounding box of Bézier curve
 */
function bezierBoundingBox(controlPoints: Point[]): WorkspaceBounds {
  if (controlPoints.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  let minX = controlPoints[0].x;
  let minY = controlPoints[0].y;
  let maxX = controlPoints[0].x;
  let maxY = controlPoints[0].y;

  // Check control points
  for (const p of controlPoints) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  // For cubic and higher, check extrema
  // Simplified: sample curve for extrema
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const p = evaluateBezier(controlPoints, t);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    right: maxX,
    bottom: maxY,
  };
}

/**
 * Check if bounding box intersects any workspace
 */
function bboxIntersectsAny(
  bbox: WorkspaceBounds,
  workspaces: WorkspaceBounds[]
): boolean {
  for (const ws of workspaces) {
    if (
      bbox.right >= ws.x &&
      bbox.x <= ws.right &&
      bbox.bottom >= ws.y &&
      bbox.y <= ws.bottom
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate minimum clearance from curve to workspaces
 */
function calculateClearance(
  controlPoints: Point[],
  workspaces: WorkspaceBounds[],
  samples: number = COLLISION_SAMPLES
): number {
  if (workspaces.length === 0) return Infinity;
  
  let minClearance = Infinity;
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateBezier(controlPoints, t);
    
    for (const ws of workspaces) {
      const dist = distanceToRectangle(point, ws);
      minClearance = Math.min(minClearance, dist);
    }
  }
  
  return minClearance;
}

/**
 * Calculate cost function for route optimization
 */
function calculateRouteCost(
  controlPoints: Point[],
  workspaces: WorkspaceBounds[],
  destination: Point
): { cost: number; clearance: number; length: number } {
  const length = bezierLength(controlPoints);
  const clearance = calculateClearance(controlPoints, workspaces);
  
  // Distance from last control point to destination (heuristic)
  const lastPoint = controlPoints[controlPoints.length - 1];
  const distanceToDest = Math.sqrt(
    (lastPoint.x - destination.x) ** 2 + (lastPoint.y - destination.y) ** 2
  );
  
  // Cost components
  const lengthWeight = 1.0;
  const clearanceWeight = 10.0; // Penalize low clearance
  const distanceWeight = 0.5;
  
  // Penalty for insufficient clearance
  const clearancePenalty = clearance < MIN_CLEARANCE 
    ? (MIN_CLEARANCE - clearance) * 100 
    : 0;
  
  const cost = 
    length * lengthWeight +
    clearancePenalty * clearanceWeight +
    distanceToDest * distanceWeight;
  
  return { cost, clearance, length };
}

/**
 * Generate initial control points for backward routing
 * Uses safe directions to avoid workspaces
 */
function generateInitialControlPoints(
  start: Point,
  destination: Point,
  workspaces: WorkspaceBounds[],
  order: number
): Point[] {
  const points: Point[] = [start];
  
  // Calculate safe initial direction from destination
  const dx = destination.x - start.x;
  const dy = destination.y - start.y;
  
  // For backward routing, we want to curve away from workspaces
  // Find the best vertical direction to avoid workspaces
  let bestDirection = 0; // -1 for up, 1 for down, 0 for neutral
  let maxClearance = 0;
  
  // Test upward and downward curves
  for (const dir of [-1, 1]) {
    const testY = start.y + dir * Math.max(100, Math.abs(dx) * 0.3);
    const testPoint: Point = { x: start.x + dx * 0.3, y: testY };
    
    let minDist = Infinity;
    for (const ws of workspaces) {
      const dist = distanceToRectangle(testPoint, ws);
      minDist = Math.min(minDist, dist);
    }
    
    if (minDist > maxClearance) {
      maxClearance = minDist;
      bestDirection = dir;
    }
  }
  
  // Generate intermediate control points
  const verticalOffset = bestDirection * Math.max(100, Math.abs(dx) * 0.4);
  
  for (let i = 1; i < order; i++) {
    const t = i / order;
    const baseX = start.x + dx * t;
    const baseY = start.y + dy * t;
    
    // Apply vertical offset with easing (stronger in middle)
    const ease = Math.sin(t * Math.PI); // Ease in/out
    const offsetY = verticalOffset * ease;
    
    points.push({
      x: baseX,
      y: baseY + offsetY,
    });
  }
  
  points.push(destination);
  return points;
}

/**
 * Perturb control points to generate neighbors for A* search
 */
function generateNeighbors(
  controlPoints: Point[],
  workspaces: WorkspaceBounds[],
  stepSize: number = 20
): Point[][] {
  const neighbors: Point[][] = [];
  
  // Only perturb intermediate points (not start/end)
  for (let i = 1; i < controlPoints.length - 1; i++) {
    const directions = [
      { x: 0, y: -stepSize }, // up
      { x: 0, y: stepSize },  // down
      { x: -stepSize, y: 0 }, // left
      { x: stepSize, y: 0 },  // right
      { x: -stepSize, y: -stepSize }, // up-left
      { x: stepSize, y: -stepSize },  // up-right
      { x: -stepSize, y: stepSize },  // down-left
      { x: stepSize, y: stepSize },   // down-right
    ];
    
    for (const dir of directions) {
      const newPoints = [...controlPoints];
      newPoints[i] = {
        x: controlPoints[i].x + dir.x,
        y: controlPoints[i].y + dir.y,
      };
      
      // Only add if it doesn't immediately collide
      if (!curveCollides(newPoints, workspaces, 20)) {
        neighbors.push(newPoints);
      }
    }
  }
  
  return neighbors;
}

/**
 * Gradient descent optimization for control points
 */
function optimizeControlPoints(
  initialPoints: Point[],
  workspaces: WorkspaceBounds[],
  destination: Point,
  iterations: number = OPTIMIZATION_ITERATIONS
): Point[] {
  let points = initialPoints.map(p => ({ ...p }));
  const learningRate = 0.1;
  let previousCost = calculateRouteCost(points, workspaces, destination).cost;
  
  for (let iter = 0; iter < iterations; iter++) {
    const gradients: Point[] = new Array(points.length).fill({ x: 0, y: 0 });
    
    // Calculate gradients for intermediate points only
    for (let i = 1; i < points.length - 1; i++) {
      const epsilon = 1.0;
      
      // X gradient
      const costX1 = calculateRouteCost(
        points.map((p, idx) => idx === i ? { ...p, x: p.x - epsilon } : p),
        workspaces,
        destination
      ).cost;
      const costX2 = calculateRouteCost(
        points.map((p, idx) => idx === i ? { ...p, x: p.x + epsilon } : p),
        workspaces,
        destination
      ).cost;
      
      // Y gradient
      const costY1 = calculateRouteCost(
        points.map((p, idx) => idx === i ? { ...p, y: p.y - epsilon } : p),
        workspaces,
        destination
      ).cost;
      const costY2 = calculateRouteCost(
        points.map((p, idx) => idx === i ? { ...p, y: p.y + epsilon } : p),
        workspaces,
        destination
      ).cost;
      
      gradients[i] = {
        x: (costX2 - costX1) / (2 * epsilon),
        y: (costY2 - costY1) / (2 * epsilon),
      };
    }
    
    // Update points with gradient descent
    for (let i = 1; i < points.length - 1; i++) {
      points[i].x -= gradients[i].x * learningRate;
      points[i].y -= gradients[i].y * learningRate;
    }
    
    // Adaptive learning rate
    const currentCost = calculateRouteCost(points, workspaces, destination).cost;
    if (iter > 0 && currentCost > previousCost) {
      // Cost increased, reduce learning rate
      break;
    }
    previousCost = currentCost;
  }
  
  return points;
}

/**
 * A*-inspired search for optimal Bézier route
 */
function aStarBezierSearch(
  start: Point,
  destination: Point,
  workspaces: WorkspaceBounds[],
  maxOrder: number = MAX_BEZIER_ORDER
): BezierRoute | null {
  // Priority queue simulation using array + sort
  interface SearchNode {
    controlPoints: Point[];
    g: number; // Actual cost
    h: number; // Heuristic cost
    f: number; // Total cost
  }
  
  const openSet: SearchNode[] = [];
  const closedSet = new Set<string>();
  
  // Initialize with different curve orders
  for (let order = 3; order <= maxOrder; order++) {
    const initialPoints = generateInitialControlPoints(
      start,
      destination,
      workspaces,
      order
    );
    
    if (!curveCollides(initialPoints, workspaces)) {
      const { cost } = calculateRouteCost(
        initialPoints,
        workspaces,
        destination
      );
      
      openSet.push({
        controlPoints: initialPoints,
        g: cost,
        h: 0,
        f: cost,
      });
    }
  }
  
  if (openSet.length === 0) {
    // Fallback: try with lower order
    const fallbackPoints = generateInitialControlPoints(
      start,
      destination,
      workspaces,
      3
    );
    return {
      controlPoints: fallbackPoints,
      order: 3,
      cost: calculateRouteCost(fallbackPoints, workspaces, destination).cost,
      clearance: calculateClearance(fallbackPoints, workspaces),
    };
  }
  
  // Sort by f-cost (A* priority)
  openSet.sort((a, b) => a.f - b.f);
  
  let bestSolution: SearchNode | null = null;
  let bestClearance = 0;
  const maxIterations = 50;
  let iterations = 0;
  
  while (openSet.length > 0 && iterations < maxIterations) {
    iterations++;
    const current = openSet.shift()!;
    
    // Create key for closed set
    const key = current.controlPoints
      .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
      .join('|');
    
    if (closedSet.has(key)) continue;
    closedSet.add(key);
    
    // Check if this is a valid solution
    const clearance = calculateClearance(current.controlPoints, workspaces);
    if (clearance >= MIN_CLEARANCE) {
      // Valid solution found
      return {
        controlPoints: current.controlPoints,
        order: current.controlPoints.length - 1,
        cost: current.f,
        clearance,
      };
    }
    
    // Track best solution so far
    if (clearance > bestClearance) {
      bestClearance = clearance;
      bestSolution = current;
    }
    
    // Generate neighbors
    const neighbors = generateNeighbors(
      current.controlPoints,
      workspaces,
      15
    );
    
    for (const neighborPoints of neighbors) {
      const neighborKey = neighborPoints
        .map(p => `${Math.round(p.x)},${Math.round(p.y)}`)
        .join('|');
      
      if (closedSet.has(neighborKey)) continue;
      
      const { cost, clearance: neighborClearance } = calculateRouteCost(
        neighborPoints,
        workspaces,
        destination
      );
      
      // Heuristic: prefer higher clearance
      const h = neighborClearance < MIN_CLEARANCE 
        ? (MIN_CLEARANCE - neighborClearance) * 50 
        : 0;
      
      openSet.push({
        controlPoints: neighborPoints,
        g: cost,
        h,
        f: cost + h,
      });
    }
    
    // Re-sort after adding neighbors
    openSet.sort((a, b) => a.f - b.f);
  }
  
  // Return best solution found, or optimize it further
  if (bestSolution) {
    const optimized = optimizeControlPoints(
      bestSolution.controlPoints,
      workspaces,
      destination,
      10
    );
    
    return {
      controlPoints: optimized,
      order: optimized.length - 1,
      cost: calculateRouteCost(optimized, workspaces, destination).cost,
      clearance: calculateClearance(optimized, workspaces),
    };
  }
  
  return null;
}

/**
 * Main routing function: Find optimal Bézier curve avoiding workspaces
 */
export function routeBezierCurve(
  start: Point,
  destination: Point,
  allWorkspaces: Record<string, Workspace>,
  excludeWorkspaceIds: string[] = []
): BezierRoute | null {
  // Convert workspaces to bounds, excluding source/destination
  const workspaceBounds: WorkspaceBounds[] = [];
  
  for (const ws of Object.values(allWorkspaces)) {
    if (!excludeWorkspaceIds.includes(ws.id)) {
      workspaceBounds.push(workspaceToBounds(ws));
    }
  }
  
  // Run A* search
  return aStarBezierSearch(start, destination, workspaceBounds);
}

/**
 * Convert higher-order Bézier to cubic segments for rendering
 * PixiJS only supports cubic Bézier, so we approximate
 */
export function bezierToCubicSegments(
  controlPoints: Point[]
): Array<{ cp1: Point; cp2: Point; end: Point }> {
  if (controlPoints.length <= 4) {
    // Already cubic or lower, return as single segment
    if (controlPoints.length === 4) {
      return [{
        cp1: controlPoints[1],
        cp2: controlPoints[2],
        end: controlPoints[3],
      }];
    }
    // Quadratic or linear - approximate as cubic
    if (controlPoints.length === 3) {
      const p0 = controlPoints[0];
      const p1 = controlPoints[1];
      const p2 = controlPoints[2];
      // Convert quadratic to cubic
      return [{
        cp1: {
          x: p0.x + (2/3) * (p1.x - p0.x),
          y: p0.y + (2/3) * (p1.y - p0.y),
        },
        cp2: {
          x: p2.x + (2/3) * (p1.x - p2.x),
          y: p2.y + (2/3) * (p1.y - p2.y),
        },
        end: p2,
      }];
    }
    // Linear
    const mid = {
      x: (controlPoints[0].x + controlPoints[1].x) / 2,
      y: (controlPoints[0].y + controlPoints[1].y) / 2,
    };
    return [{
      cp1: mid,
      cp2: mid,
      end: controlPoints[1],
    }];
  }
  
  // Higher order: split into multiple cubic segments
  // Use de Casteljau subdivision
  const segments: Array<{ cp1: Point; cp2: Point; end: Point }> = [];
  const numSegments = Math.ceil((controlPoints.length - 1) / 3);
  
  for (let seg = 0; seg < numSegments; seg++) {
    const t0 = seg / numSegments;
    const t1 = (seg + 1) / numSegments;
    
    // Evaluate curve at segment boundaries
    const startPt = evaluateBezier(controlPoints, t0);
    const endPt = evaluateBezier(controlPoints, t1);
    
    // Approximate control points for this segment
    // Use tangent directions
    const dt = 0.01;
    const tangentStart = {
      x: (evaluateBezier(controlPoints, t0 + dt).x - startPt.x) / dt,
      y: (evaluateBezier(controlPoints, t0 + dt).y - startPt.y) / dt,
    };
    const tangentEnd = {
      x: (endPt.x - evaluateBezier(controlPoints, t1 - dt).x) / dt,
      y: (endPt.y - evaluateBezier(controlPoints, t1 - dt).y) / dt,
    };
    
    const segmentLength = Math.sqrt(
      (endPt.x - startPt.x) ** 2 + (endPt.y - startPt.y) ** 2
    );
    const controlLength = segmentLength / 3;
    
    segments.push({
      cp1: {
        x: startPt.x + tangentStart.x * controlLength,
        y: startPt.y + tangentStart.y * controlLength,
      },
      cp2: {
        x: endPt.x - tangentEnd.x * controlLength,
        y: endPt.y - tangentEnd.y * controlLength,
      },
      end: endPt,
    });
  }
  
  return segments;
}
