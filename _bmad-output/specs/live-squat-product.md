# Live coached squat — product amendment

Date: 2026-11-07; status reconciled2026-11-08 UTC against `d17cb2a`. Owner: product review (BMAD PM / John). Status: scoped demo implemented and final-Wren verified; remaining implementation and external acceptance are listed below. Requirements describe the intended product, not a blanket completion claim.

Latest correction: a stable stacked coaching feed, full-body region highlights and explicitly gated front/oblique squat experiments are now priorities. This supersedes any earlier assumption that a long AI paragraph is an acceptable live cue or that every non-side view must be discarded wholesale. It does not upgrade experimental projections or estimated 3D outputs into validated measurements. See the [current design behavior](../../docs/frontend-design-amendments.md) and [new implementation stories](epics.md#epic-3--stable-coaching-and-view-aware-squat-analysis).

## Product decision

MoveIDE helps a person see what changed in their squat, make one measurable adjustment, and try again without repeatedly uploading videos or constructing prompts. The primary action is **Start coached squat**. The primary loop is two reps → concise evidence-linked coaching cards → another attempt → comparison.

This amendment prioritizes squat playback, two-video comparison, and iPhone-to-MacBook live capture. Other movements and native OpenCap inference are deferred. Preserve completed Heavy analysis and OpenCap import work; they are not additional demo prerequisites. A model upgrade alone is not evidence of better angle accuracy.

The subscription replacement is the recurring *video form-review workflow*: capture, inspect, explain, and compare. Name an actual subscription the team uses before claiming it replaces that product, and describe only the capabilities demonstrated. Do not invent savings, clinical validation, or equivalent personal training.

## Existing evidence and boundaries

- The local harness uses MediaPipe Heavy, retains all 33 landmark slots, and can export normalized/world coordinates. Playback metrics are projected video-plane estimates; world coordinates do not establish calibrated clinical 3D accuracy.
- The clearer side-view demo has two manually timed reps. Timing checks and tracking coverage are evidence of temporal correctness, not independent joint-angle accuracy.
- `clear-squat.mp4` and `supported-squat.mp4` support two real recordings. Their source labels are dataset metadata, not MoveIDE validation. `sample-squat.mp4` is a difficult tracking case, and `front-view-challenge.mp4` is an unsupported-view case. Neither is a bad-posture example.
- Current report/packet behavior is defined in [AnalysisReport v1](shared/analysis-report-v1.md); existing story state is in [epics.md](epics.md). This document proposes changes and does not silently declare those stories complete.
- Integrated real AI playback and saved-note reload passed nine production checks on `f4a987a`; final Wren passed3/3 on that same frozen runtime. Real iPhone capture, venue networking and end-to-end latency still require device evidence. See [current checkpoint](../../qa/latest-local-checkpoint.json) and [final Wren results](../../qa/wren-final-results.json).

## One-button experience

The landing view has a large video region, one sentence of instruction, and **Start coached squat**. A compact source selector offers the paired phone, laptop camera, and demo. Settings and exports are secondary. The default source can be remembered, but permission to transmit images must not be inferred from a previous unrelated session.

One-time setup may require ChatGPT sign-in, phone pairing, and native camera permission. These cannot honestly be called zero-click. For a new phone, Start reveals a QR code and a short instruction; scanning opens an HTTPS sender page. That page has one **Use this camera** action to request the rear camera and begin streaming after permission. The laptop then advances automatically. The phone can stop transmission visibly at any time.

Beside Start, disclose the active mode: **Local tracking; selected rep measurements and up to four images sent to your connected AI coach after each completed rep. Full video stays local.** Starting this clearly disclosed session authorizes those bounded requests until Stop. If disconnected, label the action/mode as local tracking and offer sign-in during setup. Never present deterministic hints as an AI reply.

This is an intentional amendment to the existing per-packet preview contract: packet inspection belongs only in optional developer/debug tools; the normal product has no visible coaching handoff. Informed session-scoped Start authorizes automatic coaching. Implementers must update the shared contract and consent tests before enabling automatic dispatch. No background dispatch before Start, after Stop, or following a new source without renewing the session. The [frontend API amendment](../../docs/frontend-harness-amendments.md) specifies the concrete integration and observed gaps in merged PR #13.

| State | What the person sees | Automatic action / recovery |
| --- | --- | --- |
| Ready | Source, privacy disclosure, Start | No image transmission |
| Pairing | QR, waiting status, camera permission guidance | Advance when authenticated phone feed arrives |
| Framing | Full-body side-view guide; one specific correction | Begin rep tracking after reliable capture; never fabricate readiness |
| Tracking | Live picture, minimal skeleton, rep count, one active cue | Continuous local pose processing; bounded completed-rep requests |
| Coach pending | “Coach reviewing rep 2…”; local metrics remain live | At most one request in flight; no blocking spinner over video |
| Coach ready | One short observation with rep/time link | Cue binds to its source rep, not the current body position |
| Tracking lost | Gray cue and actionable framing guidance | Clear stale geometry and suspend positive/deviation judgments |
| Stopped | Session comparison and saved local evidence | Stop tracks, connection and pending work; discard late replies |

## What green and amber mean

Green means **a named, selected target was met in reliable observations**, not “your squat is universally good.” Amber means **a measured target was missed**, not injury, dangerous posture, or diagnosis. Gray means insufficient evidence, unsupported view, stale tracking, or a measurement not assessable in this phase. Always pair color with a label/icon so color is not the only signal.

The default full-body skeleton is quiet neutral/teal while tracking. Apply green or amber only to the cited body region, short angle arc, and single cue when that assessment is valid. Do not make an entire body green merely because landmarks were detected. Keep line weight thin, joint markers small, and text outside the body. Respect video letterboxing, rotation, and mirror transforms. For uploaded playback, use the existing 100 ms nearest-sample limit and leave gaps.

Phase matters: the standing knee angle cannot fail a bottom-depth target. Assess depth only at a confirmed rep bottom; assess total duration only after rep completion. During motion show phase and measured values. Front/oblique views may retain reliable full-body tracking and explicitly experimental projections, but cannot inherit side-view angle targets. Occluded joints and uncertain viewpoints withhold dependent judgments. Without calibrated independent reference, do not interpret low confidence as bad form.

## Stable coaching and expanded-view research contract

The coaching surface appends concise timestamped cards, approximately 12 words or fewer per action, to a reserved bounded feed; prior accepted cards persist through phase changes. Full rationale, measurements and uncertainty expand per card. Current local depth feedback uses150 ms dwell and5° release hysteresis; the separate view guard uses500 ms stability. Feed bounds are12 smoke cards and six live AI cards. Stable semantic event keys prevent jitter, seeks or replay from creating duplicates. Source/new-session reset clears history; Stop retains accepted cards but rejects late results. Tracking/view loss clears current geometry and metric validity while historical evidence remains labeled as such. Existing provider responses do not yet guarantee a structured short action: use supported local templates or a versioned response extension, not ungrounded paraphrase. Keep local feedback and AI explanation visibly distinct.

Expand capabilities by named view, not by one global “full-body accuracy” flag. Store anatomical side, coordinate system, view estimate/manual selection provenance, quality reason and baseline/goal version alongside every new metric. An image-plane frontal knee-path deviation is not a clinical valgus angle. Oblique measurements need their own projected definitions and reference tests. World-landmark outputs are experimental 3D estimates, not calibrated ground truth. Existing timing/formula checks do not establish independent 2D angle accuracy either.

Automatic calibration collects a stable starting stance or selected reference rep within the active session. It does not declare that baseline healthy/correct. Require stable camera/body identity, adequate visibility of each metric's landmarks, view stability, non-degenerate projected limb lengths and sufficient usable samples. Camera movement, view switching, new person or prolonged tracking loss invalidates the baseline. Calibration and threshold changes are versioned; raw trajectories remain unchanged.

The first frontal experiment measures a normalized image-plane knee-path change relative to the same person's stance/phase baseline and the observed hip–ankle reference line. Define the inward sign in a body-centered image basis, preserve left/right, and report projected units. Document how stance width, camera roll, perspective and occlusion can affect it. Do not ship a corrective knee verdict until annotated clips establish false-positive, missed-event and persistence behavior; until then show an explicitly experimental trend or capture guidance.

Whole-rep interpretation needs temporal evidence. Add bounded phase/trajectory summaries and source-tied descent/bottom/ascent/return references through a verified contract update. Keep at most four images per request and current live dispatch bounds; do not upload the entire video or claim that a pair of bottom images proves sequencing. Validate phase association, direction-of-change statements, missing intervals and image identity, including variable-rate clips and dropped live frames. Current source-timed playback remains local and continues while AI interprets selected evidence.

Any-angle reliable analysis is a research acceptance gate: obtain consented/lawful multi-view footage, independent 2D annotations and an appropriate 3D reference for 3D claims, multiple people/body proportions/camera distances, explicit occlusion/view strata, and prespecified error/coverage thresholds. Report failures by view and metric. No deadline or model choice can substitute for these measurements. Broad non-squat movements and native OpenCap inference remain deferred.

Use a disclosed person-selected goal or same-person reference rep for comparison. Examples are a chosen squat depth proxy or pacing target. Display metric definition, target, measured value, units, and evidence time. Numerical targets are exercise goals, not medical norms. Initial threshold/tolerance and smoothing policies must be versioned and tested; add hysteresis or sustained observations so noisy samples do not flicker. These policies must not change raw trace exports. A later AI reply cannot change deterministic measurement values.

For two real clips, analyze both with the same model/configuration and display them side by side with independent scrubbers plus **Compare rep bottoms**. Different people/cameras limit direct comparison. Do not quietly synchronize by file time when rep timings differ. A target-met versus target-missed showcase requires a reviewed pair with independently annotated observable differences. If no such pair exists, use the two current clips as **Compare two recordings**, not a staged good/bad verdict. A synthetic test or a preset target may demonstrate UI behavior only when labeled as such.

## Live capture and coaching requirements

Target setup: an iPhone rear camera and MacBook on the same Wi-Fi, with stable full-body side framing. Phone sender uses HTTPS: browser camera access requires a secure context and permission ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)). Same Wi-Fi does not guarantee connectivity on isolated venue networks. WebRTC uses separate signaling and ICE negotiation; TURN is a possible relay fallback, not an already-proven deployment capability ([WebRTC](https://webrtc.org/getting-started/peer-connections)).

- Use a short-lived, unguessable pairing capability and one sender/receiver session. Reject extra senders, stale sessions, wrong roles, and cross-session events. Expire unused rooms. Do not put account credentials in the QR/link.
- Expose only the minimum signaling/sender surface through HTTPS. Never expose the existing loopback ChatGPT/OAuth service to the LAN or a public tunnel. Keep provider credentials on the trusted laptop boundary.
- Laptop receives video and runs the shared pose pipeline locally in a worker. Heavy remains the stated default. Benchmark real live throughput; any explicit lower-cost live model option must show its identity and never be reported as Heavy.
- One outstanding inference job, newest-frame scheduling, bounded buffers, and dropped-frame telemetry prevent growing delay. A moving stream cannot promise every source frame is analyzed. Preserve actual analyzed timestamps and report achieved coverage/rate.
- Use monotonic per-session frame time, stable session/source IDs, and a separate wall-clock for transport diagnostics. Reconnect starts a new generation. A result from an old stream cannot paint over the new one.
- Timestamp alignment must refer to the frame the person sees. Do not render old skeleton geometry on a newer live frame. If an exactly associated frame cannot be presented, gate by a documented age limit and visibly mark loss. Measure transport, inference and display delay separately where possible.
- Provisional demo targets: at least 8 usable pose updates/second and camera-to-overlay p95 at or below 250 ms on the actual devices. These are product targets, not measured results or a reason to conceal failures. Tune only after the hardware test and document the measured operating envelope.
- AI interprets a bounded packet after a complete rep. Current live harness policy caps requests at six per session, waits at least eight seconds between dispatches, permits one in flight, and skips while busy with no queue. Local cues continue independently. The root recorded-video path sends one bounded request for up to two completed reps per report.
- Validate returned evidence IDs; accept only IDs in that request. Preserve source/session/rep binding. Display the AI cue at its evidence window during replay and keep earlier/later cues from appearing as current-frame diagnoses. Live replies show “About rep N” even if the next rep has begun.
- Stop, source replacement, disconnect, and logout cancel or invalidate pending requests. Failure keeps local video and metrics usable and states whether the coach is unavailable. Do not retry indefinitely or silently send more frames.

Optional hardware fallback: a supported iPhone can appear as a Mac webcam through Continuity Camera, with the same Apple Account, required device/OS versions and nearby Wi-Fi/Bluetooth; USB is also supported ([Apple](https://support.apple.com/en-au/102546)). Actual browser camera enumeration and full-body framing must be tested. This fallback is not proof of QR/WebRTC functionality.

## Prioritized stories and frontend handoff

The table below preserves requirements and acceptance criteria, not current completion labels. LIVE-1/3/6 are implemented with scoped browser/provider evidence; LIVE-4/5 have browser transport/analysis evidence but await physical-device acceptance; LIVE-7 final Wren is complete. LIVE-2 remains partial because cited-region accents are absent; LIVE-8 reviewed contrast footage is missing; LIVE-9 has scoped polish checks but broader device/accessibility review remains. See the [tracker](../../tracker.md) for exact evidence scopes.

| Priority / story | Required behavior | Acceptance evidence |
| --- | --- | --- |
| P0 LIVE-1 — one-button session | Explicit source + coaching disclosure; Start runs capture, local analysis and authorized automatic coaching; Stop ends all | One routine Start after setup; permission denial, disconnected coach and restart do not strand UI or send hidden requests |
| P0 LIVE-2 — honest overlays | Frame-bound geometry, phase-aware target states, gray unknown, accessible labels | Seek/pause/resize/mirror tests; low-confidence and stale frames clear green/amber; standing does not fail bottom target |
| P0 LIVE-3 — two recordings | Analyze two real fixtures; select corresponding reps and inspect evidence | Both report IDs remain isolated; each cue seeks correct clip; comparison does not call hard capture “bad posture” |
| P0 LIVE-4 — phone stream | HTTPS sender + pairing + WebRTC receiver + lifecycle | Real iPhone/Mac permission, stream, disconnect and reconnect proof; no OAuth surface publicly exposed |
| P0 LIVE-5 — continuous local analysis | Shared Heavy worker processes newest frames without growing backlog | Actual device rate, delay and memory measurements; dropped frames disclosed; stream/session timestamp tests |
| P0 LIVE-6 — automatic grounded coach | Completed-rep bounded packets; one in flight; evidence-linked replies | Real connected-provider result with image references; stale/invalid evidence responses rejected; Stop prevents later display/transmission |
| P0 LIVE-7 — final qualification | Local integrated QA, then final two Wren core workflows on exact build | Recorded build SHA, experiment/case verdicts and debit; rerun after relevant final changes |
| P1 LIVE-8 — reviewed contrast pair | Same-person, stable-camera clips differing on chosen observable goal | Clip permission/provenance, blinded annotations, hashes and measured outcome; no unreviewed “bad posture” asset |
| P1 LIVE-9 — polish and recovery | Stable minimal layout, onboarding, clear loss and network fallback | Physical device, narrow viewport, accessibility and venue rehearsals |

The latest detailed work is split into `UX-1`–`UX-3`, `VIEW-1`–`VIEW-6`, `TEMP-1` and `R-2` in [epic 3](epics.md#epic-3--stable-coaching-and-view-aware-squat-analysis). Immediate order: stable short cue/layout → setup and viewpoint gates → region highlighting → temporal evidence → calibrated frontal/oblique experiments → independent accuracy gate. A live demo must continue using supported metrics while research proceeds.

Minimum integration state: `sessionId`, `sourceId`, `generation`, `mode`, `phase`, selected goal and rule version; frame result with source timestamp, quality/reason, model identity and landmarks; completed rep with measurements/evidence; cue with origin (`local` or `ai`), assessment (`target_met`, `target_missed`, `unknown`), source/rep/evidence IDs, applicable media window, and explanation. Validate this shape at the shared boundary before making it a public schema. Preserve AnalysisReport v1 for recorded reports and use an additive session envelope rather than assigning fake file duration to live streams.

Implemented integration includes automatic session coaching, camera/phone switching, retained cards, two-source example comparison, lifecycle guards, bounded live scheduling, exact phase evidence and local history/replay. Remaining implementation includes FE-6 OpenCap import review, UX-3 cited-region accents, selectable goals/references, VIEW-2–5 automatic viewpoint/identity/filter/calibration behavior and stronger temporal-claim acceptance. Current live execution declares side view and a disclosed110° practice target; its continuity heuristic is not an automatic camera-angle estimator. Sequential exact-source decode and memory profiling remain BE-5 work. These gaps are distinct from missing physical-device and independent-accuracy evidence.

## Verification and release gate

1. Local tests cover report/packet contracts, session isolation, target phase logic, missing evidence, overlay alignment, lifecycle cleanup, queue bounds and stale responses. Use recorded or synthetic inputs with their origin labeled.
2. Browser integration covers two real local fixtures end to end and verifies measured values, replay seeking, coaching source/evidence labels and permission/network failures. Account-dependent interpretation requires a separate actual connected-provider check.
3. Physical iPhone + MacBook testing records device/OS/browser versions, camera orientation, network topology, model/configuration, throughput, latency method/results, disconnect/reconnect, background/lock behavior and at least a two-minute continuous run. Browser emulation is not a substitute. Repeat the network path on venue Wi-Fi.
4. Keep the existing Wren IDs `measure-squat` and `compare-and-handoff`, updating their journeys to the final UI. First proves Start/demo or recorded measurement through playback and evidence; second proves two-rep/recording comparison and automatic evidence-linked coaching as actually shipped. The historical second case ID is retained for continuity, not a requirement to expose manual handoff. Do not claim Wren verified a physical iPhone unless it truly did. A simulated media stream must be labeled simulated.
5. Final Seldon experiment `2151c1b9-ae1c-484e-bd25-327cbe64b283` passed all three workflows on frozen `f4a987a`, including both core cases after fixes. Reconciled allocation:16 granted,8 used,8 remaining. Keep the [ledger](../../qa/seldon-ledger.md), exact build manifest and case verdicts; a later runtime change needs affected checks and must not silently inherit these results. Hosted provider was disconnected; real account and physical phone checks remain separate.
6. Publish workflow/story status as implemented, locally verified, device verified, provider verified or final-Wren verified, with links to evidence. Keep unmeasured accuracy and untested hardware explicit. No claim of a perfect squat model.

Success for the demo means the viewer can see the body, understand one cue without reading JSON, inspect why it appeared, and make a second attempt. Originality comes from transparent evidence and a smooth capture-to-retry loop; usefulness comes from a repeatable adjustment; reliability comes from visible uncertainty and demonstrable final-build tests. These strengthen the judging case without guaranteeing an award.

Budget authority: [final saved report](../../qa/wren-final-results.json) and [ledger](../../qa/seldon-ledger.md) record8 simulations remaining with none pending. Check the live account before any future dispatch; this documentation reconciliation starts no runs.

## Continuous camera-orbit requirement

The desired product tracks the full visible person while the camera moves around them and continues only measurements/cues that remain supportable. This is an explicit user goal, not a claim of current arbitrary-angle accuracy. Full-body visibility does not resolve perspective, depth ambiguity or self-occlusion.

Required additions: automatic viewpoint and camera-motion change detection; stable person identity and anatomical sides; temporal filtering with measured maximum latency and reset rules; separate camera-relative projections versus experimental body-canonical 3D estimates; per-metric validity, baseline invalidation and reacquisition during yaw changes; and independent orbit-capture benchmarks. Maintain frame-bound geometry rather than attaching a prior skeleton to a new camera image. Retain accepted historical cards without treating them as current-frame assessments.

Moving-camera release depends on VIEW-4/5/6 and R-2: multiple real side/front/oblique/orbit recordings, independent reference annotations or calibrated 3D truth appropriate to the claim, prespecified error/coverage/latency thresholds, identity/swap audits and actionable-cue precision. A baseline from one yaw cannot be silently reused at another. Until these gates pass, label estimates experimental, abstain where invalid, and keep a supported-view path available without pretending it fulfills the whole orbit ambition.

### View-epoch versus source/session invalidation

A view-epoch change within the same active source/session clears current measurements, unfinished reps and relative baselines, but does not invalidate an immutable completed-rep image/measurement bundle. Let its in-flight AI request finish and append a card labeled with the original rep/view and source time. Do not apply that historical response to current geometry. Stop, new source/session or revoked authorization still aborts or invalidates pending work.

## Latest implementation evidence

Root retained short cards and expandable evidence pass fifteen controlled-provider development checks. Live per-metric validity, experimental view epochs, adaptive video-size reacquisition and sparse three-phase evidence are integrated and pass combined real-Heavy browser QA (five controlled-provider requests), plus twenty-three focused motion/live/phase tests. Historical completed-rep AI survives view changes with its original view/time label; current measurements/baselines reset. Real WebRTC feedback and QR cleanup pass locally. Seven representative-card layout checks pass at1400/1280 desktop and390 mobile widths. These scoped browser results are supplemented by public real-provider return and final Wren3/3 on `f4a987a`. They do not close physical iPhone or independent angle/orbit accuracy. Automatic viewpoint/identity/reference behavior remains partial implementation; do not describe orbit as fully built but merely untested.

Current automated checkpoint:110 harness tests and eight launcher/doctor tests pass (118 total). The suite ran on the integration worktree before a final copy-only saving reminder;15 production lifecycle checks subsequently passed on `f4a987a`. Nine real-provider checks include History/reload preservation. [Exact evidence scope](../../qa/latest-local-checkpoint.json). Older86+4 and99+6 counts are historical, not the current checkpoint.
