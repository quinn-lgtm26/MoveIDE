# Live coached squat — product amendment

Date: 2026-11-07. Owner: product review (BMAD PM / John). Status: implementation handoff; acceptance is not yet verified.

## Product decision

MoveIDE helps a person see what changed in their squat, make one measurable adjustment, and try again without repeatedly uploading videos or constructing prompts. The primary action is **Start coached squat**. The primary loop is two reps → one evidence-linked coaching focus → another attempt → comparison.

This amendment prioritizes squat playback, two-video comparison, and iPhone-to-MacBook live capture. Other movements and native OpenCap inference are deferred. Preserve completed Heavy analysis and OpenCap import work; they are not additional demo prerequisites. A model upgrade alone is not evidence of better angle accuracy.

The subscription replacement is the recurring *video form-review workflow*: capture, inspect, explain, and compare. Name an actual subscription the team uses before claiming it replaces that product, and describe only the capabilities demonstrated. Do not invent savings, clinical validation, or equivalent personal training.

## Existing evidence and boundaries

- The local harness uses MediaPipe Heavy, retains all 33 landmark slots, and can export normalized/world coordinates. Playback metrics are projected video-plane estimates; world coordinates do not establish calibrated clinical 3D accuracy.
- The clearer side-view demo has two manually timed reps. Timing checks and tracking coverage are evidence of temporal correctness, not independent joint-angle accuracy.
- `clear-squat.mp4` and `supported-squat.mp4` support two real recordings. Their source labels are dataset metadata, not MoveIDE validation. `sample-squat.mp4` is a difficult tracking case, and `front-view-challenge.mp4` is an unsupported-view case. Neither is a bad-posture example.
- Current report/packet behavior is defined in [AnalysisReport v1](shared/analysis-report-v1.md); existing story state is in [epics.md](epics.md). This document proposes changes and does not silently declare those stories complete.
- Real iPhone capture, venue networking, end-to-end latency, final integrated AI playback, and final-build Wren reruns still require recorded verification.

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

The default skeleton is quiet neutral/teal while tracking. Apply green or amber to the relevant leg segment, short angle arc, and single cue only when that assessment is valid. Do not make an entire body green merely because landmarks were detected. Keep line weight thin, joint markers small, and text outside the body. Respect video letterboxing, rotation, and mirror transforms. For uploaded playback, use the existing 100 ms nearest-sample limit and leave gaps.

Phase matters: the standing knee angle cannot fail a bottom-depth target. Assess depth only at a confirmed rep bottom; assess total duration only after rep completion. During motion show phase and measured values. In frontal/occluded views show capture guidance rather than side-view angle judgments. Without calibrated independent reference, do not interpret low confidence as bad form.

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

All new story statuses below are **proposed / acceptance pending**. These IDs supplement existing stories. Frontend owners should consume this amendment alongside the shared contract; suggested events below are interface requirements, not claims of existing exports.

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

Minimum integration state: `sessionId`, `sourceId`, `generation`, `mode`, `phase`, selected goal and rule version; frame result with source timestamp, quality/reason, model identity and landmarks; completed rep with measurements/evidence; cue with origin (`local` or `ai`), assessment (`target_met`, `target_missed`, `unknown`), source/rep/evidence IDs, applicable media window, and explanation. Validate this shape at the shared boundary before making it a public schema. Preserve AnalysisReport v1 for recorded reports and use an additive session envelope rather than assigning fake file duration to live streams.

Frontend amendments required: single CTA orchestration; session setup UI; receiver/camera source switching; cue overlay and target legend; transcript/evidence timeline; two-source comparison; pending/offline/unknown states; visible model label; consent/lifecycle hooks. Harness amendments required: incremental stream adapter; bounded scheduling; phase-aware deterministic assessment; automatic packet policy and response validation; diagnostic timing; recorded replay of the same session results. A live feature is not complete merely because its amendment is pushed.

## Verification and release gate

1. Local tests cover report/packet contracts, session isolation, target phase logic, missing evidence, overlay alignment, lifecycle cleanup, queue bounds and stale responses. Use recorded or synthetic inputs with their origin labeled.
2. Browser integration covers two real local fixtures end to end and verifies measured values, replay seeking, coaching source/evidence labels and permission/network failures. Account-dependent interpretation requires a separate actual connected-provider check.
3. Physical iPhone + MacBook testing records device/OS/browser versions, camera orientation, network topology, model/configuration, throughput, latency method/results, disconnect/reconnect, background/lock behavior and at least a two-minute continuous run. Browser emulation is not a substitute. Repeat the network path on venue Wi-Fi.
4. Keep the existing Wren IDs `measure-squat` and `compare-and-handoff`, updating their journeys to the final UI. First proves Start/demo or recorded measurement through playback and evidence; second proves two-rep/recording comparison and automatic evidence-linked coaching as actually shipped. The historical second case ID is retained for continuity, not a requirement to expose manual handoff. Do not claim Wren verified a physical iPhone unless it truly did. A simulated media stream must be labeled simulated.
5. Seldon is held until the integrated build is ready: allocation 16, prior smoke usage 2, remaining 14 pending debit reconciliation. Preserve at least four for final two workflows plus a rerun. Validate configuration and local paths before paid dispatch. Record exact final build SHA, run/experiment ID, both verdicts, summary and actual debit. A prior smoke run cannot qualify a changed final build.
6. Publish workflow/story status as implemented, locally verified, device verified, provider verified or final-Wren verified, with links to evidence. Keep unmeasured accuracy and untested hardware explicit. No claim of a perfect squat model.

Success for the demo means the viewer can see the body, understand one cue without reading JSON, inspect why it appeared, and make a second attempt. Originality comes from transparent evidence and a smooth capture-to-retry loop; usefulness comes from a repeatable adjustment; reliability comes from visible uncertainty and demonstrable final-build tests. These strengthen the judging case without guaranteeing an award.

Budget reconciliation amendment: the latest merged frontend ledger records an additional workbench run with debit pending.14 was the last confirmed balance;13 is expected if that run debited one. Check the account before any final dispatch. No new runs were started for this increment.
