---
id: SPEC-movement-charter
companions:
  - charter-principles.md
  - skill-protocols.md
  - ../shared/analysis-report-v1.md
  - ../spec-moveide-harness/squat-methodology.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate.

# Movement Charter and skill protocols

> **Status: deferred.** Do not dispatch these stories until the hackathon's final Seldon QA is complete.

## Why

Vision. MoveIDE aims to be a workbench for human movement, but the engine only understands one side-view squat. Each new skill (push-up, free throw, volleyball spike) would currently need its own hand-coded analyzer. A Charter of shared biomechanics principles, skill protocols written as data, and a per-person body profile let new skills ship as data, judged against the person's own proportions. This work starts after the hackathon. The squat-only hackathon build and Seldon baseline stay unchanged.

## Capabilities

- **CAP-1**
  - **intent:** The interpreting model and the user can read a versioned Charter of universal movement principles. Each principle names the video measurement that stands in for it.
  - **success:** Every metric in every enabled protocol cites exactly one Charter principle by ID. The CoachPacket `charterVersion` resolves to a published Charter file.
- **CAP-2**
  - **intent:** A contributor can add a skill by writing one protocol file. The file declares camera view, minimum frame rate, required landmarks, phases and events, metrics, and each metric's principle.
  - **success:** The push-up ships with a protocol file and a labeled fixture and no new engine code. Its rep count and bottom timestamps fall within the declared tolerance.
- **CAP-3**
  - **intent:** Protocols compose from a shared library of event detectors and metric building blocks instead of skill-specific code.
  - **success:** Every building block has a unit check against synthetic landmarks. The free throw ships using only shared building blocks, at most adding new general-purpose ones, with no free-throw-specific branches.
- **CAP-4**
  - **intent:** The system estimates a person's segment lengths from the clip and reports measurements that don't depend on body size. Interpretation can then account for differences in height and limb proportions.
  - **success:** Two fixtures of different people doing the same skill produce body profiles with distinct femur:tibia and arm:height ratios. Metrics that measure distance are expressed relative to a segment length. The profile appears in the report and the packet.
- **CAP-5**
  - **intent:** A user can analyze a clip of a movement that has no protocol and still get a pose and angle timeline, interpreted under the Charter alone.
  - **success:** An unmatched clip yields a schema-valid report with angle series and no phases. Coaching observations still cite frame IDs.
- **CAP-6**
  - **intent:** A clip that misses a protocol's view or frame-rate requirement reports its metrics as unavailable instead of guessing.
  - **success:** A 30fps clip on a protocol requiring 60fps or more marks the affected metrics unavailable with a stated reason. Metrics that don't depend on frame rate still compute.

## Constraints

- Force is never measured. Only motion proxies for it are reported, which keeps the existing non-goal on forces and joint moments.
- Missing evidence stays explicit, and every observation cites measurement or frame IDs.
- The engine stays monocular 2D MediaPipe in the browser. Angles are estimates in the flat video image.
- The center of mass is estimated from 2D landmarks using published segment mass fractions (de Leva) and is labeled an estimate.
- Comparisons use the person's own baseline first. Population norms come second.
- The extracted squat protocol must reproduce the current squat report on the golden fixture within the existing 150 ms tolerance.
- No protocol is enabled without at least one labeled fixture and a tolerance declared before the model runs.
- Protocol files are YAML, validated against a JSON Schema.
- AnalysisReport v1 gains optional fields for skill ID, phases, and body profile. Existing squat reports stay valid. Move to v2 only if a field must change meaning.
- Every Charter principle and its video proxy cites a peer-reviewed source. Quinn approves each Charter version before it is published.
- Ball release is timed from peak wrist speed. Ball tracking is not built.

## Non-goals

- Measured forces, joint moments, clinical interpretation, gait, and fine-tuning.
- Tracking more than one person in a clip, and team sports.
- Ball tracking and metrics that need the ball, such as release angle and arc.
- Shipping the volleyball spike before frame rates of 120fps or more and 3D reconstruction are validated.
- Changing the hackathon squat build, its Seldon cases, or the 16-simulation budget.

## Success signal

- The push-up is added with zero engine code. The free throw is added using only shared building blocks. The golden squat fixture's report is unchanged after the extraction.

## Assumptions

- Population norms stay optional (confirmed by Quinn). Comparisons use the personal baseline only until a licensed dataset is found.
- The feasibility tiers and roadmap in `skill-protocols.md` reflect the capture limits of a phone with a single 2D camera.
