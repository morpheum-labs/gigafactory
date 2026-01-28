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
const MIN_CLEARANCE = 30; // Minimum distance from workspaces (increased for better visual clearance)
const COLLISION_SAMPLES = 80; // Samples for collision detection (increased for better edge case detection)
const OPTIMIZATION_ITERATIONS = 30; // Max iterations for gradient descent (increased for better optimization)
const BEZIER_ORDER = 3; // Cubic Bézier (4 control points: start, cp1, cp2, end)

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
  // Calculate horizontal distance: 0 if inside, otherwise distance to nearest edge
  const dx = point.x < bounds.x 
    ? bounds.x - point.x 
    : point.x > bounds.right 
      ? point.x - bounds.right 
      : 0;
  
  // Calculate vertical distance: 0 if inside, otherwise distance to nearest edge
  const dy = point.y < bounds.y 
    ? bounds.y - point.y 
    : point.y > bounds.bottom 
      ? point.y - bounds.bottom 
      : 0;
  
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
 * A curve "collides" if any point is inside a workspace OR within MIN_CLEARANCE distance
 */
function curveCollides(
  controlPoints: Point[],
  workspaces: WorkspaceBounds[],
  samples: number = COLLISION_SAMPLES
): boolean {
  if (controlPoints.length < 2) return false;

  // Fast bounding box check first (expand bbox by MIN_CLEARANCE for safety)
  const bbox = bezierBoundingBox(controlPoints);
  const expandedBbox: WorkspaceBounds = {
    x: bbox.x - MIN_CLEARANCE,
    y: bbox.y - MIN_CLEARANCE,
    width: bbox.width + 2 * MIN_CLEARANCE,
    height: bbox.height + 2 * MIN_CLEARANCE,
    right: bbox.right + MIN_CLEARANCE,
    bottom: bbox.bottom + MIN_CLEARANCE,
  };
  if (!bboxIntersectsAny(expandedBbox, workspaces)) {
    return false;
  }

  // Detailed sampling check - check both inside bounds AND minimum clearance
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = evaluateBezier(controlPoints, t);
    
    for (const ws of workspaces) {
      // Check if point is inside workspace
      if (pointInBounds(point, ws)) {
        return true;
      }
      
      // Check if point is within MIN_CLEARANCE distance from workspace
      const distance = distanceToRectangle(point, ws);
      if (distance < MIN_CLEARANCE) {
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
 * Generate initial control points for backward routing (cubic Bézier)
 * Uses safe directions to avoid workspaces
 * Returns 4 control points: [start, cp1, cp2, end]
 */
function generateInitialControlPoints(
  start: Point,
  destination: Point,
  workspaces: WorkspaceBounds[]
): Point[] {
  // Calculate safe initial direction from destination
  const dx = destination.x - start.x;
  const dy = destination.y - start.y;
  
  // For backward routing, we want to curve away from workspaces
  // Find the best vertical direction to avoid workspaces
  let bestDirection = 0; // -1 for up, 1 for down, 0 for neutral
  let maxClearance = 0;
  
  // Test upward and downward curves with multiple test points
  for (const dir of [-1, 1]) {
    // Test at multiple horizontal positions to find best overall clearance
    let minDistForDirection = Infinity;
    for (let t = 0.2; t <= 0.5; t += 0.1) {
      const testY = start.y + dir * Math.max(100, Math.abs(dx) * 0.3);
      const testPoint: Point = { x: start.x + dx * t, y: testY };
      
      let minDist = Infinity;
      for (const ws of workspaces) {
        const dist = distanceToRectangle(testPoint, ws);
        minDist = Math.min(minDist, dist);
      }
      minDistForDirection = Math.min(minDistForDirection, minDist);
    }
    
    if (minDistForDirection > maxClearance) {
      maxClearance = minDistForDirection;
      bestDirection = dir;
    }
  }
  
  // Generate cubic Bézier control points with minimum clearance consideration
  const baseOffset = Math.max(
    100, 
    Math.abs(dx) * 0.4, 
    MIN_CLEARANCE * 1.5
  );
  const verticalOffset = bestDirection * baseOffset;
  
  // Cubic Bézier: start, cp1, cp2, end
  // Position control points at 1/3 and 2/3 of the way
  const cp1X = start.x + dx * 0.33;
  const cp1Y = start.y + dy * 0.33 + verticalOffset * 0.7; // Ease in
  const cp2X = start.x + dx * 0.67;
  const cp2Y = start.y + dy * 0.67 + verticalOffset * 0.7; // Ease out
  
  return [
    start,
    { x: cp1X, y: cp1Y },
    { x: cp2X, y: cp2Y },
    destination
  ];
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
      
      // Only add if it doesn't collide (use full sample count for accuracy)
      if (!curveCollides(newPoints, workspaces, COLLISION_SAMPLES)) {
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
 * A*-inspired search for optimal cubic Bézier route
 */
function aStarBezierSearch(
  start: Point,
  destination: Point,
  workspaces: WorkspaceBounds[]
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
  
  // Initialize with cubic Bézier (4 control points)
  const initialPoints = generateInitialControlPoints(
    start,
    destination,
    workspaces
  );
  
  const collides = curveCollides(initialPoints, workspaces);
  const { cost } = calculateRouteCost(
    initialPoints,
    workspaces,
    destination
  );
  
  if (!collides) {
    // Non-colliding initial path - add with normal cost
    openSet.push({
      controlPoints: initialPoints,
      g: cost,
      h: 0,
      f: cost,
    });
  } else {
    // Even if initial points collide, add with high penalty
    // This allows the algorithm to optimize them into valid paths
    const collisionPenalty = 10000;
    openSet.push({
      controlPoints: initialPoints,
      g: cost + collisionPenalty,
      h: collisionPenalty,
      f: cost + collisionPenalty * 2,
    });
  }
  
  // If we still have no valid starting points, the initial generation failed
  // This shouldn't happen often, but if it does, return null
  if (openSet.length === 0) {
    return null;
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
        order: BEZIER_ORDER,
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
      
      // Double-check collision before adding (generateNeighbors already checks, but be extra safe)
      if (curveCollides(neighborPoints, workspaces)) {
        continue; // Skip colliding neighbors
      }
      
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
  
  // Return best solution found, but ONLY if it doesn't collide and has reasonable clearance
  if (bestSolution) {
    // Verify best solution doesn't collide
    if (curveCollides(bestSolution.controlPoints, workspaces)) {
      // Best solution still collides - try optimization to fix it
      const optimized = optimizeControlPoints(
        bestSolution.controlPoints,
        workspaces,
        destination,
        20
      );
      
      // Check if optimization fixed the collision
      if (!curveCollides(optimized, workspaces)) {
        const clearance = calculateClearance(optimized, workspaces);
        // Only return if clearance is reasonable (at least 50% of minimum)
        if (clearance >= MIN_CLEARANCE * 0.5) {
          return {
            controlPoints: optimized,
            order: BEZIER_ORDER,
            cost: calculateRouteCost(optimized, workspaces, destination).cost,
            clearance,
          };
        }
      }
      // If optimization didn't help, return null (no valid path found)
      return null;
    }
    
    // Best solution doesn't collide, but check clearance
    const clearance = calculateClearance(bestSolution.controlPoints, workspaces);
    if (clearance < MIN_CLEARANCE * 0.5) {
      // Clearance too low, try optimization
      const optimized = optimizeControlPoints(
        bestSolution.controlPoints,
        workspaces,
        destination,
        20
      );
      
      if (!curveCollides(optimized, workspaces)) {
        const optimizedClearance = calculateClearance(optimized, workspaces);
        if (optimizedClearance >= MIN_CLEARANCE * 0.5) {
          return {
            controlPoints: optimized,
            order: BEZIER_ORDER,
            cost: calculateRouteCost(optimized, workspaces, destination).cost,
            clearance: optimizedClearance,
          };
        }
      }
      // Still not good enough
      return null;
    }
    
    // Best solution is good, optimize it further
    const optimized = optimizeControlPoints(
      bestSolution.controlPoints,
      workspaces,
      destination,
      10
    );
    
    // Verify optimization didn't introduce collisions
    if (!curveCollides(optimized, workspaces)) {
      const optimizedClearance = calculateClearance(optimized, workspaces);
      return {
        controlPoints: optimized,
        order: BEZIER_ORDER,
        cost: calculateRouteCost(optimized, workspaces, destination).cost,
        clearance: optimizedClearance,
      };
    }
    
    // Optimization introduced collision, return original
    return {
      controlPoints: bestSolution.controlPoints,
      order: BEZIER_ORDER,
      cost: bestSolution.f,
      clearance,
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
 * Convert cubic Bézier control points to rendering format
 * Since we only use cubic Bézier, this is a simple conversion
 */
export function bezierToCubicSegments(
  controlPoints: Point[]
): Array<{ cp1: Point; cp2: Point; end: Point }> {
  // We always use cubic Bézier (4 control points)
  if (controlPoints.length === 4) {
    return [{
      cp1: controlPoints[1],
      cp2: controlPoints[2],
      end: controlPoints[3],
    }];
  }
  
  // Fallback for edge cases (shouldn't happen, but handle gracefully)
  if (controlPoints.length === 3) {
    // Quadratic - approximate as cubic
    const p0 = controlPoints[0];
    const p1 = controlPoints[1];
    const p2 = controlPoints[2];
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
  
  if (controlPoints.length === 2) {
    // Linear - approximate as cubic
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
  
  // Invalid - return empty array
  return [];
}
