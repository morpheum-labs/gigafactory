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
const MIN_CLEARANCE = 30; // Minimum distance from workspaces
const GRID_SIZE = 40; // Grid size for A* search
const CLEARANCE_THRESHOLD = 80; // Threshold for segment classification
const STEP_T = 0.5; // Step transition point (0-1)
const MAX_ASTAR_ITERATIONS = 1000; // Max iterations for A* search

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
 */
function hasDirectPath(start: Point, end: Point, workspaces: WorkspaceBounds[]): boolean {
  // Sample points along direct line
  const samples = 20;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point: Point = {
      x: start.x + t * (end.x - start.x),
      y: start.y + t * (end.y - start.y),
    };
    for (const ws of workspaces) {
      if (pointInBounds(point, ws, MIN_CLEARANCE)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Generate a simple direct path when no obstacles exist
 */
function generateDirectPath(start: Point, end: Point): BezierRoute {
  const dx = end.x - start.x;
  const horizontalOffset = Math.min(100, Math.abs(dx) / 2);
  
  const controlPoints = [
    start,
    { x: start.x + horizontalOffset, y: start.y },
    { x: end.x - horizontalOffset, y: end.y },
    end
  ];
  
  return {
    controlPoints,
    order: 3,
    cost: Math.sqrt(dx * dx + (end.y - start.y) ** 2),
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
 * Calculate minimum distance from segment to workspace
 */
function segmentWorkspaceDistance(p1: Point, p2: Point, workspace: WorkspaceBounds): number {
  let minDist = Infinity;
  const samples = 20;
  
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
 */
function backwardAStarSearch(
  destination: Point,
  source: Point,
  workspaces: WorkspaceBounds[]
): Point[] | null {
  const openSet: StepNode[] = [];
  const closedSet = new Set<string>();
  
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
      // Reconstruct path
      const path: Point[] = [];
      let node: StepNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      // Add source point exactly
      path.push(source);
      return path;
    }
    
    // Generate neighbors (axis-aligned moves only)
    const neighbors = generateNeighbors(current, workspaces);
    
    for (const neighbor of neighbors) {
      const neighborKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(neighborKey)) continue;
      
      // Calculate costs
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
 * Generate axis-aligned neighbor positions
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
    
    // Check collision with workspaces
    if (!collidesWithWorkspace({ x: nx, y: ny }, workspaces)) {
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
 * Calculate movement cost with penalties for direction changes and proximity
 */
function movementCost(current: StepNode, neighbor: StepNode, workspaces: WorkspaceBounds[]): number {
  const baseCost = Math.abs(neighbor.x - current.x) + Math.abs(neighbor.y - current.y);
  
  // Penalty for direction changes (to reduce zigzag)
  let directionPenalty = 0;
  if (current.parent) {
    const prevDirection = current.direction;
    const currDirection = neighbor.direction;
    if (prevDirection && currDirection && prevDirection !== currDirection) {
      directionPenalty = 5;
    }
  }
  
  // Penalty for proximity to workspaces
  let clearancePenalty = 0;
  for (const ws of workspaces) {
    const dist = distanceToRectangle({ x: neighbor.x, y: neighbor.y }, ws);
    if (dist < CLEARANCE_THRESHOLD) {
      clearancePenalty += (CLEARANCE_THRESHOLD - dist) * 2;
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
 */
function simplifyWaypoints(waypoints: Point[], workspaces: WorkspaceBounds[]): Point[] {
  if (waypoints.length <= 2) return waypoints;
  
  const simplified: Point[] = [waypoints[0]];
  let i = 0;
  
  while (i < waypoints.length - 1) {
    let furthest = i + 1;
    for (let j = waypoints.length - 1; j > i + 1; j--) {
      // Check if we can skip intermediate waypoints
      let canSkip = true;
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const point: Point = {
          x: waypoints[i].x + t * (waypoints[j].x - waypoints[i].x),
          y: waypoints[i].y + t * (waypoints[j].y - waypoints[i].y),
        };
        for (const ws of workspaces) {
          if (pointInBounds(point, ws, MIN_CLEARANCE)) {
            canSkip = false;
            break;
          }
        }
        if (!canSkip) break;
      }
      if (canSkip) {
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
 */
function classifySegments(
  pathPoints: Point[],
  workspaces: WorkspaceBounds[]
): HybridSegment[] {
  const segments: HybridSegment[] = [];
  
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p1 = pathPoints[i];
    const p2 = pathPoints[i + 1];
    
    // Calculate minimum clearance along segment
    let minClearance = Infinity;
    for (const ws of workspaces) {
      const clearance = segmentWorkspaceDistance(p1, p2, ws);
      minClearance = Math.min(minClearance, clearance);
    }
    
    // Classify based on clearance
    let segType: SegmentType;
    if (minClearance < CLEARANCE_THRESHOLD * 0.5) {
      segType = SegmentType.CRITICAL;
    } else if (minClearance < CLEARANCE_THRESHOLD) {
      segType = SegmentType.TRANSITION;
    } else {
      segType = SegmentType.FREE;
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
 * Generate step segment (axis-aligned)
 */
function generateStepSegment(p1: Point, p2: Point, t: number = STEP_T): PathCommand[] {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  
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
 * Generate bump segment (Bézier curve with horizontal tangents)
 */
function generateBumpSegment(p1: Point, p2: Point): PathCommand[] {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  
  // ✅ Limit curvature to prevent wide loops
  const cx = (x1 + x2) / 2;
  
  // For primarily vertical segments, use minimal vertical offset to prevent wide loops
  const verticalOffset = dy > dx * 2 ? 0 : Math.min(dy * 0.1, 30);
  
  return [
    {
      type: 'C',
      x1: cx, y1: y1 + verticalOffset, // Control point 1
      x2: cx, y2: y2 + verticalOffset, // Control point 2
      x3: x2, y3: y2, // End point
    },
  ];
}

/**
 * Generate blended segment (mix of step and bump)
 */
function generateBlendedSegment(p1: Point, p2: Point, clearance: number): PathCommand[] {
  // Higher clearance = more bump-like
  const blendFactor = Math.min(1.0, clearance / CLEARANCE_THRESHOLD);
  
  if (blendFactor < 0.5) {
    return generateStepSegment(p1, p2, STEP_T);
  } else {
    return generateBumpSegment(p1, p2);
  }
}

/**
 * Generate hybrid curve from classified segments
 */
function generateHybridCurve(segments: HybridSegment[]): PathCommand[] {
  const commands: PathCommand[] = [];
  
  for (const seg of segments) {
    let segCommands: PathCommand[];
    
    if (seg.type === SegmentType.CRITICAL) {
      // Use step routing for guaranteed clearance
      segCommands = generateStepSegment(seg.start, seg.end, STEP_T);
    } else if (seg.type === SegmentType.FREE) {
      // Use bumpX for smooth curves
      segCommands = generateBumpSegment(seg.start, seg.end);
    } else {
      // TRANSITION: Blend step and bump
      segCommands = generateBlendedSegment(seg.start, seg.end, seg.clearance);
    }
    
    commands.push(...segCommands);
  }
  
  return commands;
}

/**
 * Convert path commands to control points for rendering
 * This converts the hybrid step-bump commands into Bézier control points
 */
function commandsToControlPoints(commands: PathCommand[], start: Point): Point[] {
  const controlPoints: Point[] = [start];
  
  for (const cmd of commands) {
    if (cmd.type === 'L') {
      // Line segment - add as point
      if (cmd.x1 !== undefined && cmd.y1 !== undefined) {
        controlPoints.push({ x: cmd.x1, y: cmd.y1 });
      }
    } else if (cmd.type === 'C') {
      // Cubic Bézier - add control points and end point
      if (cmd.x1 !== undefined && cmd.y1 !== undefined &&
          cmd.x2 !== undefined && cmd.y2 !== undefined &&
          cmd.x3 !== undefined && cmd.y3 !== undefined) {
        // For rendering, we need to convert to standard Bézier format
        // The current point is the start, cmd defines cp1, cp2, end
        controlPoints.push(
          { x: cmd.x1, y: cmd.y1 }, // cp1
          { x: cmd.x2, y: cmd.y2 }, // cp2
          { x: cmd.x3, y: cmd.y3 }  // end
        );
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
 */
function hybridStepBumpRoute(
  destination: Point,
  source: Point,
  workspaces: WorkspaceBounds[]
): BezierRoute | null {
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
  // A* routes from destination to source, but we need waypoints from source to destination for rendering
  const backwardWaypoints = backwardAStarSearch(destination, source, expandedWorkspaces);
  
  if (!backwardWaypoints || backwardWaypoints.length < 2) {
    return null; // No path found
  }
  
  // ✅ Simplify waypoints to remove unnecessary intermediate points
  const simplifiedBackward = simplifyWaypoints(backwardWaypoints, workspaces);
  
  // Reverse waypoints to go from source to destination for rendering
  const waypoints = [...simplifiedBackward].reverse();
  
  // Phase 2: Classify segments
  const segments = classifySegments(waypoints, workspaces);
  
  // Phase 3: Generate hybrid curve commands
  const commands = generateHybridCurve(segments);
  
  // Convert commands to control points for rendering
  // Start from source (first waypoint)
  const controlPoints = commandsToControlPoints(commands, waypoints[0]);
  
  // Calculate route metrics (use original backward waypoints for clearance calculation)
  const clearance = calculateRouteClearance(backwardWaypoints, workspaces);
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
 * Calculate minimum clearance for entire path
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
      criticalPenalty += 10;
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
  // Convert ALL workspaces to bounds (don't exclude any - we need to avoid them all)
  const workspaceBounds: WorkspaceBounds[] = [];
  
  for (const ws of Object.values(allWorkspaces)) {
    workspaceBounds.push(workspaceToBounds(ws));
  }
  
  // ✅ Check for direct path first - avoid unnecessary A* search
  if (hasDirectPath(start, destination, workspaceBounds)) {
    return generateDirectPath(start, destination);
  }
  
  // Otherwise use hybrid algorithm
  // Use hybrid step-bump routing (backward: from destination to source)
  // The grid-based A* will naturally route to the destination point
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
    const end = controlPoints[i + 1];
    
    // Check if this is a Bézier segment (has 2 control points before end)
    if (i + 3 < controlPoints.length) {
      // This might be a cubic Bézier (4 points: start, cp1, cp2, end)
      const cp1 = controlPoints[i + 1];
      const cp2 = controlPoints[i + 2];
      const bezierEnd = controlPoints[i + 3];
      
      // Verify this is actually a Bézier by checking if cp1 and cp2 are not on the line
      const isBezier = !isPointOnLine(start, bezierEnd, cp1) || !isPointOnLine(start, bezierEnd, cp2);
      
      if (isBezier) {
        segments.push({
          cp1,
          cp2,
          end: bezierEnd,
        });
        i += 4; // Skip to next segment
        continue;
      }
    }
    
    // Linear segment - convert to cubic Bézier with control points on the line
    const mid1 = {
      x: start.x + (end.x - start.x) / 3,
      y: start.y + (end.y - start.y) / 3,
    };
    const mid2 = {
      x: start.x + 2 * (end.x - start.x) / 3,
      y: start.y + 2 * (end.y - start.y) / 3,
    };
    
    segments.push({
      cp1: mid1,
      cp2: mid2,
      end,
    });
    
    i += 2; // Move to next segment
  }
  
  return segments;
}

/**
 * Check if a point is on a line segment
 */
function isPointOnLine(p1: Point, p2: Point, p: Point, tolerance: number = 1): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < tolerance) return true;
  
  // Distance from point to line
  const A = p.x - p1.x;
  const B = p.y - p1.y;
  const C = p2.x - p1.x;
  const D = p2.y - p1.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;
  
  if (param < 0 || param > 1) return false;
  
  const xx = p1.x + param * C;
  const yy = p1.y + param * D;
  const dx2 = p.x - xx;
  const dy2 = p.y - yy;
  
  return Math.sqrt(dx2 * dx2 + dy2 * dy2) < tolerance;
}
