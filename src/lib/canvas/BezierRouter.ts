/**
 * Hybrid Step-Bump Bézier Router
 * Implements optimized backward routing with elbow connections
 * Uses simple step-based routing (like d3 curveStep) for backward connections
 * Phase 1: Generate elbow waypoints (horizontal-first, then vertical)
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
  waypoints?: Point[]; // Elbow waypoints for hybrid routing
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
const CLEARANCE_THRESHOLD = 60; // Threshold for segment classification (lowered for more conservative FREE classification)
const STEP_T = 0.5; // Step transition point (0-1)
const HORIZONTAL_BUFFER = 60; // Minimum horizontal distance before bending (legacy, for non-backward paths)
const VERTICAL_BUFFER = 40; // Minimum vertical clearance from workspaces
const BEZIER_SAMPLE_COUNT = 50; // Number of samples for curve intersection checking

// New constants for backward connection routing
const HORIZONTAL_EXTEND_BASE = 40; // Base horizontal extension (px)
const HORIZONTAL_EXTEND_PER_CONNECTION = 20; // Additional extension per output connection (px)
const HORIZONTAL_EXTEND_MAX = 180; // Maximum horizontal extension (px)
const VERTICAL_OVERREACH_BASE = 20; // Base vertical overreach beyond bounds (px)
const DENSITY_SPACING_MULTIPLIER = 10; // Spacing per intersecting connection line (px)
const Y_OVERLAP_THRESHOLD = 1.5; // Multiplier for "close" Y position detection

// Smooth elbow curve constants
const ELBOW_SMOOTHNESS = 0.3; // Smoothness factor for elbow curves (0-1, higher = smoother)
const ELBOW_CURVE_RADIUS = 30; // Base radius for elbow curves (px)

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
 * Calculate horizontal extension length based on output connection count
 * Base: 40px, add 20px per output connection, max 180px
 */
function calculateHorizontalExtension(
  sourceWorkspace: Workspace | undefined,
  _allWorkspaces: Record<string, Workspace> | undefined // Reserved for future use
): number {
  if (!sourceWorkspace) return HORIZONTAL_EXTEND_BASE;
  
  const numOutputs = sourceWorkspace.outputConnections?.length ?? 0;
  const extension = HORIZONTAL_EXTEND_BASE + HORIZONTAL_EXTEND_PER_CONNECTION * numOutputs;
  return Math.min(extension, HORIZONTAL_EXTEND_MAX);
}

/**
 * Calculate horizontal extension length for input side (symmetric to output)
 * Base: 40px, add 20px per incoming connection, max 180px
 * Counts how many workspaces connect TO this target workspace
 */
function calculateInputExtension(
  targetWorkspace: Workspace | undefined,
  allWorkspaces: Record<string, Workspace> | undefined
): number {
  if (!targetWorkspace || !allWorkspaces) return HORIZONTAL_EXTEND_BASE;
  
  // Count incoming connections (workspaces that have this target in their outputConnections)
  let numInputs = 0;
  for (const ws of Object.values(allWorkspaces)) {
    if (ws.outputConnections?.includes(targetWorkspace.id)) {
      numInputs++;
    }
  }
  
  const extension = HORIZONTAL_EXTEND_BASE + HORIZONTAL_EXTEND_PER_CONNECTION * numInputs;
  return Math.min(extension, HORIZONTAL_EXTEND_MAX);
}

/**
 * Choose vertical direction (top or bottom) based on Y position overlap
 * If workspaces overlap or are close: use upper bound (top)
 * Otherwise: use lower bound (bottom)
 */
function chooseVerticalDirection(
  sourceBounds: WorkspaceBounds,
  targetBounds: WorkspaceBounds
): 'top' | 'bottom' {
  const sourceTop = sourceBounds.y;
  const sourceBottom = sourceBounds.bottom;
  const targetTop = targetBounds.y;
  const targetBottom = targetBounds.bottom;
  
  // Check if Y ranges overlap
  const isOverlapping = !(
    sourceBottom < targetTop || 
    targetBottom < sourceTop
  );
  
  // Check if they're close (within 1.5x max height)
  const maxHeight = Math.max(sourceBounds.height, targetBounds.height);
  const sourceCenterY = (sourceTop + sourceBottom) / 2;
  const targetCenterY = (targetTop + targetBottom) / 2;
  const yDistance = Math.abs(sourceCenterY - targetCenterY);
  const isClose = yDistance < maxHeight * Y_OVERLAP_THRESHOLD;
  
  // If overlapping or close: use upper bound, otherwise lower bound
  return (isOverlapping || isClose) ? 'top' : 'bottom';
}

/**
 * Check if two line segments intersect
 * Uses cross product method for line segment intersection
 */
function segmentsIntersect(
  p1: Point, p2: Point, p3: Point, p4: Point
): boolean {
  // Helper function to calculate cross product
  const crossProduct = (o: Point, a: Point, b: Point): number => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };
  
  // Check if point d is on segment ab
  const onSegment = (a: Point, b: Point, c: Point): boolean => {
    return (
      c.x <= Math.max(a.x, b.x) &&
      c.x >= Math.min(a.x, b.x) &&
      c.y <= Math.max(a.y, b.y) &&
      c.y >= Math.min(a.y, b.y)
    );
  };
  
  // Calculate orientations
  const o1 = crossProduct(p1, p2, p3);
  const o2 = crossProduct(p1, p2, p4);
  const o3 = crossProduct(p3, p4, p1);
  const o4 = crossProduct(p3, p4, p2);
  
  // General case: segments intersect if orientations differ
  if (o1 * o2 < 0 && o3 * o4 < 0) {
    return true;
  }
  
  // Special cases: check if endpoints are collinear and on segment
  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;
  
  return false;
}

/**
 * Calculate connection density along a path segment
 * Counts how many other connection lines intersect with the given segment
 */
function calculateConnectionDensity(
  pathSegment: { start: Point; end: Point },
  allWorkspaces: Record<string, Workspace> | undefined,
  excludeSourceId?: string,
  excludeTargetId?: string
): number {
  if (!allWorkspaces) return 0;
  
  let intersectingCount = 0;
  
  // Iterate through all connections
  for (const ws of Object.values(allWorkspaces)) {
    if (ws.id === excludeSourceId || ws.id === excludeTargetId) continue;
    
    ws.outputConnections?.forEach(toId => {
      const toWs = allWorkspaces[toId];
      if (!toWs) return;
      
      // Calculate connection line endpoints
      const connStart: Point = { 
        x: ws.x + ws.width, 
        y: ws.y + ws.height / 2 
      };
      const connEnd: Point = { 
        x: toWs.x, 
        y: toWs.y + toWs.height / 2 
      };
      
      // Check if lines intersect
      if (segmentsIntersect(
        pathSegment.start, 
        pathSegment.end, 
        connStart, 
        connEnd
      )) {
        intersectingCount++;
      }
    });
  }
  
  return intersectingCount;
}

/**
 * Find workspace IDs from connection points
 * Matches source point to workspace output port, target to input port
 */
function findWorkspaceIdsFromPoints(
  source: Point,
  destination: Point,
  allWorkspaces: Record<string, Workspace>
): { sourceId?: string; targetId?: string } {
  let sourceId: string | undefined;
  let targetId: string | undefined;
  const tolerance = 5; // Tolerance for matching points to ports
  
  for (const ws of Object.values(allWorkspaces)) {
    // Check if source matches output port (right edge, center Y)
    const outputX = ws.x + ws.width;
    const outputY = ws.y + ws.height / 2;
    if (
      Math.abs(source.x - outputX) < tolerance &&
      Math.abs(source.y - outputY) < tolerance
    ) {
      sourceId = ws.id;
    }
    
    // Check if destination matches input port (left edge, center Y)
    const inputX = ws.x;
    const inputY = ws.y + ws.height / 2;
    if (
      Math.abs(destination.x - inputX) < tolerance &&
      Math.abs(destination.y - inputY) < tolerance
    ) {
      targetId = ws.id;
    }
  }
  
  return { sourceId, targetId };
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
 * Phase 1: Generate elbow waypoints for backward routing
 * Uses step-based routing (like d3 curveStep) with rightward extension and bound overreach
 * For backward connections: start -> horizontal RIGHT -> vertical (up/down over bounds) -> horizontal to destination -> vertical to target
 * 
 * Requirements:
 * - Always extend horizontally to the RIGHT first (40-180px dynamic based on output count)
 * - Choose vertical direction based on Y overlap (top if overlapping/close, bottom otherwise)
 * - Overreach target bounds with spacing based on connection density
 */
function generateElbowWaypoints(
  source: Point,
  destination: Point,
  _workspaces: WorkspaceBounds[], // Not used here, but kept for API consistency
  sourceWorkspaceId?: string,
  targetWorkspaceId?: string,
  allWorkspaces?: Record<string, Workspace>
): Point[] {
  // workspaces parameter is used later in simplifyWaypoints and classifySegments (called from hybridStepBumpRoute)
  void _workspaces;
  
  const waypoints: Point[] = [source];
  
  // Get source and target workspaces for bounds and connection counting
  const sourceWorkspace = sourceWorkspaceId && allWorkspaces 
    ? allWorkspaces[sourceWorkspaceId] 
    : undefined;
  const targetWorkspace = targetWorkspaceId && allWorkspaces 
    ? allWorkspaces[targetWorkspaceId] 
    : undefined;
  
  // Step 1: Always extend horizontally to the RIGHT first
  // Calculate dynamic extension based on output connection count
  const horizontalExtend = calculateHorizontalExtension(sourceWorkspace, allWorkspaces);
  const rightExtendPoint: Point = {
    x: source.x + horizontalExtend,
    y: source.y
  };
  waypoints.push(rightExtendPoint);
  
  // Step 2: Choose vertical direction and calculate overreach
  // Get workspace bounds for direction choice
  let sourceBounds: WorkspaceBounds | undefined;
  let targetBounds: WorkspaceBounds | undefined;
  
  if (sourceWorkspace) {
    sourceBounds = workspaceToBounds(sourceWorkspace);
  } else {
    // Fallback: estimate bounds from point (assume standard workspace size)
    sourceBounds = {
      x: source.x - 100, // Estimate
      y: source.y - 50,
      width: 200,
      height: 100,
      right: source.x + 100,
      bottom: source.y + 50
    };
  }
  
  if (targetWorkspace) {
    targetBounds = workspaceToBounds(targetWorkspace);
  } else {
    // Fallback: estimate bounds from point
    targetBounds = {
      x: destination.x - 100,
      y: destination.y - 50,
      width: 200,
      height: 100,
      right: destination.x + 100,
      bottom: destination.y + 50
    };
  }
  
  // Choose vertical direction based on Y overlap
  const verticalDirection = chooseVerticalDirection(sourceBounds, targetBounds);
  
  // Calculate input extension early (needed for density calculation)
  const inputExtension = calculateInputExtension(targetWorkspace, allWorkspaces);
  
  // Calculate connection density along ALL path segments
  // Estimate segments for density calculation:
  // 1. Vertical segment (from rightExtendPoint to overreach)
  const estimatedVerticalEnd: Point = {
    x: rightExtendPoint.x,
    y: verticalDirection === 'top' 
      ? Math.min(sourceBounds.y, targetBounds.y) - VERTICAL_BUFFER
      : Math.max(sourceBounds.bottom, targetBounds.bottom) + VERTICAL_BUFFER
  };
  
  // 2. Horizontal left segment (from vertical overreach to target X - input extension)
  const estimatedHorizontalLeftEnd: Point = {
    x: destination.x - inputExtension,
    y: estimatedVerticalEnd.y
  };
  
  // 3. Final vertical segment (to target Y)
  const estimatedFinalVerticalEnd: Point = {
    x: destination.x - inputExtension,
    y: destination.y
  };
  
  // Calculate density for each segment and take the maximum
  const density1 = calculateConnectionDensity(
    { start: rightExtendPoint, end: estimatedVerticalEnd },
    allWorkspaces,
    sourceWorkspaceId,
    targetWorkspaceId
  );
  
  const density2 = calculateConnectionDensity(
    { start: estimatedVerticalEnd, end: estimatedHorizontalLeftEnd },
    allWorkspaces,
    sourceWorkspaceId,
    targetWorkspaceId
  );
  
  const density3 = calculateConnectionDensity(
    { start: estimatedHorizontalLeftEnd, end: estimatedFinalVerticalEnd },
    allWorkspaces,
    sourceWorkspaceId,
    targetWorkspaceId
  );
  
  // Use maximum density across all segments
  const maxDensity = Math.max(density1, density2, density3);
  
  // Calculate overreach: base + spacing based on density
  const extraSpacing = DENSITY_SPACING_MULTIPLIER * maxDensity;
  const overreach = VERTICAL_OVERREACH_BASE + extraSpacing;
  
  // Step 3: Vertical extension with overreach beyond target bounds
  let verticalY: number;
  if (verticalDirection === 'top') {
    // Route over upper Y bound
    verticalY = Math.min(sourceBounds.y, targetBounds.y) - VERTICAL_BUFFER - overreach;
  } else {
    // Route over lower Y bound
    verticalY = Math.max(sourceBounds.bottom, targetBounds.bottom) + VERTICAL_BUFFER + overreach;
  }
  
  const verticalOverreachPoint: Point = {
    x: rightExtendPoint.x,
    y: verticalY
  };
  waypoints.push(verticalOverreachPoint);
  
  // Step 4: Horizontal line LEFT to target X position (2nd elbow)
  // For backward connections (from output), this MUST always go LEFT
  // This is the second elbow - must always go left for backward connections
  const isBackward = destination.x < source.x;
  
  // For backward connections, ensure we go LEFT from the vertical overreach point
  // Go to target X MINUS input extension (to create space for the 4th elbow)
  // inputExtension was already calculated above for density calculation
  let horizontalToTargetX: number;
  
  if (isBackward) {
    // Backward connection: MUST go LEFT
    // Go to target X minus input extension (for symmetric clearance)
    // This creates space for the 4th elbow (horizontal right extension at input)
    horizontalToTargetX = destination.x - inputExtension;
    
    // Ensure we're actually going left (safety check)
    if (horizontalToTargetX >= rightExtendPoint.x) {
      // Edge case: not going left (shouldn't happen for backward)
      // Force going left by at least the horizontal buffer
      horizontalToTargetX = rightExtendPoint.x - HORIZONTAL_BUFFER;
      console.warn('Backward connection: destination not to the left, forcing left movement');
    }
  } else {
    // Forward connection: go to destination.x (should be to the right)
    horizontalToTargetX = destination.x;
  }
  
  const horizontalToTarget: Point = {
    x: horizontalToTargetX,
    y: verticalY
  };
  waypoints.push(horizontalToTarget);
  
  // Step 5: Vertical line to align with target Y (3rd elbow)
  // This creates a vertical segment to reach the target's Y level
  const verticalToTargetY: Point = {
    x: horizontalToTargetX,
    y: destination.y
  };
  waypoints.push(verticalToTargetY);
  
  // Step 6: Horizontal line RIGHT to target input socket (4th elbow)
  // This is the final horizontal extension at the input side (symmetric to output)
  // Creates clearance and matches the output's rightward extension
  const horizontalToInput: Point = {
    x: destination.x,
    y: destination.y
  };
  waypoints.push(horizontalToInput);
  
  return waypoints;
}

/**
 * Simplify waypoints by removing unnecessary intermediate points
 * Keeps only essential waypoints that maintain collision-free path
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
 * FIXED: For 3rd elbow in backward connections, considers 4th elbow x position for clearance
 */
function classifySegments(
  pathPoints: Point[],
  workspaces: WorkspaceBounds[],
  isBackward: boolean = false,
  destinationX?: number
): HybridSegment[] {
  const segments: HybridSegment[] = [];
  
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p1 = pathPoints[i];
    const p2 = pathPoints[i + 1];
    
    // For 3rd elbow (segment index 3) in backward connections, consider the full path
    // including the 4th elbow's x position alignment
    let clearanceP1 = p1;
    let clearanceP2 = p2;
    
    if (isBackward && i === 3 && destinationX !== undefined) {
      // 3rd elbow: vertical segment that will curve to 4th elbow's x position
      // Calculate clearance considering the full path to destination.x
      clearanceP2 = { x: destinationX, y: p2.y };
    }
    
    // Calculate minimum clearance along segment (or extended path for 3rd elbow)
    let minClearance = Infinity;
    for (const ws of workspaces) {
      const clearance = segmentWorkspaceDistance(clearanceP1, clearanceP2, ws);
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
      // For 3rd elbow in backward connections, simulate curve extending to 4th elbow's x position
      let curveEnd = p2;
      if (isBackward && i === 3 && destinationX !== undefined) {
        // 3rd elbow curve will extend horizontally to 4th elbow's x position
        curveEnd = { x: destinationX, y: p2.y };
      }
      
      // Simulate a bump curve to check if it would intersect
      const dx = Math.abs(curveEnd.x - p1.x);
      const dy = Math.abs(curveEnd.y - p1.y);
      let curveHeight = Math.min(dy * 0.5, dx * 0.3);
      curveHeight = Math.max(curveHeight, 20);
      curveHeight = Math.min(curveHeight, 80);
      
      const curveDir = curveEnd.y > p1.y ? 1 : -1;
      const cp1: Point = {
        x: p1.x + dx * 0.3,
        y: p1.y + curveDir * curveHeight * 0.7
      };
      const cp2: Point = {
        x: curveEnd.x - dx * 0.3,
        y: curveEnd.y - curveDir * curveHeight * 0.7
      };
      
      // Check if simulated curve collides
      if (bezierCurveCollides(p1, cp1, cp2, curveEnd, workspaces)) {
        // Reclassify as CRITICAL if curve would intersect
        segType = SegmentType.CRITICAL;
        // Recalculate clearance for the straight segment (which we'll use for step routing)
        // Use extended path for 3rd elbow to consider 4th elbow x position
        minClearance = Infinity;
        for (const ws of workspaces) {
          const clearance = segmentWorkspaceDistance(clearanceP1, clearanceP2, ws);
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
 * Generate smooth elbow segment for backward connections
 * Creates Bézier curves with minimal, consistent control points at elbows
 * Uses fixed radius and minimal perpendicular offsets (no smoothness enhancement or overshoot)
 * All elbows use the same consistent offsets for uniform curves
 */
function generateSmoothElbowSegment(
  p1: Point,
  p2: Point,
  prevSegment?: { start: Point; end: Point } | null,
  nextSegment?: { start: Point; end: Point } | null,
  isSecondElbow: boolean = false,
  isThirdElbow: boolean = false,
  isFourthElbow: boolean = false,
  curveRadius: number = ELBOW_CURVE_RADIUS
): PathCommand[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // FIX 1: Use fixed radius for consistency (not distance-dependent)
  // For 2nd, 3rd, and 4th elbows, use fixed radius to ensure visual consistency
  // Allow radius to be adjusted for iterative validation retries
  const fixedRadius = curveRadius;
  
  // Determine if this is a horizontal or vertical segment
  const isHorizontal = Math.abs(dy) < Math.abs(dx);
  
  // Calculate control points with minimal, consistent offsets (no smoothness enhancement or overshoot)
  let cp1: Point;
  let cp2: Point;
  
  // REMOVED: All smoothness factors and overshoot - use consistent minimal offsets for all elbows
  const perpendicularOffset = fixedRadius * ELBOW_SMOOTHNESS; // Consistent minimal offset (30 * 0.3 = 9px)
  const tangentOffset = fixedRadius * 0.6; // Fixed tangent offset (30 * 0.6 = 18px)
  
  if (isHorizontal) {
    // Horizontal segment: offset Y perpendicularly with minimal, consistent offsets
    // Use balanced perpendicular offsets - cp1 and cp2 use opposite perpendicular offsets
    // Offset direction based on segment direction (no special elbow handling)
    const yOffsetDirection = dy > 0 ? 1 : -1;
    
    cp1 = {
      x: p1.x + (dx > 0 ? tangentOffset : -tangentOffset),
      y: p1.y + yOffsetDirection * perpendicularOffset
    };
    cp2 = {
      x: p2.x - (dx > 0 ? tangentOffset : -tangentOffset),
      y: p2.y - yOffsetDirection * perpendicularOffset  // Opposite perpendicular offset for symmetry
    };
  } else {
    // Vertical segment: offset X perpendicularly with minimal, consistent offsets
    // Use balanced perpendicular offsets - cp1 and cp2 use opposite perpendicular offsets
    // Offset direction based on segment direction (no special elbow handling)
    const xOffsetDirection = dx > 0 ? 1 : -1;
    
    cp1 = {
      x: p1.x + xOffsetDirection * perpendicularOffset,
      y: p1.y + (dy > 0 ? tangentOffset : -tangentOffset)
    };
    cp2 = {
      x: p2.x - xOffsetDirection * perpendicularOffset,  // Opposite perpendicular offset for symmetry
      y: p2.y - (dy > 0 ? tangentOffset : -tangentOffset)
    };
  }
  
  // For very short segments, use straight line
  if (distance < fixedRadius * 2) {
    return [
      { type: 'L', x1: p2.x, y1: p2.y }
    ];
  }
  
  // Create Bézier curve with minimal, consistent control points
  return [
    {
      type: 'C',
      x1: cp1.x,
      y1: cp1.y,
      x2: cp2.x,
      y2: cp2.y,
      x3: p2.x,
      y3: p2.y
    }
  ];
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
 * Uses consistent minimal offsets for all elbows (no smoothness enhancement)
 */
function generateHybridCurve(
  segments: HybridSegment[],
  isBackward: boolean = false,
  workspaces: WorkspaceBounds[] = [],
  curveRadius: number = ELBOW_CURVE_RADIUS
): PathCommand[] {
  const commands: PathCommand[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let segCommands: PathCommand[];
    
    // For backward connections, use elbow curves with consistent minimal offsets
    // Identify 2nd, 3rd, and 4th elbows based on segment index
    // Waypoint structure: source -> rightExtend -> verticalOverreach -> horizontalToTarget -> verticalToTargetY -> horizontalToInput
    // Segments: 0: source->rightExtend, 1: rightExtend->verticalOverreach, 2: verticalOverreach->horizontalToTarget (2nd elbow),
    //           3: horizontalToTarget->verticalToTargetY (3rd elbow), 4: verticalToTargetY->horizontalToInput (4th elbow)
    if (isBackward) {
      // Get previous and next segments for context
      const prevSeg = i > 0 ? segments[i - 1] : null;
      const nextSeg = i < segments.length - 1 ? segments[i + 1] : null;
      
      // Identify specific elbows: segment index 2 = 2nd elbow, index 3 = 3rd elbow, index 4 = 4th elbow
      const isSecondElbow = i === 2; // Horizontal left after vertical overreach
      const isThirdElbow = i === 3;   // Vertical to target Y
      const isFourthElbow = i === 4;  // Horizontal to input
      
      // Use elbow segments with consistent minimal offsets (no smoothness enhancement)
      // Pass adjustable curve radius for iterative validation retries
      segCommands = generateSmoothElbowSegment(
        seg.start,
        seg.end,
        prevSeg ? { start: prevSeg.start, end: prevSeg.end } : null,
        nextSeg ? { start: nextSeg.start, end: nextSeg.end } : null,
        isSecondElbow,
        isThirdElbow,
        isFourthElbow,
        curveRadius
      );
    } else if (seg.type === SegmentType.CRITICAL) {
      // Forward connections: use step routing for guaranteed clearance
      segCommands = generateStepSegment(seg.start, seg.end, STEP_T, isBackward);
    } else if (seg.type === SegmentType.FREE) {
      // Forward connections: use bump for smooth curves (with workspace awareness)
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
 * Phase 1: Generate elbow waypoints (step-based routing like d3 curveStep)
 * Phase 2: Classify segments
 * Phase 3: Generate hybrid curves
 * ENHANCED: Better workspace avoidance and horizontal-first principle with rightward extension
 */
function hybridStepBumpRoute(
  destination: Point,
  source: Point,
  workspaces: WorkspaceBounds[],
  sourceWorkspaceId?: string,
  targetWorkspaceId?: string,
  allWorkspaces?: Record<string, Workspace>
): BezierRoute | null {
  const isBackward = destination.x < source.x;
  
  // Phase 1: Generate elbow waypoints (step-based routing)
  // For backward connections, this creates a path: horizontal RIGHT -> vertical (overreach) -> horizontal -> vertical
  const waypoints = generateElbowWaypoints(
    source, 
    destination, 
    workspaces,
    sourceWorkspaceId,
    targetWorkspaceId,
    allWorkspaces
  );
  
  if (!waypoints || waypoints.length < 2) {
    return null; // No path found
  }
  
  // Simplify waypoints to remove unnecessary intermediate points
  const simplifiedWaypoints = simplifyWaypoints(waypoints, workspaces);
  
  // Phase 2: Classify segments
  // Pass destination.x for 3rd elbow clearance calculation in backward connections
  const segments = classifySegments(simplifiedWaypoints, workspaces, isBackward, destination.x);
  
  // Phase 3: Generate hybrid curve commands with iterative radius adjustment for validation
  // FIXED: Iteratively increase radius if clearance fails (up to 3 attempts, 5px per attempt)
  let currentRadius = ELBOW_CURVE_RADIUS;
  let commands: PathCommand[] = [];
  let validationResult: { isSafe: boolean; minClearance: number } = { isSafe: false, minClearance: 0 };
  let maxAttempts = 3;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Generate hybrid curve commands with current radius
    commands = generateHybridCurve(segments, isBackward, workspaces, currentRadius);
    
    // Post-routing validation: Check if the final path is safe
    validationResult = validateRoutePath(commands, simplifiedWaypoints[0], workspaces);
    
    // If route is safe or we've exhausted attempts, break
    if (validationResult.isSafe || validationResult.minClearance >= MIN_CLEARANCE || attempts >= maxAttempts - 1) {
      break;
    }
    
    // Increase radius by 5px and retry
    currentRadius += 5;
    attempts++;
  }
  
  // Final validation check
  if (!validationResult.isSafe && validationResult.minClearance < MIN_CLEARANCE) {
    console.warn('Route has low clearance after retries:', validationResult.minClearance, 'radius:', currentRadius);
  }
  
  // Convert final commands to control points
  const controlPoints = commandsToControlPoints(commands, simplifiedWaypoints[0]);
  
  // Calculate route metrics (using actual curve clearance)
  const clearance = Math.max(validationResult.minClearance, calculateRouteClearance(simplifiedWaypoints, workspaces));
  const cost = calculatePathCost(simplifiedWaypoints, segments);
  
  return {
    controlPoints,
    order: 3, // Cubic Bézier
    cost,
    clearance,
    waypoints: simplifiedWaypoints,
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
  allWorkspaces: Record<string, Workspace>,
  sourceWorkspaceId?: string,
  targetWorkspaceId?: string
): BezierRoute | null {
  // Convert ALL workspaces to bounds
  const workspaceBounds: WorkspaceBounds[] = [];
  
  for (const ws of Object.values(allWorkspaces)) {
    workspaceBounds.push(workspaceToBounds(ws));
  }
  
  // If workspace IDs not provided, try to find them from points
  let sourceId = sourceWorkspaceId;
  let targetId = targetWorkspaceId;
  
  if (!sourceId || !targetId) {
    const found = findWorkspaceIdsFromPoints(start, destination, allWorkspaces);
    sourceId = sourceId || found.sourceId;
    targetId = targetId || found.targetId;
  }
  
  // Check for direct path with improved clearance checking
  // Only use direct path for forward connections (not backward)
  const isBackward = destination.x < start.x;
  if (!isBackward && hasDirectPath(start, destination, workspaceBounds)) {
    return generateDirectPath(start, destination);
  }
  
  // Otherwise use hybrid algorithm (always for backward, or when direct path blocked)
  return hybridStepBumpRoute(
    destination, 
    start, 
    workspaceBounds,
    sourceId,
    targetId,
    allWorkspaces
  );
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
