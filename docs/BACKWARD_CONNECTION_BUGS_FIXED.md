# Backward Connection Routing Bugs - Audit Report

**Date:** January 28, 2026  
**Issue:** Disconnected curves in backward connections  
**Status:** Fixed

---

## Critical Bugs Found and Fixed

### Bug #1: Incorrect Index Increment in `bezierToCubicSegments` ⚠️ **CRITICAL**

**Location:** `BezierRouter.ts:2572` - `bezierToCubicSegments()`

**Problem:**
- When processing cubic Bézier curves, the function was incrementing the index by 4 instead of 3
- This caused it to skip the end point of one segment, creating gaps between segments
- Result: Disconnected curves with visible gaps

**Root Cause:**
```typescript
// WRONG (before fix):
if (isBézier) {
  segments.push({ cp1, cp2, end });
  i += 4;  // ❌ Skips the 'end' point, causing gap!
}

// Control points array: [start, cp1, cp2, end, next_start, ...]
// After processing i=0: creates segment from start to end
// Then i becomes 4, skipping 'end' (index 3) which should be the start of next segment
```

**Fix:**
```typescript
// CORRECT (after fix):
if (isBézier) {
  segments.push({ cp1, cp2, end });
  i += 3;  // ✅ Next segment starts at 'end' point (index i+3)
}
```

**Impact:** This was the primary cause of disconnected curves. Fixed in commit.

---

### Bug #2: Incorrect Index Increment for Linear Segments

**Location:** `BezierRouter.ts:2572` - `bezierToCubicSegments()`

**Problem:**
- For linear segments, incrementing by 2 instead of 1
- Could cause gaps when linear segments are followed by other segments

**Fix:**
```typescript
// Changed from i += 2 to i += 1
// Linear segments only need 2 points (start, end), so next segment starts at 'end'
```

---

### Bug #3: Potential Continuity Issues in `commandsToControlPoints`

**Location:** `BezierRouter.ts:2234` - `commandsToControlPoints()`

**Problem:**
- Duplicate point detection was too lenient (0.1 tolerance)
- Could miss small gaps or create unnecessary duplicates

**Fix:**
- Reduced tolerance to 0.01 for better precision
- Added warning log when gaps are detected
- Improved logic to ensure continuity

---

## How Control Points Flow

### Expected Format:
```
Control Points Array: [start, cp1, cp2, end, next_cp1, next_cp2, next_end, ...]
                      └─segment1─┘ └────segment2────┘
```

### For Mixed Segments (Line + Bézier):
```
Commands: L(start->p1), C(p1->p2 via cp1,cp2)
Control Points: [start, p1, cp1, cp2, p2]
                └─L─┘ └────C────┘
```

### Processing in `bezierToCubicSegments`:
1. **i=0** (start): Check if cubic Bézier possible (need i+3)
   - If yes: Process as Bézier, increment i by 3
   - If no: Process as linear, increment i by 1
2. **Next iteration** starts at the end point of previous segment
3. **Continue** until all points processed

---

## Testing Recommendations

1. **Visual Test:**
   - Create backward connections with obstacles
   - Enable `showDebugControlPoints: true`
   - Verify curves are continuous (no gaps)

2. **Console Check:**
   - Look for "[BezierRouter] Gap detected" warnings
   - Should not appear in normal operation

3. **Edge Cases:**
   - Test with single waypoint paths
   - Test with mixed line/curve segments
   - Test with very long paths

---

## Related Code Locations

- `BezierRouter.ts:2572` - `bezierToCubicSegments()` - **FIXED**
- `BezierRouter.ts:2234` - `commandsToControlPoints()` - **IMPROVED**
- `ConnectionRenderer.ts:290` - Rendering logic (uses segments correctly)

---

## Summary

The primary bug was in `bezierToCubicSegments()` where incorrect index increments caused gaps between curve segments. This has been fixed, and the curve should now render continuously for backward connections.

**Status:** ✅ Fixed and ready for testing
