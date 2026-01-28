# Control Point and Tangent Angle Calculations

## Constants
- `ELBOW_CURVE_RADIUS = 30` (px)
- `ELBOW_SMOOTHNESS = 0.3`
- `tangentOffset = fixedRadius * 0.6 = 30 * 0.6 = 18` (px) - **FIXED for all elbows**
- `perpendicularOffset = fixedRadius * ELBOW_SMOOTHNESS = 30 * 0.3 = 9` (px) - **CONSISTENT for all elbows (no smoothness enhancement)**

## Waypoint Structure (Backward Connections)
```
0: source → rightExtend (horizontal RIGHT)
1: rightExtend → verticalOverreach (vertical UP/DOWN)
2: verticalOverreach → horizontalToTarget (horizontal LEFT) - **2nd elbow**
3: horizontalToTarget → verticalToTargetY (vertical) - **3rd elbow**
4: verticalToTargetY → horizontalToInput (horizontal RIGHT) - **4th elbow**
```

## Control Point Calculations Table

| Segment | Type | Elbow | p1 | p2 | Direction | perpendicularOffset | tangentOffset | cp1 Calculation | cp2 Calculation | Distance from Endpoint |
|---------|------|-------|----|----|-----------|---------------------|---------------|-----------------|-----------------|----------------------|
| **0** | Horizontal | - | `source` | `rightExtend` | RIGHT | `9px` | `18px` | `x: p1.x + 18`<br>`y: p1.y + 9` (if dy>0) or `-9` (if dy<0) | `x: p2.x - 18`<br>`y: p2.y - 9` (opposite) | `√(18²+9²) ≈ 20.12px` |
| **1** | Vertical | - | `rightExtend` | `verticalOverreach` | UP/DOWN | `9px` | `18px` | `x: p1.x + 9` (if dx>0) or `-9` (if dx<0)<br>`y: p1.y + 18` (if dy>0) or `-18` (if dy<0) | `x: p2.x - 9` (opposite)<br>`y: p2.y - 18` (opposite) | `√(18²+9²) ≈ 20.12px` |
| **2** | Horizontal | **2nd** | `verticalOverreach` | `horizontalToTarget` | LEFT | `9px` | `18px` | `x: p1.x - 18`<br>`y: p1.y + 9` (if dy>0) or `-9` (if dy<0) | `x: p2.x + 18`<br>`y: p2.y - 9` (opposite) | `√(18²+9²) ≈ 20.12px` |
| **3** | Vertical | **3rd** | `horizontalToTarget` | `verticalToTargetY` | UP/DOWN | `9px` | `18px` | `x: p1.x + 9` (if dx>0) or `-9` (if dx<0)<br>`y: p1.y + 18` (if dy>0) or `-18` (if dy<0) | `x: p2.x - 9` (opposite)<br>`y: p2.y - 18` (opposite) | `√(18²+9²) ≈ 20.12px` |
| **4** | Horizontal | **4th** | `verticalToTargetY` | `horizontalToInput` | RIGHT | `9px` | `18px` | `x: p1.x + 18`<br>`y: p1.y + 9` (if dy>0) or `-9` (if dy<0) | `x: p2.x - 18`<br>`y: p2.y - 9` (opposite) | `√(18²+9²) ≈ 20.12px` |

### Quick Reference Summary

| Segment | Elbow | tangentOffset | perpendicularOffset | Total Distance | Offset Direction |
|---------|-------|---------------|-------------------|----------------|------------------|
| 0 | - | 18px | 9px | ≈20.12px | Segment direction (dy) |
| 1 | - | 18px | 9px | ≈20.12px | Segment direction (dx) |
| 2 | **2nd** | 18px | 9px | ≈20.12px | Segment direction (dy) |
| 3 | **3rd** | 18px | 9px | ≈20.12px | Segment direction (dx) |
| 4 | **4th** | 18px | 9px | ≈20.12px | Segment direction (dy) |

**Note**: All elbows now use **consistent minimal offsets** with no smoothness enhancement or overshoot. cp1 and cp2 use **opposite perpendicular offsets** for symmetry.

## Detailed Calculations by Elbow

### Segment 0: source → rightExtend (Horizontal RIGHT)
- **Type**: Horizontal
- **dx**: positive (RIGHT)
- **dy**: 0 (horizontal)
- **perpendicularOffset**: `9px` (consistent minimal offset)
- **tangentOffset**: `18px` (fixed)
- **Offset Direction**: Based on segment direction (`dy > 0 ? 1 : -1`)
- **cp1**: 
  - `x = p1.x + 18` (tangent offset along direction)
  - `y = p1.y + 9` (if dy > 0) or `p1.y - 9` (if dy < 0)
- **cp2**:
  - `x = p2.x - 18` (tangent offset opposite direction)
  - `y = p2.y - 9` (opposite perpendicular offset for symmetry)
- **Distance from endpoints**: `√(18² + 9²) ≈ 20.12px` (balanced)

### Segment 1: rightExtend → verticalOverreach (Vertical)
- **Type**: Vertical
- **dx**: 0 (vertical)
- **dy**: positive (DOWN) or negative (UP)
- **perpendicularOffset**: `9px` (consistent minimal offset)
- **tangentOffset**: `18px` (fixed)
- **Offset Direction**: Based on segment direction (`dx > 0 ? 1 : -1`)
- **cp1**:
  - `x = p1.x + 9` (if dx > 0) or `p1.x - 9` (if dx < 0)
  - `y = p1.y + 18` (if dy > 0) or `p1.y - 18` (if dy < 0)
- **cp2**:
  - `x = p2.x - 9` (opposite perpendicular offset for symmetry)
  - `y = p2.y - 18` (opposite tangent offset)
- **Distance from endpoints**: `√(18² + 9²) ≈ 20.12px` (balanced)

### Segment 2: verticalOverreach → horizontalToTarget (2nd Elbow - Horizontal LEFT)
- **Type**: Horizontal LEFT
- **Elbow Type**: 2nd elbow
- **dx**: negative (LEFT)
- **dy**: 0 (horizontal)
- **perpendicularOffset**: `9px` (consistent minimal offset)
- **tangentOffset**: `18px` (fixed)
- **Offset Direction**: Based on segment direction (`dy > 0 ? 1 : -1`)
- **cp1**:
  - `x = p1.x - 18` (tangent offset LEFT)
  - `y = p1.y + 9` (if dy > 0) or `p1.y - 9` (if dy < 0)
- **cp2**:
  - `x = p2.x + 18` (tangent offset opposite, toward p2)
  - `y = p2.y - 9` (opposite perpendicular offset for symmetry)
- **Distance from endpoints**: `√(18² + 9²) ≈ 20.12px` (balanced)

### Segment 3: horizontalToTarget → verticalToTargetY (3rd Elbow - Vertical)
- **Type**: Vertical
- **Elbow Type**: 3rd elbow
- **dx**: 0 (vertical)
- **dy**: positive (DOWN) or negative (UP)
- **perpendicularOffset**: `9px` (consistent minimal offset)
- **tangentOffset**: `18px` (fixed)
- **Offset Direction**: Based on segment direction (`dx > 0 ? 1 : -1`)
- **cp1**:
  - `x = p1.x + 9` (if dx > 0) or `p1.x - 9` (if dx < 0)
  - `y = p1.y + 18` (if dy > 0) or `p1.y - 18` (if dy < 0)
- **cp2**:
  - `x = p2.x - 9` (opposite perpendicular offset for symmetry)
  - `y = p2.y - 18` (opposite tangent offset)
- **Distance from endpoints**: `√(18² + 9²) ≈ 20.12px` (balanced)
- **Note**: Clearance calculation considers extended path to 4th elbow's x position (`destination.x`)

### Segment 4: verticalToTargetY → horizontalToInput (4th Elbow - Horizontal RIGHT)
- **Type**: Horizontal RIGHT
- **Elbow Type**: 4th elbow
- **dx**: positive (RIGHT)
- **dy**: 0 (horizontal)
- **perpendicularOffset**: `9px` (consistent minimal offset)
- **tangentOffset**: `18px` (fixed)
- **Offset Direction**: Based on segment direction (`dy > 0 ? 1 : -1`)
- **cp1**:
  - `x = p1.x + 18` (tangent offset RIGHT)
  - `y = p1.y + 9` (if dy > 0) or `p1.y - 9` (if dy < 0)
- **cp2**:
  - `x = p2.x - 18` (tangent offset opposite, toward p2)
  - `y = p2.y - 9` (opposite perpendicular offset for symmetry)
- **Distance from endpoints**: `√(18² + 9²) ≈ 20.12px` (balanced)

## Tangent Angle Calculations

For a cubic Bézier curve, the tangent direction at each endpoint is determined by the control point direction:

### At Start Point (p1)
- **Tangent direction**: from `p1` to `cp1`
- **Angle**: `atan2(cp1.y - p1.y, cp1.x - p1.x)` (in radians)
- **Formula**: `Math.atan2(cp1.y - p1.y, cp1.x - p1.x) * 180 / Math.PI` (in degrees)

### At End Point (p2)
- **Tangent direction**: from `cp2` to `p2`
- **Angle**: `atan2(p2.y - cp2.y, p2.x - cp2.x)` (in radians)
- **Formula**: `Math.atan2(p2.y - cp2.y, p2.x - cp2.x) * 180 / Math.PI` (in degrees)

### Example Calculations

#### Segment 2 (2nd Elbow - Horizontal LEFT)
Assuming:
- `p1 = {x: 500, y: 200}` (verticalOverreach)
- `p2 = {x: 300, y: 200}` (horizontalToTarget)
- `dy = 0` (horizontal segment, default direction)

**Control Points**:
- `cp1 = {x: 500 - 18 = 482, y: 200 + 9 = 209}` (tangent LEFT, perpendicular DOWN)
- `cp2 = {x: 300 + 18 = 318, y: 200 - 9 = 191}` (tangent RIGHT, perpendicular UP - opposite for symmetry)

**Tangent Angles**:
- At p1: `atan2(209 - 200, 482 - 500) = atan2(9, -18) ≈ 153.43°` (pointing LEFT and slightly DOWN)
- At p2: `atan2(200 - 191, 300 - 318) = atan2(9, -18) ≈ 153.43°` (pointing LEFT and slightly UP)

**Distance Check**:
- cp1 from p1: `√((482-500)² + (209-200)²) = √(324 + 81) = √405 ≈ 20.12px` ✓
- cp2 from p2: `√((318-300)² + (191-200)²) = √(324 + 81) = √405 ≈ 20.12px` ✓

#### Segment 3 (3rd Elbow - Vertical DOWN)
Assuming:
- `p1 = {x: 300, y: 200}` (horizontalToTarget)
- `p2 = {x: 300, y: 400}` (verticalToTargetY)
- `dx = 0` (vertical segment, default direction)
- `dy > 0` (going DOWN)

**Control Points**:
- `cp1 = {x: 300 + 9 = 309, y: 200 + 18 = 218}` (perpendicular RIGHT, tangent DOWN)
- `cp2 = {x: 300 - 9 = 291, y: 400 - 18 = 382}` (perpendicular LEFT - opposite, tangent UP - opposite)

**Tangent Angles**:
- At p1: `atan2(218 - 200, 309 - 300) = atan2(18, 9) ≈ 63.43°` (pointing DOWN and slightly RIGHT)
- At p2: `atan2(400 - 382, 300 - 291) = atan2(18, 9) ≈ 63.43°` (pointing DOWN and slightly RIGHT)

**Distance Check**:
- cp1 from p1: `√((309-300)² + (218-200)²) = √(81 + 324) = √405 ≈ 20.12px` ✓
- cp2 from p2: `√((291-300)² + (382-400)²) = √(81 + 324) = √405 ≈ 20.12px` ✓

## Key Observations

1. **Fixed Tangent Offset**: All elbows use `tangentOffset = 18px` (fixed), preventing overly large curves
2. **Consistent Perpendicular Offset**: 
   - **All elbows**: `9px` (0.3x radius) - **NO smoothness enhancement or overshoot**
   - Removed: Variable offsets (36px for 2nd/3rd, 24px for 4th)
   - All elbows now use minimal, consistent offsets
3. **Balanced Control Points**: 
   - cp1 and cp2 use **opposite perpendicular offsets** for symmetry
   - Both control points are at equal distance from their endpoints: `√(18² + 9²) ≈ 20.12px`
   - Creates uniform, balanced curves
4. **Simple Offset Direction**: 
   - Based on segment direction (dx/dy), not previous segment direction
   - Removed: Complex elbow-specific offset direction logic
5. **3rd Elbow Special Case**: Clearance calculation extends to 4th elbow's x position for accurate collision detection
6. **No Smoothness Enhancement**: All smoothness factors (1.2x, 0.8x) have been removed for consistent, minimal curves

## Visual Representation

```
Waypoint Flow (Backward Connection):
┌─────────┐
│ source  │───(0)──→ rightExtend
└─────────┘          │
                      │ (1)
                      ↓
              verticalOverreach
                      │
                      │ (2) ←─── 2nd elbow (horizontal LEFT)
                      ↓
              horizontalToTarget
                      │
                      │ (3) ←─── 3rd elbow (vertical)
                      ↓
              verticalToTargetY
                      │
                      │ (4) ───→ 4th elbow (horizontal RIGHT)
                      ↓
              horizontalToInput
                      │
                      ↓
              ┌─────────┐
              │destination│
              └─────────┘
```

## Control Point Positioning

For each segment, control points are positioned:
- **Along the segment direction** by `tangentOffset` (18px) - **fixed for all**
- **Perpendicular to the segment** by `perpendicularOffset` (9px) - **consistent for all**
- **Direction determined by** segment direction (dx/dy) - **simple, no special elbow handling**
- **Symmetry**: cp1 and cp2 use **opposite perpendicular offsets** for balanced curves
- **Total distance**: Both control points are at `√(18² + 9²) ≈ 20.12px` from their endpoints
