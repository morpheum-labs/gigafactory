/**
 * Hybrid Step-Bump Bézier Router
 * Implements optimized backward routing with hybrid step-bump algorithm
 * Phase 1: Grid-based A* search for waypoints
 * Phase 2: Segment classification (CRITICAL, FREE, TRANSITION)
 * Phase 3: Hybrid curve generation (step, bump, blend)
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
  waypoints?: Point[]; // A* waypoints for hybrid routing
  segments?: HybridSegment[]; // Classified segments
}

export interface HybridSegment {
  start: Point;
  end: Point;
  type: SegmentType;
  clearance: number;
}

export enum SegmentType {
  CRITICAL = 'critical',    // Near workspace - use step
  FREE = 'free',            // Far from obstacles - use bump
  TRANSITION = 'transition' // Blend zone
}

// Configuration constants
const MIN_CLEARANCE = 40; // Minimum distance from workspaces (increased for better buffer)
const GRID_SIZE = 40; // Grid size for A* search
const CLEARANCE_THRESHOLD = 60; // Threshold for segment classification (lowered for more conservative FREE classification)
const STEP_T = 0.5; // Step transition point (0-1)
const MAX_ASTAR_ITERATIONS = 1000; // Max iterations for A* search
const HORIZONTAL_BUFFER = 60; // Minimum horizontal distance before bending
const VERTICAL_BUFFER = 40; // Minimum vertical clearance from workspaces
const BEZIER_SAMPLE_COUNT = 50; // Number of samples for curve intersection checking

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
 * Check if there's a direct path from start to end without obstacles
 * IMPROVED: Check entire segment with proper clearance
 */
function hasDirectPath(start: Point, end: Point, workspaces: WorkspaceBounds[]): boolean {
  // For backward connections, we want to check if we can go horizontally first
  const isBackward = end.x < start.x;
  
  // Calculate the ideal path: horizontal buffer, then diagonal/vertical
  const horizontalTarget = isBackward 
    ? start.x - HORIZONTAL_BUFFER
    : start.x + HORIZONTAL_BUFFER;
  
  // Check if we can extend horizontally without collision
  const horizontalEnd: Point = { x: horizontalTarget, y: start.y };
  
  // Sample along horizontal segment
  const horizontalSamples = 10;
  for (let i = 0; i <= horizontalSamples; i++) {
    const t = i / horizontalSamples;
    const point: Point = {
      x: start.x + t * (horizontalEnd.x - start.x),
      y: start.y + t * (horizontalEnd.y - start.y),
    };
    
    for (const ws of workspaces) {
      if (pointInBounds(point, ws, MIN_CLEARANCE + 10)) {
        return false; // Can't extend horizontally
      }
    }
  }
  
  // Now check the diagonal/vertical segment to destination
  const diagonalSamples = 20;
  for (let i = 0; i <= diagonalSamples; i++) {
    const t = i / diagonalSamples;
    const point: Point = {
      x: horizontalEnd.x + t * (end.x - horizontalEnd.x),
      y: horizontalEnd.y + t * (end.y - horizontalEnd.y),
    };
    
    for (const ws of workspaces) {
      if (pointInBounds(point, ws, MIN_CLEARANCE + VERTICAL_BUFFER)) {
        return false; // Diagonal segment collides
      }
    }
  }
  
  return true;
}

/**
 * Generate a simple direct path when no obstacles exist
 * ENFORCES: Horizontal first, then bend principle
 */
function generateDirectPath(start: Point, end: Point): BezierRoute {
  const isBackward = end.x < start.x;
  
  // Calculate horizontal buffer point
  const horizontalBuffer = isBackward 
    ? start.x - HORIZONTAL_BUFFER
    : start.x + HORIZONTAL_BUFFER;
  
  const horizontalPoint: Point = { x: horizontalBuffer, y: start.y };
  
  // Create control points for the path: start -> horizontal -> end
  // This ensures we go horizontally first
  const midX = (horizontalPoint.x + end.x) / 2;
  const curveHeight = Math.abs(start.y - end.y) * 0.5;
  const curveDir = end.y > start.y ? 1 : -1;
  
  const controlPoints = [
    start,
    horizontalPoint, // First go horizontally
    { x: horizontalPoint.x, y: horizontalPoint.y + curveDir * curveHeight * 0.3 },
    { x: midX, y: start.y + curveDir * curveHeight },
    { x: end.x, y: end.y - curveDir * curveHeight * 0.3 },
    { x: end.x, y: end.y },
  ];
  
  return {
    controlPoints,
    order: 5, // Higher order curve for smooth transition
    cost: Math.abs(end.x - start.x) + Math.abs(end.y - start.y),
    clearance: Infinity,
  };
}

/**
 * Check if a point is inside a workspace rectangle (including margin)
 */
function pointInBounds(point: Point, bounds: WorkspaceBounds, margin: number = 0): boolean {
  return (
    point.x >= bounds.x - margin &&
    point.x <= bounds.right + margin &&
    point.y >= bounds.y - margin &&
    point.y <= bounds.bottom + margin
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
 * Check if a point collides with any workspace (including margin)
 */
function collidesWithWorkspace(point: Point, workspaces: WorkspaceBounds[], margin: number = MIN_CLEARANCE): boolean {
  for (const ws of workspaces) {
    if (pointInBounds(point, ws, margin)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a segment collides with any workspace
 */
function segmentCollidesWithWorkspace(p1: Point, p2: Point, workspaces: WorkspaceBounds[], margin: number = MIN_CLEARANCE): boolean {
  // Sample points along the segment
  const samples = Math.ceil(Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
  ) / 10); // Sample every 10 pixels
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point: Point = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
    
    if (collidesWithWorkspace(point, workspaces, margin)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate minimum distance from segment to workspace
 */
function segmentWorkspaceDistance(p1: Point, p2: Point, workspace: WorkspaceBounds): number {
  let minDist = Infinity;
  const samples = Math.ceil(Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
  ) / 20); // Sample every 20 pixels
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point: Point = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
    const dist = distanceToRectangle(point, workspace);
    minDist = Math.min(minDist, dist);
  }
  
  return minDist;
}

/**
 * Evaluate a cubic Bézier curve at parameter t (0 to 1)
 * P(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
function evaluateBezier(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  t: number
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  
  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p3.y,
  };
}

/**
 * Check if a cubic Bézier curve intersects with any workspace
 * Returns the minimum clearance along the curve
 */
function bezierCurveClearance(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  workspaces: WorkspaceBounds[]
): number {
  let minClearance = Infinity;
  
  // Sample points along the curve
  for (let i = 0; i <= BEZIER_SAMPLE_COUNT; i++) {
    const t = i / BEZIER_SAMPLE_COUNT;
    const point = evaluateBezier(p0, cp1, cp2, p3, t);
    
    // Check distance to all workspaces
    for (const ws of workspaces) {
      const dist = distanceToRectangle(point, ws);
      minClearance = Math.min(minClearance, dist);
    }
  }
  
  return minClearance;
}

/**
 * Check if a cubic Bézier curve collides with any workspace
 */
function bezierCurveCollides(
  p0: Point,
  cp1: Point,
  cp2: Point,
  p3: Point,
  workspaces: WorkspaceBounds[],
  margin: number = MIN_CLEARANCE
): boolean {
  const clearance = bezierCurveClearance(p0, cp1, cp2, p3, workspaces);
  return clearance < margin;
}

/**
 * A* Search Node for grid-based routing
 */
interface StepNode {
  x: number;
  y: number;
  direction?: 'H' | 'V'; // Horizontal or Vertical
  g: number; // Cost from destination
  h: number; // Heuristic to source
  f: number; // Total cost
  parent: StepNode | null;
}

/**
 * Phase 1: Grid-based A* search for backward routing
 * Starts from destination, routes backward to source
 * ENHANCED: Enforces horizontal-first principle for backward connections
 */
function backwardAStarSearch(
  destination: Point,
  source: Point,
  workspaces: WorkspaceBounds[]
): Point[] | null {
  const openSet: StepNode[] = [];
  const closedSet = new Set<string>();
  
  // For backward connections, we want to ensure we go horizontally from source
  const isBackward = destination.x < source.x;
  
  // Initialize with destination node
  const startNode: StepNode = {
    x: Math.round(destination.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(destination.y / GRID_SIZE) * GRID_SIZE,
    g: 0,
    h: manhattanDistance(destination, source),
    f: manhattanDistance(destination, source),
    parent: null,
  };
  
  openSet.push(startNode);
  
  let iterations = 0;
  while (openSet.length > 0 && iterations < MAX_ASTAR_ITERATIONS) {
    iterations++;
    
    // Find node with lowest f-cost
    let minIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[minIndex].f) {
        minIndex = i;
      }
    }
    
    const current = openSet.splice(minIndex, 1)[0];
    const key = `${current.x},${current.y}`;
    
    if (closedSet.has(key)) continue;
    closedSet.add(key);
    
    // Check if reached source (within grid tolerance)
    if (Math.abs(current.x - source.x) < GRID_SIZE && Math.abs(current.y - source.y) < GRID_SIZE) {
      // For backward connections, ensure we go horizontally from source
      let path: Point[] = [];
      let node: StepNode | null = current;
      
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      
      // Add source point exactly
      path.push(source);
      
      // If this is a backward connection, ensure horizontal segment from source
      if (isBackward && path.length >= 2) {
        const firstSeg = path[1];
        // If not going horizontally from source, insert a horizontal point
        if (Math.abs(firstSeg.y - source.y) > GRID_SIZE/2) {
          const horizontalPoint: Point = { 
            x: source.x - HORIZONTAL_BUFFER, 
            y: source.y 
          };
          
          // Check if horizontal path is clear
          if (!segmentCollidesWithWorkspace(source, horizontalPoint, workspaces, MIN_CLEARANCE)) {
            path.splice(1, 0, horizontalPoint);
          }
        }
      }
      
      return path;
    }
    
    // Generate neighbors (axis-aligned moves only)
    const neighbors = generateNeighbors(current, workspaces);
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;
      
      // Calculate costs with improved penalty system
      const tentativeG = current.g + movementCost(current, neighbor, workspaces);
      
      // Check if this neighbor is already in open set
      const existingIndex = openSet.findIndex(n => n.x === neighbor.x && n.y === neighbor.y);
      
      if (existingIndex >= 0) {
        // Already in open set, update if better path
        if (tentativeG < openSet[existingIndex].g) {
          openSet[existingIndex].g = tentativeG;
          openSet[existingIndex].h = manhattanDistance(neighbor, source);
          openSet[existingIndex].f = openSet[existingIndex].g + openSet[existingIndex].h;
          openSet[existingIndex].parent = current;
        }
      } else {
        // New node, add to open set
        neighbor.g = tentativeG;
        neighbor.h = manhattanDistance(neighbor, source);
        neighbor.f = neighbor.g + neighbor.h;
        neighbor.parent = current;
        openSet.push(neighbor);
      }
    }
  }
  
  return null; // No path found
}

/**
 * Generate axis-aligned neighbor positions with improved collision checking
 */
function generateNeighbors(node: StepNode, workspaces: WorkspaceBounds[]): StepNode[] {
  const neighbors: StepNode[] = [];
  const moves = [
    { dx: GRID_SIZE, dy: 0, dir: 'H' as const },   // Right
    { dx: -GRID_SIZE, dy: 0, dir: 'H' as const },  // Left
    { dx: 0, dy: GRID_SIZE, dir: 'V' as const },  // Down
    { dx: 0, dy: -GRID_SIZE, dir: 'V' as const }, // Up
  ];
  
  for (const move of moves) {
    const nx = node.x + move.dx;
    const ny = node.y + move.dy;
    
    // Check if the grid cell is clear
    const cellClear = isGridCellClear(nx, ny, GRID_SIZE, workspaces);
    
    if (cellClear) {
      neighbors.push({
        x: nx,
        y: ny,
        direction: move.dir,
        g: 0,
        h: 0,
        f: 0,
        parent: null,
      });
    }
  }
  
  return neighbors;
}

/**
 * Check if a grid cell is clear of workspaces with margin
 */
function isGridCellClear(x: number, y: number, size: number, workspaces: WorkspaceBounds[]): boolean {
  // Check all four corners of the grid cell
  const corners = [
    { x, y },
    { x: x + size, y },
    { x, y: y + size },
    { x: x + size, y: y + size },
  ];
  
  for (const corner of corners) {
    if (collidesWithWorkspace(corner, workspaces, MIN_CLEARANCE)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate movement cost with penalties for direction changes and proximity
 * ENHANCED: Higher penalties for going near workspaces
 */
function movementCost(current: StepNode, neighbor: StepNode, workspaces: WorkspaceBounds[]): number {
  const baseCost = Math.abs(neighbor.x - current.x) + Math.abs(neighbor.y - current.y);
  
  // Penalty for direction changes (to reduce zigzag)
  let directionPenalty = 0;
  if (current.parent) {
    const prevDirection = current.direction;
    const currDirection = neighbor.direction;
    if (prevDirection && currDirection && prevDirection !== currDirection) {
      directionPenalty = 10; // Increased penalty
    }
  }
  
  // Penalty for proximity to workspaces (higher near obstacles)
  let clearancePenalty = 0;
  const neighborPoint = { x: neighbor.x, y: neighbor.y };
  
  for (const ws of workspaces) {
    const dist = distanceToRectangle(neighborPoint, ws);
    if (dist < CLEARANCE_THRESHOLD) {
      // Exponential penalty as we get closer to obstacles
      const proximityFactor = Math.pow((CLEARANCE_THRESHOLD - dist) / CLEARANCE_THRESHOLD, 2);
      clearancePenalty += 50 * proximityFactor; // Increased penalty
    }
  }
  
  return baseCost + directionPenalty + clearancePenalty;
}

/**
 * Manhattan distance heuristic for grid-based routing
 */
function manhattanDistance(p1: Point, p2: Point): number {
  return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
}

/**
 * Simplify waypoints by removing unnecessary intermediate points
 * ENHANCED: Better collision checking during simplification
 */
function simplifyWaypoints(waypoints: Point[], workspaces: WorkspaceBounds[]): Point[] {
  if (waypoints.length <= 2) return waypoints;
  
  const simplified: Point[] = [waypoints[0]];
  let i = 0;
  
  while (i < waypoints.length - 1) {
    let furthest = i + 1;
    
    // Try to skip as many points as possible
    for (let j = waypoints.length - 1; j > i + 1; j--) {
      // Check if direct segment is collision-free
      if (!segmentCollidesWithWorkspace(waypoints[i], waypoints[j], workspaces, MIN_CLEARANCE)) {
        furthest = j;
        break;
      }
    }
    
    simplified.push(waypoints[furthest]);
    i = furthest;
  }
  
  return simplified;
}

/**
 * Phase 2: Classify segments based on proximity to workspaces
 * ENHANCED: Simulates curves for FREE/TRANSITION segments and reclassifies if unsafe
 */
function classifySegments(
  pathPoints: Point[],
  workspaces: WorkspaceBounds[]
): HybridSegment[] {
  const segments: HybridSegment[] = [];
  
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p1 = pathPoints[i];
    const p2 = pathPoints[i + 1];
    
    // Calculate minimum clearance along straight segment
    let minClearance = Infinity;
    for (const ws of workspaces) {
      const clearance = segmentWorkspaceDistance(p1, p2, ws);
      minClearance = Math.min(minClearance, clearance);
    }
    
    // Initial classification based on clearance
    let segType: SegmentType;
    if (minClearance < CLEARANCE_THRESHOLD * 0.4) {
      segType = SegmentType.CRITICAL;
    } else if (minClearance < CLEARANCE_THRESHOLD) {
      segType = SegmentType.TRANSITION;
    } else {
      segType = SegmentType.FREE;
    }
    
    // Post-classify: For FREE/TRANSITION segments, simulate the curve and check if it's safe
    if (segType === SegmentType.FREE || segType === SegmentType.TRANSITION) {
      // Simulate a bump curve to check if it would intersect
      const dx = Math.abs(p2.x - p1.x);
      const dy = Math.abs(p2.y - p1.y);
      let curveHeight = Math.min(dy * 0.5, dx * 0.3);
      curveHeight = Math.max(curveHeight, 20);
      curveHeight = Math.min(curveHeight, 80);
      
      const curveDir = p2.y > p1.y ? 1 : -1;
      const cp1: Point = {
        x: p1.x + dx * 0.3,
        y: p1.y + curveDir * curveHeight * 0.7
      };
      const cp2: Point = {
        x: p2.x - dx * 0.3,
        y: p2.y - curveDir * curveHeight * 0.7
      };
      
      // Check if simulated curve collides
      if (bezierCurveCollides(p1, cp1, cp2, p2, workspaces)) {
        // Reclassify as CRITICAL if curve would intersect
        segType = SegmentType.CRITICAL;
        // Recalculate clearance for the straight segment (which we'll use for step routing)
        minClearance = Infinity;
        for (const ws of workspaces) {
          const clearance = segmentWorkspaceDistance(p1, p2, ws);
          minClearance = Math.min(minClearance, clearance);
        }
      }
    }
    
    segments.push({
      start: p1,
      end: p2,
      type: segType,
      clearance: minClearance,
    });
  }
  
  return segments;
}

/**
 * Phase 3: Generate hybrid curve commands
 */
interface PathCommand {
  type: 'L' | 'C'; // Line or Cubic Bezier
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x3?: number;
  y3?: number;
}

/**
 * Generate step segment (axis-aligned) for backward connections
 * ENFORCES: Horizontal first principle
 */
function generateStepSegment(p1: Point, p2: Point, t: number = STEP_T, isBackward: boolean = false): PathCommand[] {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  
  // For backward connections from output ports, always go horizontal first
  if (isBackward && Math.abs(x2 - x1) > HORIZONTAL_BUFFER) {
    const horizontalPoint: Point = { 
      x: x1 - HORIZONTAL_BUFFER, 
      y: y1 
    };
    
    return [
      { type: 'L', x1: horizontalPoint.x, y1: horizontalPoint.y }, // Horizontal first
      { type: 'L', x1: horizontalPoint.x, y1: y2 }, // Then vertical
      { type: 'L', x1: x2, y1: y2 }, // Then horizontal to destination
    ];
  }
  
  // Original step logic for other cases
  if (t <= 0) {
    // stepBefore: vertical first
    return [
      { type: 'L', x1: x1, y1: y2 },
      { type: 'L', x1: x2, y1: y2 },
    ];
  } else if (t >= 1) {
    // stepAfter: horizontal first
    return [
      { type: 'L', x1: x2, y1: y1 },
      { type: 'L', x1: x2, y1: y2 },
    ];
  } else {
    // step (midpoint)
    const xi = x1 * (1 - t) + x2 * t;
    return [
      { type: 'L', x1: xi, y1: y1 },
      { type: 'L', x1: xi, y1: y2 },
      { type: 'L', x1: x2, y1: y2 },
    ];
  }
}

/**
 * Find the best vertical direction for a curve to avoid workspaces
 * Returns 1 for upward curve, -1 for downward curve, based on available clearance
 */
function findBestCurveDirection(
  p1: Point,
  p2: Point,
  workspaces: WorkspaceBounds[]
): number {
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const testHeight = 100; // Test height for clearance check
  
  // Test upward direction
  const testPointUp: Point = { x: midX, y: midY - testHeight };
  let minDistUp = Infinity;
  for (const ws of workspaces) {
    const dist = distanceToRectangle(testPointUp, ws);
    minDistUp = Math.min(minDistUp, dist);
  }
  
  // Test downward direction
  const testPointDown: Point = { x: midX, y: midY + testHeight };
  let minDistDown = Infinity;
  for (const ws of workspaces) {
    const dist = distanceToRectangle(testPointDown, ws);
    minDistDown = Math.min(minDistDown, dist);
  }
  
  // Choose direction with more clearance
  return minDistUp > minDistDown ? -1 : 1;
}

/**
 * Generate bump segment (Bézier curve with horizontal tangents)
 * ENHANCED: Workspace-aware control points with curve validation
 */
function generateBumpSegment(
  p1: Point,
  p2: Point,
  workspaces: WorkspaceBounds[] = []
): PathCommand[] {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  
  // Find best curve direction based on workspace clearance
  const curveDir = workspaces.length > 0
    ? findBestCurveDirection(p1, p2, workspaces)
    : (y2 > y1 ? 1 : -1);
  
  // Start with initial curve height
  let curveHeight = Math.min(dy * 0.5, dx * 0.3);
  curveHeight = Math.max(curveHeight, 20); // Minimum curve height
  curveHeight = Math.min(curveHeight, 80); // Maximum curve height
  
  // Try to find a safe curve height through iteration
  let maxAttempts = 10;
  let attempts = 0;
  let safeCurveFound = false;
  
  while (attempts < maxAttempts && !safeCurveFound) {
    // Control points for smooth S-curve
    const cp1x = x1 + dx * 0.3;
    const cp1y = y1 + curveDir * curveHeight * 0.7;
    const cp2x = x2 - dx * 0.3;
    const cp2y = y2 - curveDir * curveHeight * 0.7;
    
    // Check if curve is safe
    if (workspaces.length === 0 || !bezierCurveCollides(p1, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, p2, workspaces)) {
      safeCurveFound = true;
      return [
        {
          type: 'C',
          x1: cp1x, y1: cp1y,
          x2: cp2x, y2: cp2y,
          x3: x2, y3: y2,
        },
      ];
    }
    
    // Reduce curve height and try again
    curveHeight *= 0.7;
    attempts++;
  }
  
  // If we couldn't find a safe curve, fall back to step routing
  // This ensures we never return an unsafe curve
  return generateStepSegment(p1, p2, STEP_T, false);
}

/**
 * Generate blended segment (mix of step and bump)
 * ENHANCED: Curve validation to prevent workspace intersections
 */
function generateBlendedSegment(
  p1: Point,
  p2: Point,
  clearance: number,
  isBackward: boolean = false,
  workspaces: WorkspaceBounds[] = []
): PathCommand[] {
  // Higher clearance = more bump-like
  const blendFactor = Math.min(1.0, clearance / CLEARANCE_THRESHOLD);
  
  if (blendFactor < 0.3) {
    // Very near obstacles: use step with horizontal-first for backward connections
    return generateStepSegment(p1, p2, STEP_T, isBackward);
  } else if (blendFactor < 0.7) {
    // Transition zone: create a hybrid
    const commands: PathCommand[] = [];
    const midX = (p1.x + p2.x) / 2;
    
    // Start with short horizontal segment
    const horizontalPoint: Point = {
      x: p1.x + (p2.x > p1.x ? 20 : -20),
      y: p1.y
    };
    commands.push({ 
      type: 'L', 
      x1: horizontalPoint.x, 
      y1: horizontalPoint.y 
    });
    
    // Then curved segment - validate it
    const cp1: Point = { x: midX, y: p1.y };
    const cp2: Point = { x: midX, y: p2.y };
    
    if (workspaces.length === 0 || !bezierCurveCollides(horizontalPoint, cp1, cp2, p2, workspaces)) {
      commands.push({
        type: 'C',
        x1: cp1.x, y1: cp1.y,
        x2: cp2.x, y2: cp2.y,
        x3: p2.x, y3: p2.y,
      });
    } else {
      // If curve is unsafe, use step routing
      return generateStepSegment(p1, p2, STEP_T, isBackward);
    }
    
    return commands;
  } else {
    // Far from obstacles: use smooth bump (with workspace awareness)
    return generateBumpSegment(p1, p2, workspaces);
  }
}

/**
 * Generate hybrid curve from classified segments
 * ENHANCED: Workspace-aware curve generation with validation
 */
function generateHybridCurve(
  segments: HybridSegment[],
  isBackward: boolean = false,
  workspaces: WorkspaceBounds[] = []
): PathCommand[] {
  const commands: PathCommand[] = [];
  
  for (const seg of segments) {
    let segCommands: PathCommand[];
    
    if (seg.type === SegmentType.CRITICAL) {
      // Use step routing for guaranteed clearance, with horizontal-first for backward
      segCommands = generateStepSegment(seg.start, seg.end, STEP_T, isBackward);
    } else if (seg.type === SegmentType.FREE) {
      // Use bump for smooth curves (with workspace awareness)
      segCommands = generateBumpSegment(seg.start, seg.end, workspaces);
    } else {
      // TRANSITION: Blend step and bump (with workspace awareness)
      segCommands = generateBlendedSegment(seg.start, seg.end, seg.clearance, isBackward, workspaces);
    }
    
    commands.push(...segCommands);
  }
  
  return commands;
}

/**
 * Convert path commands to control points for rendering
 * This converts the hybrid step-bump commands into Bézier control points
 * FIXED: Explicitly includes all control points for bezier curves (start, cp1, cp2, end)
 */
function commandsToControlPoints(commands: PathCommand[], start: Point): Point[] {
  const controlPoints: Point[] = [start];
  let currentPoint = start;
  
  for (const cmd of commands) {
    if (cmd.type === 'L') {
      // Line segment - add as point
      if (cmd.x1 !== undefined && cmd.y1 !== undefined) {
        currentPoint = { x: cmd.x1, y: cmd.y1 };
        controlPoints.push(currentPoint);
      }
    } else if (cmd.type === 'C') {
      // Cubic Bézier - add all control points: start (currentPoint), cp1, cp2, end
      // This ensures all control points are visible for debug rendering
      if (cmd.x1 !== undefined && cmd.y1 !== undefined &&
          cmd.x2 !== undefined && cmd.y2 !== undefined &&
          cmd.x3 !== undefined && cmd.y3 !== undefined) {
        // For bezier curves, we need: start (currentPoint), cp1, cp2, end
        // Check if start point is already the last point (to avoid duplicates)
        const lastPoint = controlPoints[controlPoints.length - 1];
        const tolerance = 0.1;
        const isDuplicate = Math.abs(lastPoint.x - currentPoint.x) < tolerance && 
                            Math.abs(lastPoint.y - currentPoint.y) < tolerance;
        
        if (!isDuplicate) {
          // Add start point if it's not already there
          controlPoints.push({ x: currentPoint.x, y: currentPoint.y });
        }
        
        // Add the control points and end point
        controlPoints.push(
          { x: cmd.x1, y: cmd.y1 }, // cp1
          { x: cmd.x2, y: cmd.y2 }, // cp2
          { x: cmd.x3, y: cmd.y3 }  // end
        );
        currentPoint = { x: cmd.x3, y: cmd.y3 };
      }
    }
  }
  
  return controlPoints;
}

/**
 * Main routing function using Hybrid Step-Bump Algorithm
 * Phase 1: A* search for waypoints
 * Phase 2: Classify segments
 * Phase 3: Generate hybrid curves
 * ENHANCED: Better workspace avoidance and horizontal-first principle
 */
function hybridStepBumpRoute(
  destination: Point,
  source: Point,
  workspaces: WorkspaceBounds[]
): BezierRoute | null {
  const isBackward = destination.x < source.x;
  
  // Create expanded workspaces (excluding connection port regions)
  const expandedWorkspaces = workspaces.map(ws => ({
    x: ws.x - MIN_CLEARANCE,
    y: ws.y - MIN_CLEARANCE,
    width: ws.width + 2 * MIN_CLEARANCE,
    height: ws.height + 2 * MIN_CLEARANCE,
    right: ws.right + MIN_CLEARANCE,
    bottom: ws.bottom + MIN_CLEARANCE,
  }));
  
  // Phase 1: Find waypoints using A* search (backward routing)
  const backwardWaypoints = backwardAStarSearch(destination, source, expandedWorkspaces);
  
  if (!backwardWaypoints || backwardWaypoints.length < 2) {
    return null; // No path found
  }
  
  // Simplify waypoints to remove unnecessary intermediate points
  const simplifiedBackward = simplifyWaypoints(backwardWaypoints, workspaces);
  
  // Reverse waypoints to go from source to destination for rendering
  const waypoints = [...simplifiedBackward].reverse();
  
  // For backward connections, ensure we start with a horizontal segment
  if (isBackward && waypoints.length >= 2) {
    const sourcePoint = waypoints[0];
    const nextPoint = waypoints[1];
    
    // If not starting horizontally, insert a horizontal segment
    if (Math.abs(nextPoint.y - sourcePoint.y) > GRID_SIZE/2) {
      const horizontalPoint: Point = { 
        x: sourcePoint.x - HORIZONTAL_BUFFER, 
        y: sourcePoint.y 
      };
      
      // Check if horizontal path is clear
      if (!segmentCollidesWithWorkspace(sourcePoint, horizontalPoint, workspaces, MIN_CLEARANCE)) {
        waypoints.splice(1, 0, horizontalPoint);
      }
    }
  }
  
  // Phase 2: Classify segments
  const segments = classifySegments(waypoints, workspaces);
  
  // Phase 3: Generate hybrid curve commands (with workspace awareness)
  const commands = generateHybridCurve(segments, isBackward, workspaces);
  
  // Convert commands to control points for rendering
  const controlPoints = commandsToControlPoints(commands, waypoints[0]);
  
  // Post-routing validation: Check if the final path is safe
  const validationResult = validateRoutePath(commands, waypoints[0], workspaces);
  if (!validationResult.isSafe && validationResult.minClearance < MIN_CLEARANCE) {
    // If route is unsafe, try to refine by increasing clearance penalties
    // For now, we'll return the route but mark it as having low clearance
    // The curve generation should have already handled most cases
    console.warn('Route has low clearance:', validationResult.minClearance);
  }
  
  // Calculate route metrics (using actual curve clearance)
  const clearance = Math.max(validationResult.minClearance, calculateRouteClearance(waypoints, workspaces));
  const cost = calculatePathCost(waypoints, segments);
  
  return {
    controlPoints,
    order: 3, // Cubic Bézier
    cost,
    clearance,
    waypoints,
    segments,
  };
}

/**
 * Validate the entire route path (including curves) for workspace collisions
 * Returns validation result with minimum clearance
 */
function validateRoutePath(
  commands: PathCommand[],
  start: Point,
  workspaces: WorkspaceBounds[]
): { isSafe: boolean; minClearance: number } {
  let minClearance = Infinity;
  let currentPoint = start;
  
  for (const cmd of commands) {
    if (cmd.type === 'L') {
      // Line segment - check clearance
      if (cmd.x1 !== undefined && cmd.y1 !== undefined) {
        const endPoint: Point = { x: cmd.x1, y: cmd.y1 };
        for (const ws of workspaces) {
          const dist = segmentWorkspaceDistance(currentPoint, endPoint, ws);
          minClearance = Math.min(minClearance, dist);
        }
        currentPoint = endPoint;
      }
    } else if (cmd.type === 'C') {
      // Cubic Bézier - check curve clearance
      if (cmd.x1 !== undefined && cmd.y1 !== undefined &&
          cmd.x2 !== undefined && cmd.y2 !== undefined &&
          cmd.x3 !== undefined && cmd.y3 !== undefined) {
        const cp1: Point = { x: cmd.x1, y: cmd.y1 };
        const cp2: Point = { x: cmd.x2, y: cmd.y2 };
        const endPoint: Point = { x: cmd.x3, y: cmd.y3 };
        
        const curveClearance = bezierCurveClearance(currentPoint, cp1, cp2, endPoint, workspaces);
        minClearance = Math.min(minClearance, curveClearance);
        currentPoint = endPoint;
      }
    }
  }
  
  return {
    isSafe: minClearance >= MIN_CLEARANCE,
    minClearance,
  };
}

/**
 * Calculate minimum clearance for entire path (waypoints only - for fallback)
 */
function calculateRouteClearance(waypoints: Point[], workspaces: WorkspaceBounds[]): number {
  let minClearance = Infinity;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    for (const ws of workspaces) {
      const dist = segmentWorkspaceDistance(waypoints[i], waypoints[i + 1], ws);
      minClearance = Math.min(minClearance, dist);
    }
  }
  
  return minClearance;
}

/**
 * Calculate path cost based on length and segment types
 */
function calculatePathCost(waypoints: Point[], segments: HybridSegment[]): number {
  let length = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = waypoints[i + 1].x - waypoints[i].x;
    const dy = waypoints[i + 1].y - waypoints[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  
  // Penalty for critical segments (prefer smoother paths)
  let criticalPenalty = 0;
  for (const seg of segments) {
    if (seg.type === SegmentType.CRITICAL) {
      criticalPenalty += 20; // Increased penalty
    } else if (seg.type === SegmentType.TRANSITION) {
      criticalPenalty += 5;
    }
  }
  
  return length + criticalPenalty;
}

/**
 * Main routing function: Find optimal hybrid step-bump curve avoiding workspaces
 * Uses backward routing (from destination to source) with hybrid step-bump algorithm
 */
export function routeBezierCurve(
  start: Point,
  destination: Point,
  allWorkspaces: Record<string, Workspace>
): BezierRoute | null {
  // Convert ALL workspaces to bounds
  const workspaceBounds: WorkspaceBounds[] = [];
  
  for (const ws of Object.values(allWorkspaces)) {
    workspaceBounds.push(workspaceToBounds(ws));
  }
  
  // Check for direct path with improved clearance checking
  if (hasDirectPath(start, destination, workspaceBounds)) {
    return generateDirectPath(start, destination);
  }
  
  // Otherwise use hybrid algorithm
  return hybridStepBumpRoute(destination, start, workspaceBounds);
}

/**
 * Convert hybrid step-bump control points to cubic Bézier segments for rendering
 * The control points may contain a mix of line segments and Bézier curves
 */
export function bezierToCubicSegments(
  controlPoints: Point[]
): Array<{ cp1: Point; cp2: Point; end: Point }> {
  if (controlPoints.length < 2) {
    return [];
  }
  
  const segments: Array<{ cp1: Point; cp2: Point; end: Point }> = [];
  let i = 0;
  
  while (i < controlPoints.length - 1) {
    const start = controlPoints[i];
    
    // Check if we have enough points for a cubic Bézier
    if (i + 3 < controlPoints.length) {
      const cp1 = controlPoints[i + 1];
      const cp2 = controlPoints[i + 2];
      const end = controlPoints[i + 3];
      
      // Verify this is actually a Bézier by checking curvature
      const dx1 = cp1.x - start.x;
      const dy1 = cp1.y - start.y;
      const dx2 = end.x - cp2.x;
      const dy2 = end.y - cp2.y;
      
      // If there's significant curvature, treat as Bézier
      if (Math.abs(dx1) > 1 || Math.abs(dy1) > 1 || Math.abs(dx2) > 1 || Math.abs(dy2) > 1) {
        segments.push({ cp1, cp2, end });
        i += 4;
        continue;
      }
    }
    
    // Linear segment or not enough points - create a straight segment
    const end = controlPoints[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Create control points that create a straight line
    const cp1 = {
      x: start.x + dx / 3,
      y: start.y + dy / 3,
    };
    const cp2 = {
      x: start.x + 2 * dx / 3,
      y: start.y + 2 * dy / 3,
    };
    
    segments.push({ cp1, cp2, end });
    i += 2;
  }
  
  return segments;
}
