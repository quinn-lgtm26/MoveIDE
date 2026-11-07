# MoveIDE implementation backlog

Two implementation tracks. The frontend owns the workbench. The backend owns MediaPipe, the squat protocol, and the coaching harness. Start FE-1, BE-1, and the timeboxed BE-3 spike in parallel. The first join is FE-2 with BE-1 on a real clip.

Contracts · [Frontend spec](spec-moveide-frontend/SPEC.md) · [Backend and harness spec](spec-moveide-harness/SPEC.md) · [AnalysisReport v1](shared/analysis-report-v1.md)

## Epic 1 · Frontend workbench

### FE-1 · Open and play a clip

**As a lifter**, I can open a local clip and see whether MoveIDE can analyze it.

- Given a supported file, the video plays and shows progress and ready states using the shared sample report.
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

## Epic 2 · Backend motion and coaching harness

### BE-1 · Produce a real MediaPipe report

**As a coach**, I can trust that the first displayed measurement came from an actual video frame.

- Obtain a consented, stationary side-view clip with at least two complete reps and clearly visible near-side joints. Hand-label rep count and bottoms before running inference. Prepare one bad-framing example.
- The worker yields increasing frame times and 33-slot landmark sets. The actual clip yields one usable estimated knee flexion value and evidence frame that validate against AnalysisReport v1.
- Verify the formula with straight and right-angle fixtures. A missing or low-visibility joint yields an unavailable measure. Processing stays local.

Depends on the shared contract. Covers backend CAP-1. Unlocks the first real-clip demo with FE-2.

### BE-2 · Segment reps and assemble the coaching evidence

**As a coach**, I can compare equivalent points in two reps and share precisely the evidence I reviewed.

- The golden clip matches the hand-labeled count. Bottom timestamps fall within the declared 150 ms tolerance. The bad-framing case reports unavailable data.
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

## Shared final-build gate

- **Wren 1 · Measure.** Open the hand-labeled clip, verify rep count and degree units, and click a measurement to reach its expected source frame. Check the bottom tolerance against the labels.
- **Wren 2 · Compare and hand off.** Select two reps, verify the values update, then verify the packet and the source-frame preview reference that exact pair. The journey runs without account credentials.
- Run both on the final submission build. Fix and rerun both after changes. Keep a separate smoke result for live ChatGPT sign-in and image-plus-report interpretation when available.
