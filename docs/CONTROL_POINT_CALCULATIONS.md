# Control Point and Tangent Angle Calculations

## Constants
- `ELBOW_CURVE_RADIUS = 30` (px)
- `ELBOW_SMOOTHNESS = 0.3`
- `tangentOffset = fixedRadius * 0.6 = 30 * 0.6 = 18` (px) - **FIXED for all elbows**

## Waypoint Structure (Backward Connections)
```
0: source → rightExtend (horizontal RIGHT)
1: rightExtend → verticalOverreach (vertical UP/DOWN)
2: verticalOverreach → horizontalToTarget (horizontal LEFT) - **2nd elbow**
3: horizontalToTarget → verticalToTargetY (vertical) - **3rd elbow**
4: verticalToTargetY → horizontalToInput (horizontal RIGHT) - **4th elbow**
```

## Control Point Calculations Table

| Segment | Type | Elbow | p1 | p2 | Direction | smoothnessFactor | perpendicularOffset | tangentOffset | cp1 Calculation | cp2 Calculation | Tangent Angle (cp1→p1) | Tangent Angle (cp2→p2) |
|---------|------|-------|----|----|-----------|-------------------|---------------------|---------------|-----------------|-----------------|------------------------|------------------------|
| **0** | Horizontal | - | `source` | `rightExtend` | RIGHT | `ELBOW_SMOOTHNESS = 0.3` | `30 * 0.3 = 9` | `18` | `x: p1.x + 18`<br>`y: p1.y ± 9` | `x: p2.x - 18`<br>`y: p2.y ± 9` | `≈ 0°` (near horizontal) | `≈ 0°` (near horizontal) |
| **1** | Vertical | - | `rightExtend` | `verticalOverreach` | UP/DOWN | `ELBOW_SMOOTHNESS = 0.3` | `30 * 0.3 = 9` | `18` | `x: p1.x ± 9`<br>`y: p1.y + 18` (down) or `-18` (up) | `x: p2.x ± 9`<br>`y: p2.y - 18` (down) or `+18` (up) | `≈ 90°` (near vertical) | `≈ 90°` (near vertical) |
| **2** | Horizontal | **2nd** | `verticalOverreach` | `horizontalToTarget` | LEFT | `1.2` | `30 * 1.2 = 36` | `18` | `x: p1.x - 18`<br>`y: p1.y + yOffset`<br>`yOffset = prevDy > 0 ? 36 : -36` | `x: p2.x + 18`<br>`y: p2.y + yOffset` | `≈ 116°` (LEFT + offset) | `≈ -116°` (LEFT + offset) |
| **3** | Vertical | **3rd** | `horizontalToTarget` | `verticalToTargetY` | UP/DOWN | `1.2` | `30 * 1.2 = 36` | `18` | `x: p1.x + xOffset`<br>`xOffset = prevDx < 0 ? 36 : -36`<br>`y: p1.y + 18` (down) or `-18` (up) | `x: p2.x + xOffset`<br>`y: p2.y - 18` (down) or `+18` (up) | `≈ 27°` (DOWN + offset) | `≈ 153°` (DOWN + offset) |
| **4** | Horizontal | **4th** | `verticalToTargetY` | `horizontalToInput` | RIGHT | `0.8` | `30 * 0.8 = 24` | `18` | `x: p1.x + 18`<br>`y: p1.y + yOffset`<br>`yOffset = prevDy > 0 ? 24 : -24` | `x: p2.x - 18`<br>`y: p2.y + yOffset` | `≈ 0°` (near horizontal) | `≈ 0°` (near horizontal) |

### Quick Reference Summary

| Segment | Elbow | tangentOffset | perpendicularOffset | Offset Direction Based On |
|---------|-------|---------------|-------------------|---------------------------|
| 0 | - | 18px | 9px | Segment direction (dy) |
| 1 | - | 18px | 9px | Previous segment or default |
| 2 | **2nd** | 18px | **36px** | Previous vertical direction (prevDy) |
| 3 | **3rd** | 18px | **36px** | Previous horizontal direction (prevDx) |
| 4 | **4th** | 18px | **24px** | Previous vertical direction (prevDy) |

## Detailed Calculations by Elbow

### Segment 0: source → rightExtend (Horizontal RIGHT)
- **Type**: Horizontal
- **dx**: positive (RIGHT)
- **dy**: 0 (horizontal)
- **cp1**: 
  - `x = p1.x + 18` (tangent offset along direction)
  - `y = p1.y ± 9` (perpendicular offset, direction based on dy)
- **cp2**:
  - `x = p2.x - 18` (tangent offset opposite direction)
  - `y = p2.y ± 9` (same perpendicular offset as cp1)
- **Tangent at p1**: `0°` (horizontal, pointing RIGHT)
- **Tangent at p2**: `0°` (horizontal, pointing RIGHT)

### Segment 1: rightExtend → verticalOverreach (Vertical)
- **Type**: Vertical
- **dx**: 0 (vertical)
- **dy**: positive (DOWN) or negative (UP)
- **cp1**:
  - `x = p1.x ± 9` (perpendicular offset, direction based on dx or prevSegment)
  - `y = p1.y + 18` (if dy > 0) or `p1.y - 18` (if dy < 0)
- **cp2**:
  - `x = p2.x ± 9` (same perpendicular offset as cp1)
  - `y = p2.y - 18` (if dy > 0) or `p2.y + 18` (if dy < 0)
- **Tangent at p1**: `90°` (vertical, pointing DOWN) or `-90°` (UP)
- **Tangent at p2**: `90°` (vertical, pointing DOWN) or `-90°` (UP)

### Segment 2: verticalOverreach → horizontalToTarget (2nd Elbow - Horizontal LEFT)
- **Type**: Horizontal LEFT
- **Elbow Type**: 2nd elbow
- **dx**: negative (LEFT)
- **dy**: 0 (horizontal)
- **smoothnessFactor**: `1.2` (enhanced smoothness)
- **perpendicularOffset**: `30 * 1.2 = 36`
- **tangentOffset**: `18` (fixed)
- **yOffset Calculation**:
  - If `prevSegment` exists (segment 1):
    - `prevDy = prevSegment.end.y - prevSegment.start.y`
    - `yOffset = prevDy > 0 ? 36 : -36`
  - Otherwise: `yOffset = dy > 0 ? 36 : -36` (default)
- **cp1**:
  - `x = p1.x - 18` (tangent offset LEFT)
  - `y = p1.y + yOffset` (perpendicular offset based on previous vertical direction)
- **cp2**:
  - `x = p2.x + 18` (tangent offset opposite, toward p2)
  - `y = p2.y + yOffset` (same perpendicular offset)
- **Tangent at p1**: `180°` (horizontal, pointing LEFT)
- **Tangent at p2**: `180°` (horizontal, pointing LEFT)

### Segment 3: horizontalToTarget → verticalToTargetY (3rd Elbow - Vertical)
- **Type**: Vertical
- **Elbow Type**: 3rd elbow
- **dx**: 0 (vertical)
- **dy**: positive (DOWN) or negative (UP)
- **smoothnessFactor**: `1.2` (enhanced smoothness)
- **perpendicularOffset**: `30 * 1.2 = 36`
- **tangentOffset**: `18` (fixed)
- **xOffset Calculation**:
  - If `prevSegment` exists (segment 2):
    - `prevDx = prevSegment.end.x - prevSegment.start.x`
    - `xOffset = prevDx < 0 ? 36 : -36` (opposite to horizontal direction)
  - Otherwise: `xOffset = dx > 0 ? 36 : -36` (default)
- **cp1**:
  - `x = p1.x + xOffset` (perpendicular offset based on previous horizontal direction)
  - `y = p1.y + 18` (if dy > 0) or `p1.y - 18` (if dy < 0)
- **cp2**:
  - `x = p2.x + xOffset` (same perpendicular offset)
  - `y = p2.y - 18` (if dy > 0) or `p2.y + 18` (if dy < 0)
- **Tangent at p1**: `90°` (vertical, pointing DOWN) or `-90°` (UP)
- **Tangent at p2**: `90°` (vertical, pointing DOWN) or `-90°` (UP)
- **Note**: Clearance calculation considers extended path to 4th elbow's x position (`destination.x`)

### Segment 4: verticalToTargetY → horizontalToInput (4th Elbow - Horizontal RIGHT)
- **Type**: Horizontal RIGHT
- **Elbow Type**: 4th elbow
- **dx**: positive (RIGHT)
- **dy**: 0 (horizontal)
- **smoothnessFactor**: `0.8` (reduced smoothness)
- **perpendicularOffset**: `30 * 0.8 = 24`
- **tangentOffset**: `18` (fixed)
- **yOffset Calculation**:
  - If `prevSegment` exists (segment 3):
    - `prevDy = prevSegment.end.y - prevSegment.start.y`
    - `yOffset = prevDy > 0 ? 24 : -24`
  - Otherwise: `yOffset = dy > 0 ? 24 : -24` (default)
- **cp1**:
  - `x = p1.x + 18` (tangent offset RIGHT)
  - `y = p1.y + yOffset` (perpendicular offset based on previous vertical direction)
- **cp2**:
  - `x = p2.x - 18` (tangent offset opposite, toward p2)
  - `y = p2.y + yOffset` (same perpendicular offset)
- **Tangent at p1**: `0°` (horizontal, pointing RIGHT)
- **Tangent at p2**: `0°` (horizontal, pointing RIGHT)

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
- `prevDy = 100` (previous segment went DOWN)
- `yOffset = 36` (positive)

**Control Points**:
- `cp1 = {x: 500 - 18 = 482, y: 200 + 36 = 236}`
- `cp2 = {x: 300 + 18 = 318, y: 200 + 36 = 236}`

**Tangent Angles**:
- At p1: `atan2(236 - 200, 482 - 500) = atan2(36, -18) ≈ 116.57°` (pointing LEFT and slightly DOWN)
- At p2: `atan2(200 - 236, 300 - 318) = atan2(-36, -18) ≈ -116.57°` (pointing LEFT and slightly UP)

#### Segment 3 (3rd Elbow - Vertical DOWN)
Assuming:
- `p1 = {x: 300, y: 200}` (horizontalToTarget)
- `p2 = {x: 300, y: 400}` (verticalToTargetY)
- `prevDx = -200` (previous segment went LEFT)
- `xOffset = 36` (positive, opposite to LEFT)

**Control Points**:
- `cp1 = {x: 300 + 36 = 336, y: 200 + 18 = 218}`
- `cp2 = {x: 300 + 36 = 336, y: 400 - 18 = 382}`

**Tangent Angles**:
- At p1: `atan2(218 - 200, 336 - 300) = atan2(18, 36) ≈ 26.57°` (pointing DOWN and slightly RIGHT)
- At p2: `atan2(400 - 382, 300 - 336) = atan2(18, -36) ≈ 153.43°` (pointing DOWN and slightly LEFT)

## Key Observations

1. **Fixed Tangent Offset**: All elbows use `tangentOffset = 18px` (fixed), preventing overly large curves
2. **Variable Perpendicular Offset**: 
   - 2nd & 3rd elbows: `36px` (1.2x radius) for enhanced smoothness
   - 4th elbow: `24px` (0.8x radius) for reduced smoothness
   - Others: `9px` (0.3x radius) standard
3. **Tangent Angles**: 
   - Not exactly 0° or 90° due to perpendicular offsets
   - Angles depend on both tangent and perpendicular offsets
   - Creates smooth, rounded transitions at elbows
4. **Perpendicular Offsets**: Based on previous segment direction to create smooth transitions
5. **3rd Elbow Special Case**: Clearance calculation extends to 4th elbow's x position for accurate collision detection

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
- **Along the segment direction** by `tangentOffset` (18px)
- **Perpendicular to the segment** by `perpendicularOffset` (varies by elbow type)
- **Direction determined by** previous segment's movement direction for smooth transitions
