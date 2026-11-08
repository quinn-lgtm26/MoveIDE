# MoveIDE implementation backlog

Two implementation tracks. The frontend owns the workbench. The backend owns MediaPipe, the squat protocol, and the coaching harness. Start FE-1, BE-1, and the timeboxed BE-3 spike in parallel. The first join is FE-2 with BE-1 on a real clip.

Contracts · [Frontend spec](spec-moveide-frontend/SPEC.md) · [Backend and harness spec](spec-moveide-harness/SPEC.md) · [AnalysisReport v1](shared/analysis-report-v1.md)

**Current scope amendment (2026-11-07):** the normal experience is one Start with automatic bounded coaching, a stable stack of concise timestamped cues and optional per-card explanation. Historical manual-preview story criteria below are superseded by [AI amendments](../../AI-AMENDMENTS.md) and the [current design contract](../../docs/frontend-design-amendments.md). Epic 3 records the latest user-requested full-body/view-aware work; implementation or published design is not independent accuracy validation.

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

**BE-5 status — partial.** The clearer fixture, Full/Heavy benchmark, projected metrics, and phase trace are delivered. The independent ffprobe audit accounts for 57/57 clear-demo and 90/90 supported-regression source timestamps against hashed saved reports. Its negative tests distinguish subsampling from complete coverage and refuse ambiguous time origins or rotation. Sampled decoder QA now passes generated 30 Hz, 7 Hz, variable-rate and rotated inputs with independent timestamp and pixel checks. Sequential exact decode, independently annotated angle errors and annotator agreement, repeated captures, and memory profiling remain open. [Reproducible timeline audit](../../harness/verify/source-timeline.mjs)

## Extended single-video analysis

The user selected Heavy as the default and requested OpenCap alongside MediaPipe. Heavy's seven-fixture run and both labeled timing checks pass without changing the 150 ms tolerance. Full remains an explicit preset and its historical artifacts are retained. These stories extend the initial side-view protocol while keeping separate coordinate systems and verification states.

### BE-6 · Retain complete sampled MediaPipe outputs

**As an analyst**, I can export each analyzed timestamp's full model outputs and inspect their provenance.

- `onPoseFrame` returns 33-slot normalized x/y/z and world x/y/z arrays, nullable visibility/presence, model ID/version, and the same decoded timestamp as AnalysisReport.
- Missing points remain null. A consumer changing callback data cannot modify the report. Model-estimated world coordinates are labeled with their hip-centered origin and meters; they are not treated as calibrated biomechanical joint coordinates.
- Download the raw trace locally. Keep it outside CoachPacket and optional inference requests. Verify real browser export timestamps, finite coordinates, model provenance, and privacy boundaries.

**Status — verified in the harness.** Unit tests and the Heavy built-browser export check pass. Frontend exposes this optional export through the shared API.

### BE-7 · Import source-bound OpenCap kinematics

**As an analyst**, I can inspect separately produced OpenCap results alongside the source video.

- Verify source-video, motion-text, and scaled-model SHA-256 hashes plus pinned engine revision. Require explicit source frame index and original-video timestamp per motion row.
- Preserve named OpenSim coordinates and signs. Convert declared rotational radians to degrees while preserving translations in meters. Reject malformed data and unsupported units. Do not execute referenced model code.
- Expose missing source intervals and an `imported-unverified` state. Hash binding and producer-declared mapping cannot establish model accuracy or prove row alignment.

**Status — importer verified with constructed fixtures.** Nine tests and a Chrome File/import smoke pass with no external requests. Actual OpenCap inference and real-capture accuracy remain unverified. [API and runtime gate](../../harness/opencap/README.md)

### FE-6 · Review one video with two analysis tracks

**As an analyst**, I can replay one video while inspecting the MediaPipe trace and an optional OpenCap trace.

- Keep a single presented-video clock and active source identity. Present model, coordinate system, units, and verification status per track. Clear traces and coaching cues when the clip changes.
- Import OpenCap through the typed adapter. Show unavailable rows across tracker gaps. Preserve MediaPipe analysis when the optional import fails.
- Label native OpenCap inference unavailable until a configured runtime passes its gate. Do not present a fabricated 3D skeleton or subtract incomparable projected and OpenSim angles.
- Keep video, sample stepping, and evidence navigation usable while a reviewed coaching request runs. Explain which submitted measurements and images support each cue. Keep OpenCap data outside the current MediaPipe CoachPacket v1 until a separate interpretation contract is verified.

**Status — frontend amendment published, integration pending.** [Frontend handoff](../../harness/FRONTEND-HANDOFF.md)

## OpenCap inference and research gate

The user confirmed that no compatible GPU runtime/assets are available and selected local Heavy plus OpenCap import as the current delivery. Native inference is deferred. R-1 records the prerequisites for resuming it and is not reported as completed inference.

### R-1 · Benchmark OpenCap Monocular as a 3D comparator

**As a maintainer**, I can evaluate the accuracy and practicality of a separate 3D path before changing the default harness.

- Use approved footage with paired side and approximately 45° anterolateral views where possible. Compare on synchronized rep events and name each reference and coordinate system. Measure 2D evidence against planar annotations and 3D kinematics against appropriate motion-capture references.
- Record per-joint errors, rep timing, coverage, runtime, hardware, capture effort, and data handling. Review the pinned source, models, dependencies and dataset terms. Reconcile the preprint and repository license discrepancy before any product integration.
- Deliver a short decision memo with reproducible commands, evidence and conditions for follow-on work. The shipped local side-view harness keeps its own QA gate.

Depends on the BE-2 baseline and suitable approved recordings. [OpenCap research and licensing notes](spec-moveide-harness/squat-methodology.md#verification-and-opencap-research)

## Epic 3 · Stable coaching and view-aware squat analysis

The user explicitly rejected flickering walls of text and requested a coherent setup/phone/session flow, actionable real-time coaching, whole-body context, and front/oblique knee-path analysis. Ship the stable supported-view experience first, while the expanded-view experiments acquire evidence. Stories below remain specified/acceptance pending except for these scoped increments: smoke stacked playback passed its controlled-provider verifier; live retained two distinct cards through Stop/reset in local-camera browser QA; full-body overlay passed five tests; standalone view guard passed eight tests; experimental multiview passed six tests and actual Heavy confidence compatibility. Root retained feed now passes fifteen controlled-provider development checks. Integrated live validity/epoch/phase wiring passes twenty-three focused tests and combined real-Heavy browser QA, including dynamic resize, historical/fresh-view cards and real WebRTC return. Public real-provider returned-AI rerun passes; physical iPhone and independent accuracy remain. See [tracker](../../tracker.md) for exact surfaces and gates.

### UX-1 · Stack concise coaching cards without moving the player

**As a person squatting**, I see actionable cues arrive one after another and retain earlier observations instead of watching them disappear.

- Append timestamped concise cards to a reserved scrollable feed. Aim for 12 words/action and one body region. Highlight the newest card; per-card Why expands full reasoning and uncertainty.
- Deduplicate semantic events across frames, seeks and replay. Proposed local-candidate persistence is 500 ms; validated completed-rep AI appends once. Use the actual bounded retention (12 smoke cards; six live AI cards), with an explicit cap policy; prior cards survive phase changes and loss as historical evidence.
- Preserve scroll/focus when reading older cards, and offer New coaching rather than forcing scroll. Never move the player or controls. Source/new session resets history; Stop retains accepted cards but rejects late replies. Tracking/view loss invalidates current geometry, not the recorded history.
- **Acceptance:** three cues remain after phase changes; replay/seek adds no duplicate or inference; threshold jitter adds no repeated semantic card; events beyond the configured bound respect that cap. Test delayed AI about a prior rep, Stop, loss, source reset, narrow viewport, reduced motion, focus retention and 200% text zoom. No text clipping or layout jump.

Depends on the existing local feedback and coaching-segment APIs. This supersedes the earlier exclusive-current-cue/2-second-hold design. Presentation timing does not establish biomechanical correctness.

### UX-2 · Finish the one-Start setup and phone journey

**As a returning person**, I start my remembered source once and get video, local measures and connected coaching automatically.

- Setup owns source, camera/account availability and goal/reference; Start owns session orchestration. Phone pairing offers a private local-generated QR and accessible link, expiry, rear-camera permission and automatic laptop continuation when the stream arrives.
- Keep native phone Start camera/permission honest. Hide network environment variables and ports in developer setup details; expose plain recovery steps in the product.
- **Acceptance:** first-time permission/account flow and returning session both complete without packet controls. Phone denial, expired link, disconnected peer, unsupported HTTPS and Stop each have one clear recovery action. Physical iPhone/Mac behavior is verified separately from browser simulation. QR creation must not send the private link to a third party.

Depends on phone transport and the existing session controller. A design or QR alone is not a completed phone feature.

### UX-3 · Highlight only the supported body region

**As a person reviewing a rep**, I can see which joint chain the current cue refers to without reading technical output.

- Retain a quiet full-body skeleton; accent only the cited visible joint chain/region. Use text/icon plus green target-met, amber selected-goal miss, or gray unavailable semantics.
- Anatomical left/right survives mirroring/rotation and source replacement. Missing/occluded joints remove the dependent accent rather than drawing guessed connectors.
- **Acceptance:** supported knee/torso cues highlight the expected points on letterboxed, mirrored and resized video; invalid IDs, missing points, stale poses and source changes show no residual accent. A full-body landmark set does not automatically color the whole body green.

Depends on UX-1 and VIEW-1. Frontend uses the shared measurement/overlay coordinates, not private angle formulas.

### VIEW-1 · Expose a viewpoint-specific capability and quality gate

**As a person changing camera angle**, I see what can be measured in this view and what cannot.

- Distinguish supported side-view projected features, experimental frontal features, experimental oblique features and optional estimated 3D inspection. Do not apply side-view targets to a different view.
- Every new metric carries view/coordinate/side provenance, quality reason and required landmarks. Require view stability, body identity, visibility/presence where available, adequate projected limb length and sensible camera framing; unavailable is not zero.
- Retain reliable whole-body tracking even when one measurement is unsupported. Explain a corrective camera action in the short cue.
- **Acceptance:** front, side, oblique, changing-view, cropped-feet and unilateral-occlusion cases enable only their declared capabilities. A view change immediately clears view-dependent baselines, metrics and judgments. Tracker confidence is never displayed as angle accuracy.

Depends on BE-6. Current side-view fixture checks are retained; new views require named fixtures and annotations.

### VIEW-2 · Establish a stable person/view reference automatically

**As a person starting a session**, I get a reference that fits this camera and my selected goal without a calibration wizard.

- Collect a stable starting stance or explicitly selected reference rep inside the active session. Show a brief hold-still instruction only while needed. Record source, view, metric definition, baseline interval, goal and policy version.
- Baseline means reference, not correct posture. Never silently adapt it while giving a correction. Invalidate on camera movement, view/person change or prolonged evidence loss.
- **Acceptance:** jitter alone cannot repeatedly reset a valid reference; occlusion/insufficient usable frames cannot produce a fabricated baseline. A new camera angle cannot reuse old projection values. No new external inference call is required for local calibration.

Depends on VIEW-1. Stability windows and normalization choices must be recorded and tested before use.

### VIEW-3 · Evaluate frontal and oblique knee-path projections

**As a person reviewing a front-view squat**, I can inspect whether the observed knee path changes relative to my selected camera-view reference.

- Define and document a normalized image-plane knee-path change relative to the person's phase/stance baseline and observed hip–ankle line. Use a body-centered inward sign and stable anatomical sides. Name it a projection, not a clinical valgus angle.
- Require the relevant hip/knee/ankle/foot landmarks, non-degenerate geometry, stable view, usable baseline and persistent observations. Handle stance-width and camera-roll changes explicitly. Give oblique measurements separate definitions/gates; never copy a side/front cutoff without evidence.
- Until validation passes, label the trend experimental and withhold a confident good/bad posture verdict or corrective instruction based only on it.
- **Acceptance:** consented, independently annotated front/oblique recordings include lateral movement, stance changes, mirrors, rotation, occlusion and stable controls. Measure event precision/recall, false cues, usable coverage and temporal persistence per view. Define threshold/error targets before selecting a winning configuration. Synthetic geometry tests verify formula/sign only, not real accuracy.

Depends on VIEW-1, VIEW-2 and UX-3. Native OpenCap is not a prerequisite or a substitute for these annotations.

### TEMP-1 · Ground coaching in the relevant movement phase

**Increment status:** bounded `buildLiveCoachBundle` / `selectPhaseEvidence` is implemented with four focused tests. It preserves v1 and original report immutability while selecting exact cached phase samples. Live cache integration and public real-provider three-image interpretation pass (qa/phone-https.json). Full temporal-claim acceptance remains pending.

**As a person replaying a squat**, I see the observation where it happened, with enough evidence to explain movement rather than a bottom still alone.

- Preserve local source-timed trajectories and phase intervals. A bottom-depth claim can use bottom evidence; direction, pacing, sequencing and knee-path claims require source-bound temporal measurements/excerpts.
- Extend the evidence contract deliberately for bounded descent/bottom/ascent/return references. Maintain at most four exact source images/request and the current live one-in-flight, ≥8-second, six-call/session policy. Do not claim full-video upload or interpretation.
- Bind the short action, full rationale, body region and phase interval to validated submitted evidence IDs. Missing intervals produce explicit uncertainty, not interpolation presented as observed motion.
- **Acceptance:** correct and reversed synthetic sequences distinguish direction; real replay cues seek to their cited phase; variable-rate clips and dropped live frames retain timestamp/image identity. A bottom-only bundle cannot yield an accepted unsupported sequencing claim. A delayed reply cannot replace another source/rep's current cue.

Depends on BE-2, BE-4, BE-6 and the shared contract; add a versioned response/packet extension if the existing schema cannot express the evidence.

### R-2 · Establish independent accuracy limits across views

**As a maintainer**, I publish what each view and coordinate representation can actually support.

- Use independent 2D annotations for image-plane measurements and appropriate calibrated 3D references for 3D claims. Include multiple people/body proportions, view angles, distances, camera heights, lighting and occlusion strata.
- Predeclare acceptable per-metric error, event detection, repeatability and usable-coverage thresholds. Report failures and abstentions, not just aggregate means or the best clip. Compare pinned model/configuration versions on the same held-out sources.
- Label MediaPipe world coordinates experimental 3D estimates until their claimed use is validated. Current independent joint-angle error is unmeasured, including the side view; timing agreement is not angle validation.
- **Acceptance:** reproducible dataset/provenance, independent annotator procedure/agreement, test split, per-view results and explicit supported operating envelope. Arbitrary-angle reliable accuracy is not a completed feature without these results.

Research gate; does not block shipping the truthful supported-view demo. Broad non-squat movement support and native OpenCap execution remain deferred.

### VIEW-4 · Keep person and landmarks stable during camera movement

**As a person being filmed**, I can remain the tracked subject as the camera moves around me.

- Estimate viewpoint/camera-motion changes continuously; maintain person identity and anatomical left/right rather than selecting a new nearest pose every frame. Detect identity interruption, swaps, timestamp gaps and implausible segment jumps.
- Use bounded temporal filters with explicitly measured maximum added latency; reset when identity, view evidence or time continuity fails. Retain raw landmarks and filter/version provenance for audit.
- **Acceptance:** real orbit/translation/roll clips with bystanders and occlusion report identity swaps, left/right swaps, landmark jitter/drift, filter lag and recovery time. One person's trajectory must not be joined to another's. Visible whole body alone cannot bypass uncertainty gates.

Depends on BE-6 and VIEW-1. Status: the image-continuity heuristic and live metric-validity integration pass focused and real-Heavy browser tests. This does not establish camera-motion estimation, identity robustness or orbit accuracy.

### VIEW-5 · Reacquire metric validity and baselines throughout an orbit

**As the camera changes angle**, I see only measurements valid for the current view and know when they are reacquiring.

- Separate camera-relative projected values from experimental body-canonical 3D estimates; document canonical-frame construction and its uncertainty. MediaPipe world coordinates alone are not validation of that construction.
- Invalidate view-dependent baselines/targets across yaw changes; reacquire each metric independently using its landmark, view and calibration gates. Do not keep stale side-view values while the camera faces front.
- Keep historical coaching cards, but clear current invalid geometry/values and show a concise reacquisition status. Completed-rep evidence already captured in this same source/session remains valid across view epochs: retain its in-flight AI and label the eventual card with the original rep/view. Stop/new source/session still rejects pending results. A newly valid cue is an event in the existing feed, not an instruction to restart capture manually.
- **Acceptance:** continuous side→oblique→front→oblique sequences with partial occlusion show correct per-metric availability transitions, no stale baselines and bounded reacquisition time. Return-to-start repeatability and coordinate-frame consistency are measured, not assumed.

Depends on VIEW-2/4. Status: epoch/baseline invalidation, adaptive-resolution recovery and historical completed-rep AI retention are browser-verified; continuous physical orbit validity and accuracy remain unverified.

### VIEW-6 · Validate actionable coaching during real camera orbit

**As a person using a moving camera**, I get trustworthy short observations about what the evidence supports throughout the squat.

- Benchmark real fixed-side, fixed-front, fixed-oblique and continuous-orbit captures against independent truth appropriate to each projected/3D claim. Include camera heights/distances, motion speeds, people and visibility conditions.
- Predeclare acceptable metric error, usable coverage, identity/swap rates, end-to-end delay, recovery time and false/missed cue rates. Test sustained events, intermittent occlusion and camera-induced apparent motion as negatives.
- **Acceptance:** reproduce per-view/orbit results and publish the supported operating envelope. A view transition cannot create a false knee-path correction caused only by camera movement. No arbitrary-angle reliable-accuracy claim before this and R-2 pass. Synthetic and fixed-camera tests remain necessary but insufficient.

Depends on UX-1/3, VIEW-3/4/5, TEMP-1 and R-2. Full-body visibility is necessary for some features, not sufficient proof of accuracy.

### Implementation order and design review status

P0: UX-1 → UX-2 and VIEW-1 in parallel → UX-3. P1: TEMP-1 and VIEW-2 → VIEW-3, while VIEW-4/5 develop the moving-camera path; VIEW-6 and R-2 govern any later accuracy/any-angle release claim. Coordinate the frontend and harness through the shared contracts; no new measurement should appear without view/quality semantics.

The [reviewed design amendment](../../docs/frontend-design-amendments.md) covers setup, desktop/mobile composition, phone pairing, short stable cues, region highlighting, error states, accessibility and reduced motion. This was a headless specification review against the supplied user direction and inspected APIs; it is not rendered UI approval or proof of finished implementation. Implementation evidence is tracked separately.

## Shared final-build gate

[Seldon baseline](../../seldon.yml) · [16-simulation ledger](../../qa/seldon-ledger.md) · [Fixtures and labels](../../fixtures/squat/README.md)

- **Seldon measure-squat.** Use Start coached squat on the built-in sample and select the first complete rep’s knee-flexion measurement. Verify its evidence frame, skeleton, and angle in degrees. Check count and timing tolerance locally before spending simulations.
- **Seldon compare-and-handoff.** Preserve this historical case ID but update its journey to automatic session coaching and evidence comparison. Verify selected rep/source identities, measurements and evidence navigation; connected coaching must cite the correct source, while disconnected mode stays explicitly local. Manual packet copy is not a required normal step. Final baseline selectors must match the integrated UI.
- The hosted harness smoke used two simulations and passed both cases; a later frontend-key run is tracked separately and is not visible under the current key. The current account confirms 16 granted, two used and 14 remaining before final dispatch. The user now authorized final Seldon product QA; baseline/run preparation is in progress and final verdicts remain pending. The ledger separates historical verdicts from the final product gate.
- Validate the baseline and smoke-test locally. Reconcile the 16-simulation allocation and keep at least four reserved for the final build and a rerun. Run both cases against the final submission build after fixes. Record the build ID, experiment ID, actual debit, both verdicts, and summary. Keep a separate local result for live ChatGPT sign-in and image-plus-report interpretation.

## COMP-1 · Compare two independent recordings

**Implemented; browser acceptance tracked in tracker.md.** One Compare examples action analyzes the two attributed fixtures with the same selected Heavy/Full model, records distinct SHA-256 source identities, defaults to the first complete rep per recording and navigates corresponding start/bottom/return phases on independent media clocks. Show three primary metrics and expandable detail. Shared `compareRecordings` gates differences by source binding, protocol/model compatibility and measurement availability. New source/model or Cancel aborts stale work. No AI request on comparison or seeking; no invented good/bad labels. The older two-reps comparison remains.

[Complete UX/API/acceptance amendment](../../docs/two-recording-comparison-amendment.md). Real cross-source AI comparison, user-selected dual upload and anatomical accuracy are separate future acceptance gates, not implied by these local examples.

## Epic 4 · Local session history and usable recordings

User confirmed local storage for this demo on2026-11-07. [HISTORY.md](../../docs/HISTORY.md) supplies HIST-1 recorded durability, HIST-2 usable list/review/download/delete, HIST-3 live recording, HIST-4 lifecycle/failures and HIST-5 bounded integrity/retention acceptance. Store original video, source-bound measurements, accepted coaching and bounded evidence locally; reopening never triggers new inference. Phone-session history lives on the Mac receiver. Implemented and locally browser-verified: [22 history journeys](../../qa/history-root.json), [six lifecycle/recovery checks](../../qa/history-races.json), [10 storage groups](../../harness/history/browser-verification.json), real Chrome MediaRecorder playback and live save-failure downloads. HIST-1–5 pass this scoped local acceptance; physical iPhone recording/background and real storage-pressure tests remain separate. Cross-device sync is excluded by the user’s local-only choice.

### DEV-1 · Reproducible setup and AI handoff

Deliver README quickstart, Claude/Codex copy-paste prompts, developer architecture/contracts/check matrix, contributor instructions, and a read-only setup doctor. Setup installs locked dependencies and verified model assets; phone mode exposes only the dedicated4176 sender/signaling surface. Acceptance: doctor diagnoses missing/corrupt assets without mutation; existing occupied demo ports are preserved; fresh setup/build proof and clear physical-device/account handoff remain linked.

DEV-1 status: **local setup/build acceptance passed** on fresh `efe97bd`; [evidence](../../qa/fresh-setup-history.json) records absent initial dependencies/models/dist, automatic pinned setup, TypeScript/Vite build and final doctor. Existing demo ports were untouched; their health result is not a runtime test of the fresh build. Final Wren and physical account/device handoff remain pending.
