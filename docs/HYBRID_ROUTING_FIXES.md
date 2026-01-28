# Hybrid Routing: Quick Fix Summary

## Current Implementation Status

✅ **All 3 phases implemented**:
- Phase 1: Grid-based A* search (backward routing)
- Phase 2: Segment classification (CRITICAL/FREE/TRANSITION)
- Phase 3: Hybrid curve generation (step/bump/blend)

## Critical Issue: Wide Looping Paths

**Problem**: Simple backward connections create excessively wide, looping curves that go far above nodes.

**Root Cause**: Algorithm always uses full A* search even when no obstacles exist, creating unnecessary waypoints and wide bump curves.

## Immediate Fix Required

### Fix 1: Direct Path Detection (CRITICAL - Do First)

Add to `BezierRouter.ts`:

```typescript
// Add after workspaceToBounds function
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
```

Update `routeBezierCurve()`:

```typescript
export function routeBezierCurve(
  start: Point,
  destination: Point,
  allWorkspaces: Record<string, Workspace>
): BezierRoute | null {
  const workspaceBounds: WorkspaceBounds[] = [];
  for (const ws of Object.values(allWorkspaces)) {
    workspaceBounds.push(workspaceToBounds(ws));
  }
  
  // ✅ ADD THIS: Check for direct path first
  if (hasDirectPath(start, destination, workspaceBounds)) {
    return generateDirectPath(start, destination);
  }
  
  // Otherwise use hybrid algorithm
  return hybridStepBumpRoute(destination, start, workspaceBounds);
}
```

### Fix 2: Waypoint Simplification (HIGH Priority)

Add after A* search in `hybridStepBumpRoute()`:

```typescript
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
```

Use in `hybridStepBumpRoute()`:

```typescript
const backwardWaypoints = backwardAStarSearch(destination, source, expandedWorkspaces);
if (!backwardWaypoints || backwardWaypoints.length < 2) {
  return null;
}

// ✅ ADD THIS: Simplify waypoints
const simplifiedBackward = simplifyWaypoints(backwardWaypoints, workspaces);
const waypoints = [...simplifiedBackward].reverse();
```

### Fix 3: Constrain Bump Curves (MEDIUM Priority)

Update `generateBumpSegment()`:

```typescript
function generateBumpSegment(p1: Point, p2: Point): PathCommand[] {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  
  // ✅ ADD: Limit curvature to prevent wide loops
  const maxHorizontalOffset = Math.min(dx * 0.3, 150); // Max 150px or 30% of distance
  const cx = (x1 + x2) / 2;
  
  // For primarily vertical segments, use minimal horizontal offset
  const verticalOffset = dy > dx * 2 ? 0 : Math.min(dy * 0.1, 30);
  
  return [{
    type: 'C',
    x1: cx, y1: y1 + verticalOffset,
    x2: cx, y2: y2 + verticalOffset,
    x3: x2, y3: y2,
  }];
}
```

## Testing Checklist

After implementing fixes:

- [ ] Simple backward connection (2 nodes, no obstacles) → compact curve
- [ ] Backward connection with obstacles → routes around efficiently  
- [ ] Forward connection → uses simple routing (not hybrid)
- [ ] Performance with many connections → no lag
- [ ] Visual quality → smooth, not too wide

## Expected Results

**Before**: Wide looping curve going far above nodes  
**After**: Compact, smooth curve that takes reasonable path
