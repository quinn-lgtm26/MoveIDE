---
id: SPEC-moveide-frontend
companions:
  - workbench.md
  - ../shared/analysis-report-v1.md
  - ../../../AI.md
  - ../../../fixtures/squat/README.md
sources:
  - ../../../moveide-hackathon-kickoff.txt
---

# MoveIDE frontend

## Why

Coaches and athletes need to see a movement measurement in the original footage. MoveIDE gives them a free, local workbench for opening a phone clip and inspecting its evidence. The Seldon demo uses one side-view squat.

## Capabilities

- **CAP-1**
  - **Intent**
    Open a local phone clip and see its processing state.
  - **Success**
    A supported local clip or the built-in sample plays and reaches a ready state. An undecodable clip shows a recovery action and leaves the importer usable.
- **CAP-2**
  - **Intent**
    Inspect a synchronized pose overlay and estimated knee angle.
  - **Success**
    Playback, pause, seek, and resize keep the overlay on the intended frame. Selecting a usable measurement seeks to its evidence. A low-quality frame displays an unavailable state.
- **CAP-3**
  - **Intent**
    Compare two reps and export or copy their analysis.
  - **Success**
    Selecting a different pair changes the visible knee flexion and rep duration comparison. The coaching packet contains the selected rep IDs and their evidence references.
- **CAP-4**
  - **Intent**
    Use an optional connected AI explanation or a manual handoff.
  - **Success**
    The user can preview the report and source images, then request a grounded explanation from a connected account. A disconnected, ineligible, or failed connection still allows report export and the copy flow.

## Constraints

- The free local flow works without an account. The source clip stays in the browser. On explicit submission, ChatGPT receives the selected measurements, text context, and the source frames shown in the preview.
- Use the shared AnalysisReport v1 contract for fixtures and real inference. Video and overlay share a timestamp and displayed content rectangle.
- Support the bundled stationary side-view squat sample and show estimated 2D measurements with units and quality. Both Seldon cases can open the sample from the workbench.

## Non-goals

- Gait, 3D motion, clinical scoring, hosted video storage, and automatic coaching actions.

## Success signal

A teammate can open a real squat clip, scrub a synchronized skeleton, inspect one knee angle at its source frame, and use the compare-and-copy workflow on the final build.

## Assumptions

- Chrome on the demo laptop and an H.264 MP4 are the first compatibility target.
- Knee flexion is the first angle. Rep duration is included in comparison. Torso lean can follow after the core demo is stable.
