# Skill protocols

## Protocol file fields

Each protocol is a YAML file, validated against a JSON Schema.

| Field | Content |
|---|---|
| `id`, `version` | Stable skill ID and protocol version, carried in the report |
| `view` | `side`, `front`, or `anterolateral-45` |
| `minFps` | Below this, metrics that depend on frame rate are unavailable (CAP-6) |
| `landmarks` | Required MediaPipe landmarks; same-side selection rule |
| `phases` | Ordered phases, each bounded by events from the building-block library |
| `metrics` | Each metric: building block, inputs, unit, how it's normalized, Charter principle ID |
| `fixture` | Labeled clip path and tolerance declared before the model runs |

## Building-block library

**Event detectors**

- Lowest or highest point of a joint angle
- Moment the center of mass stops moving vertically
- Ground contact gained or lost, from ankle speed
- Ball release, from peak wrist speed

**Metric building blocks**

- Joint angle
- Segment angle to vertical
- Angular velocity
- Time gap between two segments' peaks
- Center of mass displacement relative to a segment length
- Variation from rep to rep

## Body profile

- Segment lengths come from a standing frame, or from each segment's longest length across the clip. Using the longest length offsets apparent shortening when a segment turns away from the camera.
- Stored ratios: femur:tibia, torso:height, arm span:height.
- Distance metrics are divided by a named segment length. Angles are already unaffected by body size.

## Feasibility tiers

| Skill | Tier | Limits |
|---|---|---|
| Squat | Easy | Side view, repetitive, stays in one plane; already built |
| Push-up | Easy | Side view, repetitive, stays in one plane |
| Free throw | Workable | Side view, 60fps or more, ball untracked; release taken from peak wrist speed |
| Volleyball spike | Hard | Airborne, fast arm swing, rotates out of plane; needs 120–240fps and likely 3D (OpenCap) |

## Roadmap

1. Turn the squat logic into a protocol, the building-block library, and the body profile, keeping the golden fixture's report unchanged.
2. Add the push-up with no new engine code.
3. Add the free throw using shared building blocks only.
4. Add the spike after high frame-rate capture and 3D are validated.

Rejected, simpler alternative: a separate methodology doc and hand-coded analyzer per skill. It's faster for a second skill, but every skill after that needs new code.
