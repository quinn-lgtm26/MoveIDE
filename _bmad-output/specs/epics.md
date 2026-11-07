# MoveIDE implementation backlog

Two implementation tracks. The frontend owns the workbench. The backend owns MediaPipe, the squat protocol, and the coaching harness. Start FE-1, BE-1, and the timeboxed BE-3 spike in parallel. The first join is FE-2 with BE-1 on a real clip.

Contracts · [Frontend spec](spec-moveide-frontend/SPEC.md) · [Backend and harness spec](spec-moveide-harness/SPEC.md) · [AnalysisReport v1](shared/analysis-report-v1.md)

## Epic 1 · Frontend workbench

### FE-1 · Open and play a clip

**As a lifter**, I can open a local clip and see whether MoveIDE can analyze it.

- Given a supported file or the built-in sample action, the video plays and shows progress and ready states. The built-in clip uses the same processing path as import.
- Given a file the browser cannot decode, I get an actionable error and can choose another clip.
- Choosing a new clip removes stale results and releases the old video resources.

Depends on the shared contract. Covers frontend CAP-1.

### FE-2 · See one angle on a real squat

**As a coach**, I can see the skeleton and the measured knee angle on the frame they came from.

- The overlay tracks a real clip across playback, pause, seeking, and resize, including letterboxing.
- Selecting a usable knee measurement opens its source timestamp and displays its degrees. A missing or unreliable frame shows an unavailable state.
- The first demo uses real BE-1 output. The synthetic report is only for building the UI.

Depends on FE-1 and BE-1. Covers frontend CAP-2.

### FE-3 · Compare and hand off two reps

**As a lifter**, I can compare two reps and take the evidence into my AI tool.

- Selecting a new pair updates knee flexion, duration, and evidence. I can navigate to the source frame for either rep.
- The preview shows the selected measurements, short summary, and timestamped source images. I can export the local report, copy the Magna Carta and packet, and download those images for manual attachment.
- The preview and copy flow work with the provider disconnected. A missing image is reported without suppressing the local comparison.

Depends on FE-2 and BE-2. Covers frontend CAP-3 and the manual portion of CAP-4.

### FE-4 · Connect and request an explanation

**As a lifter with an eligible plan**, I can connect ChatGPT and request guidance on the evidence I reviewed.

- I can see connection state, preview the outbound packet and images, and explicitly request interpretation.
- Valid observations point back to source evidence. Cancel, denied scopes, ineligible models, and provider failure preserve the report and copy path.
- A result from a previously selected clip or rep pair cannot appear in the new view.

Depends on FE-3 and BE-4. Covers frontend CAP-4. Ship only if the live connector is verified.

### FE-5 · Review the rep through video, trace, and coaching cues

**As a coach**, I can inspect the movement from start to return and seek from an observation to its evidence.

- Show the analyzed sample cadence, knee-flexion and projected torso-lean traces, and the selected reps’ start, bottom, and return. Compare equivalent phases with each rep’s source timestamp and duration. Keyboard stepping, slow playback, and phase controls use source timestamps.
- Playback remains usable while coaching runs. A validated observation opens its approved measurement or image timestamp and synchronized overlay. A clip or selection change invalidates old cues. Low-confidence samples and coverage gaps stay visible as unavailable.
- Run browser QA on the real combined build. Exercise frame and evidence jumps, slow playback, play/pause, rapid seeks, resize, portrait letterboxing, and clip replacement. Compare both rep-bottom overlays with their source evidence and verify no stale overlay crosses a gap.

Depends on FE-2, FE-3, and BE-2. Connected observation playback also depends on FE-4. Covers frontend CAP-2 and CAP-4. [Measurement and review methodology](spec-moveide-harness/squat-methodology.md)

## Epic 2 · Backend motion and coaching harness

### BE-1 · Produce a real MediaPipe report

**As a coach**, I can trust that the first displayed measurement came from an actual video frame.

- Use the bundled CC BY 4.0 sample and its two visually labeled reps. Use the other side views and the front-view challenge to inspect generalization and capture guidance.
- The worker yields increasing frame times and 33-slot landmark sets. The actual clip yields one usable estimated knee flexion value and evidence frame that validate against AnalysisReport v1.
- Verify the formula with straight and right-angle fixtures. A missing or low-visibility joint yields an unavailable measure. Processing stays local.

Depends on the shared contract. Covers backend CAP-1. Unlocks the first real-clip demo with FE-2.

### BE-2 · Segment reps and assemble the coaching evidence

**As a coach**, I can compare equivalent points in two reps and share precisely the evidence I reviewed.

- The golden clip matches the hand-labeled count. Bottom timestamps fall within the declared 150 ms tolerance. Inspect the front-view challenge for capture guidance or an unavailable value when the required landmarks are unreliable.
- Compute knee flexion at the bottom and rep duration. Keep measurement IDs, rep IDs, and evidence timestamps consistent.
- Assemble the selected numeric data, report summary, and timestamped, unannotated JPEG frames. The packet has no full clip, full landmark trace, or credentials.

Depends on BE-1. Covers backend CAP-2 and supplies FE-3.

### BE-3 · Prove ChatGPT plan sign-in

**As a lifter with an eligible plan**, I can connect my account through OpenAI’s supported local flow.

- Start this first-hour spike in parallel with BE-1 and FE-1. An eligible account grants the plan scope and completes a request with one authorized source image and test measurements.
- Credentials remain in the local service. The UI receives connection state. Record successful, denied, or unavailable outcomes without logging tokens.
- If live sign-in is still blocked at the cutoff, make the manual handoff the demo path. Measurement and rep work proceed independently.

Depends on an eligible test account and a permitted sample image. Covers backend CAP-3.

### BE-4 · Interpret the report under the Magna Carta

**As a coach**, I can review an AI explanation with traceable evidence.

- Send the user-approved packet, timestamped source images, and versioned Magna Carta through the provider interface.
- Validate that each observation refers to submitted measurements or frames and report uncertainty and a suggested next focus. Reject malformed responses or unknown evidence IDs.
- Keep the first implementation bounded to the submitted packet. Optional read-only lookup tools belong behind the same interface after the core demo works.

Depends on BE-2 and a successful BE-3. Covers backend CAP-4. The manual packet remains independently usable.

### BE-5 · Verify source-frame coverage and repeated squat measurements

**As a coach**, I can tell which source frames were analyzed and compare the same phases from like-for-like footage.

- Report the 15 Hz baseline analysis cadence, decoded presentation timestamps, measured angles, phase durations, and tracking coverage. Keep raw geometry and phase smoothing distinguishable. Preserve evidence frame identity when seeking or capturing JPEGs.
- Evaluate an optional sequential source-frame decoder on local high-frame-rate, variable-rate, rotated, and interrupted inputs. Compare analyzed presentation timestamps with independently decoded source frames. Report skipped or unsupported frames and keep cancellation responsive. An exact mode earns its label by accounting for every presentation frame on the supported formats.
- Validate 2D knee flexion and trunk lean against independently annotated frames with measured annotator agreement. Report per-metric absolute error, bias, coverage, timing error, and repeated-capture differences separately. Confirm the supported clip remains within ±150 ms per labeled bottom and the hard/front fixtures surface unavailable states where evidence fails.
- Compare pinned MediaPipe Full v1 and Heavy v1 against the same frames and labels. Include a clearer redistributable side view, preserve attribution, and measure coverage, timing, runtime, memory, and angle agreement. Keep the current default until the benchmark and Heavy asset terms support a change.

Depends on BE-1 and BE-2. Covers backend CAP-1 and CAP-2. [Measurement and review methodology](spec-moveide-harness/squat-methodology.md)

**BE-5 status — partial.** The clearer fixture, Full/Heavy benchmark, projected metrics, and phase trace are delivered. The independent ffprobe audit accounts for 57/57 clear-demo and 90/90 supported-regression source timestamps against hashed saved reports. Its negative tests distinguish subsampling from complete coverage and refuse ambiguous time origins or rotation. Sequential exact decode on high/variable-rate and rotated inputs, independently annotated angle errors and annotator agreement, repeated captures, and memory profiling remain open. [Reproducible timeline audit](../../harness/verify/source-timeline.mjs)

## Optional research

### R-1 · Benchmark OpenCap Monocular as a 3D comparator

**As a maintainer**, I can evaluate the accuracy and practicality of a separate 3D path before changing the default harness.

- Use approved footage with paired side and approximately 45° anterolateral views where possible. Compare on synchronized rep events and name each reference and coordinate system. Measure 2D evidence against planar annotations and 3D kinematics against appropriate motion-capture references.
- Record per-joint errors, rep timing, coverage, runtime, hardware, capture effort, and data handling. Review the pinned source, models, dependencies and dataset terms. Reconcile the preprint and repository license discrepancy before any product integration.
- Deliver a short decision memo with reproducible commands, evidence and conditions for follow-on work. The shipped local side-view harness keeps its own QA gate.

Depends on the BE-2 baseline and suitable approved recordings. [OpenCap research and licensing notes](spec-moveide-harness/squat-methodology.md#verification-and-opencap-research)

## Shared final-build gate

[Seldon baseline](../../seldon.yml) · [16-simulation ledger](../../qa/seldon-ledger.md) · [Fixtures and labels](../../fixtures/squat/README.md)

- **Seldon measure-squat.** Open the built-in sample and select the first complete rep’s knee-flexion measurement. Verify its evidence frame, skeleton, and angle in degrees. Check count and timing tolerance locally before spending simulations.
- **Seldon compare-and-handoff.** Select the first and second complete reps. Verify their IDs, measurements, and timestamped frames in the coaching preview without account credentials.
- The hosted harness smoke used two simulations and passed both cases. Hold the remaining 14 until the final integrated product is ready. The ledger separates the harness verdicts from the final product gate.
- Validate the baseline and smoke-test locally. Reconcile the 16-simulation allocation and keep at least four reserved for the final build and a rerun. Run both cases against the final submission build after fixes. Record the build ID, experiment ID, actual debit, both verdicts, and summary. Keep a separate local result for live ChatGPT sign-in and image-plus-report interpretation.
