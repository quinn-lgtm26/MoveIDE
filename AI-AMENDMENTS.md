# AI integration amendments — one coached session

This is the current implementation direction for every frontend agent. It supersedes earlier normal-flow requirements to preview/copy a coaching handoff or separately press Generate. Track delivery in [tracker.md](tracker.md).

## Required behavior

**Start coached squat** is the single normal action. After one-time account/camera setup, the app automatically runs local motion analysis, builds bounded timestamped evidence, applies the shared coaching principles through the provider, and renders validated AI feedback beside the video. Internal stages are asynchronous; they are not separate user tasks. The full video remains local. Clearly disclose that selected source JPEGs and measurements go to the connected model using the user’s plan.

Use the existing `harness/coaching` and `harness/provider` APIs. The shared provider already supplies the Magna Carta principles, structured response schema and citation validation. Do not duplicate prompt logic or replace report measurements with generated numbers. See the [API-by-API frontend amendment](docs/frontend-harness-amendments.md).

## Recorded video

1. Start calls shared `analyzeSquat` with Heavy and a cancellable source-bound session.
2. Report-ready automatically calls `prepareCoachingBundle(report, originalSource, {repIds, signal})` for up to two completed reps and four source JPEGs.
3. If connected and evidence is complete, call `chatGPTProvider.interpret` once; local playback stays usable while waiting.
4. Validate and bind the response with `getCoachingSegments`; resolve `coachingSegmentAt` against media time. Play, pause and seek reuse the response and create zero additional requests.
5. Keep one concise active cue; make full explanation, evidence jumps and developer exports secondary. The user never has to transfer data between components.

## Live video

Use `startLiveSquat(video, {model:'heavy',captureEvidence:true,...})`. Its `onRepComplete` event contains a report, stable key, rep and `evidenceImages` captured from the **same accepted pixels** used for inference. Build the packet with only `repIds:[event.rep.id]`; join packet evidence to cached JPEGs by timestamp. Do not seek the live stream and do not substitute a current screenshot for an old bottom frame.

The implemented initial policy is **one request in flight, at least eight seconds between starts, maximum six requests per Start/Stop session**. Skip while busy or missing exact evidence; do not build a growing queue. Delayed AI text is labeled as about its cited completed rep, not as a current-frame measurement. Local tracking continues independently.

Stop, source replacement, model/goal changes, disconnect and unmount cancel or invalidate pending work. Clear stale numerical/geometry/AI views promptly. No dispatch before Start or after Stop. If disconnected, failing, missing evidence or capped, retain local tracking and say what happened; never fake AI text.

## Visual semantics and pending frontend work

Green means a disclosed target was met with usable evidence; amber means a supported target miss at the appropriate completed-rep phase; gray means uncertain/unavailable tracking. Tracking confidence is not measurement accuracy.110° projected knee flexion is an illustrative demo target, not a universal good-squat rule. Do not mark standing/descent as a bottom-depth failure.

Reuse the new live camera page and transport rather than creating another engine. Finish the primary app entry, two-video comparison with independent source identities, trusted-HTTPS phone pairing and actual iPhone/Mac verification. Keep native OpenCap and other movements deferred.

## Evidence and acceptance

- Real Heavy + real GPT-6.1 Sol passed the one-Start sample flow with six measurements and source JPEGs at1067/3000ms: [verification record](qa/one-start-heavy-live.json).
- Live UI has real Heavy/synthetic-camera verification with a **mocked** model; actual phone streaming and live-session external AI are separate remaining checks.
- Final root acceptance must independently verify automatic coaching, matching-rep cues, source swaps/Stop, offline behavior and no inference on seek. The smoke result alone is not root acceptance.
- Final Wren runs remain held until the integrated build is ready. Update both stable core workflows to the one-action experience, rerun on the final build, and record results in the ledger.

## Latest experience and camera-motion amendment

New cues **stack in a timestamped session feed** and remain across rep/phase changes. Keep cards short, expandable via Why, and deduplicated across rewind/replay; do not replace them with a disappearing paragraph panel. The newest cue may be highlighted, but older accepted guidance remains inspectable. This supersedes exclusive single-cue presentation above.

The product target now includes a camera moving around the squatting person. Preserve that requirement in implementation planning, but do not claim it is already accurate: MediaPipe supplies estimated world XYZ, while the current validated measurement protocol is side-view projected geometry. Automatic view/continuity detection, temporal stability, per-metric capability gates, baseline resets and independent cross-view validation are required. Keep uncertain current values unavailable while retaining timestamped past guidance. Full-body visibility alone is not sufficient evidence of trustworthy 3D angles.

See the feature-by-feature status in [tracker.md](tracker.md) and the updated [design amendment](docs/frontend-design-amendments.md). Front/oblique knee-inward diagnostics must not become a clinical label or automatic correction without supported evidence. The current bottom-only visual packet does not substantiate whole-motion claims.
