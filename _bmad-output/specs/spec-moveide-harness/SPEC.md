---
id: SPEC-moveide-harness
companions:
  - harness.md
  - ../shared/analysis-report-v1.md
sources:
  - ../../../moveide-hackathon-kickoff.txt
---

# MoveIDE motion and coaching harness

## Why

MoveIDE needs inspectable measurements independent of an AI account. A local motion protocol produces evidence from a squat clip. An optional provider can explain that evidence with the user’s own eligible plan.

## Capabilities

- **CAP-1**
  - **Intent**
    Produce timestamped pose data and one estimated knee flexion measurement from a real clip.
  - **Success**
    A supported clip yields a valid AnalysisReport with a usable measurement whose evidence frame contains the same-side hip, knee, and ankle. Occluded joints yield an unavailable value.
- **CAP-2**
  - **Intent**
    Identify complete squat reps and prepare report-backed comparisons.
  - **Success**
    A hand-labeled clip yields the expected rep count, and bottom timestamps satisfy the fixture tolerance. A selected pair produces a CoachPacket with only allowed data and valid evidence references.
- **CAP-3**
  - **Intent**
    Connect an eligible ChatGPT plan and request interpretation on demand.
  - **Success**
    A live local sign-in grants the plan scope and completes a Responses request with selected measurements, text context, and timestamped source images on an image-capable model. Denial, ineligibility, or failure leaves local measurement and copy available.
- **CAP-4**
  - **Intent**
    Return an explanation that the workbench can trace to the clip.
  - **Success**
    Every displayed observation references measurement or source-frame IDs from the requested packet. Invalid references produce a recoverable coaching error and leave the report intact.

## Constraints

- The motion engine runs on the laptop and emits AnalysisReport v1. The provider accepts CoachPacket v1 plus the selected source images.
- The first protocol supports one visible lifter, a stationary side view, and screen-plane angles. Missing evidence remains explicit.
- Treat native plan sign-in as a parallel first-hour spike. Keep OAuth credentials in the local service and proceed with the copy flow if the spike stalls.
- Two core journeys must run through Wren on the final submission build. Live authenticated inference is verified separately on the demo laptop.

## Non-goals

- Clinical interpretation, forces or joint moments, 3D reconstruction, gait, fine-tuning, full-clip inference through ChatGPT plan usage, and cloud-hosted auth.

## Success signal

The real clip yields a schema-valid report and a verifiable knee angle. The final build completes the labeled measurement and compare-and-copy journeys with the native ChatGPT outcome reported separately.

## Assumptions

- Use the named MediaPipe Full v1 model for the first spike. Treat an unavailable result as a supported outcome for poor framing.
- Use a provisional 150 ms bottom-frame tolerance on the golden fixture, declared before model runs.

## Open questions

- Which eligible ChatGPT test account and Wren access route are available for the final build?
