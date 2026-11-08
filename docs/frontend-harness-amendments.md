# Frontend amendment: one Start, automatic grounded coaching

Reviewed against main `e5dea78` / merged PR #13 on 2026-11-07, then implemented for recorded playback in this increment. It supersedes manual packet-preview/copy as the normal experience, including the separate Generate AI analysis action previously requested in `harness/FRONTEND-HANDOFF.md`. See the [live product spec](../_bmad-output/specs/live-squat-product.md) for stories and acceptance.

## Current increment and verification

`src/App.tsx` now implements Start → shared Heavy analysis → automatic source bundle → connected provider interpretation → evidence-bound AI cues over playback. `src/Compare.tsx` keeps packet/copy controls inside collapsed Developer tools. Stop and source replacement abort pending work; stale overlays and the asynchronous sample-loading race are fixed. The current automatic recorded request selects up to the first two complete reps once per report; it does not imply whole-video image transmission or per-frame model inference.

`CI=1 npm run build` passed, including TypeScript. A Chrome browser probe with **mocked provider responses** passed eight checks: disconnected local-only operation, packet controls hidden initially, one-Start interpretation, rep-specific cues without new seek requests, Stop rejecting a pending response, canvas clearing on replacement, uploaded source winning a delayed sample-fetch race, and no page errors. The portable probe is `harness/verify/root-coaching.mjs`; it does not establish real AI quality.

Separately, the parent integration run reports a real connected-provider one-Start Heavy smoke: one `gpt-6.1-sol` request, source JPEGs at 1067/3000 ms, validated observations and a visible playback cue. See [recorded live-provider evidence](../qa/one-start-heavy-live.json). The earlier final Wren passed3/3 on frozen f4a987a. Physical-phone repairs and the later queue/chart changes require new verification. The live harness now caps coaching at six calls/session, waits at least eight seconds between dispatches, allows one request in flight and queues completed-rep bundles sequentially. Root two-video and phone-stream UI integration still requires frontend work.

## Required experience

**Start coached squat** starts the selected video/camera session, local Heavy measurements, phase-aware visual cues and automatic AI interpretation under the shared coaching principles. After one-time account/camera setup, the person does not select evidence, preview packets, copy text, download JPEGs, press Generate, or transfer data to another chat. Packet contents remain available only in an optional developer/debug inspector. Do not put “coaching handoff” in the normal product flow.

Start includes a short visible disclosure that selected rep measurements and up to four source images go to the connected coach while the session is active. The full video is processed locally; it is not uploaded to ChatGPT. If disconnected, state **Local tracking — coach disconnected** and make connection a setup action. Never label local computed hints as AI analysis. Stop ends the session and automatic requests.

## Reuse the actual shared APIs

| Task | Existing API / owner | Frontend action |
| --- | --- | --- |
| Recorded local analysis | `analyzeSquat(source, { model: 'heavy', signal, onProgress })` from `harness/motion/analyze.mjs`; `src/analyze.ts` already wraps it | Keep shared analysis and model provenance. Start orchestrates it, and report-ready automatically continues the authorized session |
| Metrics / geometry | `getMotionTrace`, `getSquatProfile`; `overlayFrameAt`, `drawSquatOverlay` | Use the presented video timestamp and actual content rectangle; clear on missing report/source/loss. Do not invent separate angle formulas |
| Exact source evidence bundle | `prepareCoachingBundle(report, clipSrc, { repIds, userGoal, signal })` from `harness/coaching/index.mjs` | Use original analyzed File/object URL, selected completed rep(s), and matching packet/images from one generation. No user packet-selection step |
| Provider setup | `chatGPTProvider.getConnection`, `startConnection`, `cancelConnection`, `disconnect`, `listModels` from `harness/provider/client.mjs` | Refresh connection after setup and relevant errors. Choose from the returned image-capable model catalog; pose model and AI model are distinct |
| AI interpretation | `chatGPTProvider.interpret(bundle.packet, bundle.images, { model, signal })` | Automatically dispatch after report/completed-rep evidence is ready and session authorization remains valid. Client handles image encoding; do not hand-build transport payloads |
| Principles / validation | Provider injects `MAGNA_CARTA_PROMPT`, uses `COACHING_RESPONSE_SCHEMA`, and validates response citations in `harness/provider/responses.mjs` | Keep this shared path so measurements and coaching principles travel together. Never duplicate a weaker inline prompt or let model prose replace report numbers |
| Replay cues | `getCoachingSegments(response, packet, report)`, `coachingSegmentAt(segments, timestampMs)`; optional `getCoachingTimeline` / `coachingMarkerAt` | Store accepted response with its source report/packet. Resolve cues on playback/seek; no new request on every frame or seek. Segments provide readable rep-wide context; timestamps still navigate exact evidence |

The current provider route accepts exactly `{ model, packet, images }`. Keep frontend session/generation bookkeeping outside this payload unless the provider contract is deliberately updated. The loopback service is intentionally bound to `http://127.0.0.1`; do not tunnel or expose it to the phone. Phone signaling is a separate surface.

## Lifecycle and timing

Maintain `{ sessionId, sourceId, generation, goalVersion, active, coachStatus }` in the orchestration layer; these are proposed frontend state fields, not existing API exports. Snapshot this identity alongside each report, evidence bundle and request. Recorded-analysis Stop cancels its current job. Live Stop ends capture but retains the current coaching generation until its queue finishes. New source/model/goal sessions, revoked authorization and unmount invalidate unfinished work. Accept a late response only when its identity still matches the intended session/source and consent remains active.

For uploaded video, prepare the authorized selected-rep bundle automatically when analysis completes, start playback without another packet action where browser autoplay permits, and keep playback/metrics usable during the asynchronous request. If a browser denies playback, show its required Play affordance honestly. A completed reply appears at its cited rep on replay, with an evidence-linked summary still available outside that window.

For live video, local tracking continues while the coach evaluates completed reps. Follow the current live harness policy: maximum six coaching calls per session, at least eight seconds between dispatches, one request in flight, queue immutable completed-rep bundles in a bounded FIFO. Show **Coach reviewing rep N…**, then **AI · About rep N**. Do not attach a delayed opinion to the current moving frame as if it had just been measured. Do not send a request on each video frame.

`prepareCoachingBundle` is a seekable recorded-source API; it does not accept a live `MediaStream`. A live adapter must retain a bounded buffer of source pixels tied to actual analyzed frame timestamps, then construct a validated completed-rep bundle from those pixels. Do not claim a fresh screenshot taken after a rep is its bottom frame. The existing recorded helper seeks by timestamp, so exact correspondence on variable-rate inputs must be verified against decoded presentation timestamps before claiming exact-frame evidence. A matching timestamp label alone is insufficient.

The local overlay, trace values and AI cue use the same media-time basis, but have different meanings: overlay shows the current reliable sample; metrics show local measurements; AI segments summarize their cited rep. Gray/no geometry when pose is unavailable. Green/amber applies only to a disclosed target at the appropriate phase; do not fail a bottom-depth target while standing.

## Historical PR #13 review and remaining integration

Items 1–4 below describe the reviewed `e5dea78` state and are addressed by this increment. Item 6 now refreshes on session Start and provides a setup connection action, but richer account-state UX remains a frontend follow-up. Items 5 and 7 remain integration work; do not mistake the historical review for the current shipped state.

1. **No AI request or rendering path:** `src/App.tsx` fetches connection status only; `src/Compare.tsx` offers manual preview/copy. Neither calls `chatGPTProvider.interpret` nor the coaching playback helpers. A connected header therefore cannot imply a generated explanation.
2. **No normal one-Start session:** open/import triggers analysis, then evidence is behind Preview coaching packet. Move that orchestration into the session controller and remove packet controls from the primary journey.
3. **Stale overlay on replacement/error:** App's drawing effect returns when `report` is null and cleanup only detaches callbacks. The persistent canvas can retain the previous skeleton while a new clip analyzes or an error occurs. Clear the canvas immediately on invalidation and source/model changes; regression-test replacement before analysis finishes.
4. **Sample-loading race:** `openSample` awaits fetch without abort/generation protection. Selecting another file before fetch completes can be overwritten by the older sample request. Apply the same source generation guard used for analysis.
5. **Only two reps of one clip:** `Compare` receives one report/source. The requested two-video comparison needs two independent report/source identities and corresponding rep selection, not duplicate rep IDs treated as globally unique.
6. **Connection state is a one-shot label:** refresh after login/logout or authorization errors; show connected, pending and actual coaching result states separately. Account login is setup, not evidence of interpretation.
7. **Live capture integration is additional work:** the merged root frontend does not select a phone stream or expose live processing status. Use the new transport/motion work through an explicit adapter, without passing a MediaStream to the recorded file analyzer.

## Acceptance before completion

- On a connected account, one Start on the clear fixture produces a Heavy report, bounded source images, a real validated AI response and visible evidence-bound replay cues without opening any packet panel.
- While the request is pending, playback, trace values and local overlay continue. Seeking does not increase request count. UI labels distinguish local measurements, local goal cues and AI explanation.
- Inspect network traffic: selected packet/images only, no full video; no dispatch before Start or after Stop; bounded request count and one in flight. Missing images halt automatic visual interpretation with a clear local-only state rather than silently substituting unrelated pixels.
- Replace clip during sample load, analysis, image extraction and AI request; change model/goal; Stop/restart. No stale source, overlay, image or explanation appears, and owned object URLs/media tracks are released.
- Verify two source identities, correct per-source evidence navigation and real image/timestamp correspondence. Track physical iPhone/WebRTC verification separately from fixture tests.
- Update the old product-readiness selectors and Wren expectations to this journey; manual copy must not remain a required acceptance step. Preserve the stable Wren case IDs and run both on the final integrated build only after local QA, per the held-budget gate.

## Current pickup checkpoint — stacked feed and experimental views

The designed frontend should consume the [global tracker](../tracker.md) and [UI/UX contract](frontend-design-amendments.md) before reusing historical examples above. Root real AI now has independent recorded evidence in `qa/root-live-chatgpt.json`. Root readiness has20 passing scoped checks; historical results are archived. Main/root links into the live page and that upstream navigation must be preserved.

Smoke and live now implement retained timestamped coaching cards (bounds12 and6 respectively), with expanded Why details and source/session reset. Their focused browser checks pass; the root retained feed now passes fifteen controlled-provider development checks. Whole-body overlay is implemented with five focused tests. Phone long polling, received-stream Heavy and return-feedback transport exist; public media/Heavy/local return passed, but a returned AI-caption timeout remains unresolved. No physical iPhone acceptance is claimed.

`createViewGuard` is now integrated as experimental live validity/epoch gating. `analyzeMultiViewFrame` returns estimated/unavailable values plus reason, unit, confidence and provenance; its actual Heavy confidence compatibility is verified, not anatomical accuracy. Use the integrated result shape documented below. Clear per-view baselines on epoch/source changes, preserve historical cards and never convert unavailable into zero. The incoming designed frontend must not bypass these gates to make arbitrary views appear supported.

The new `harness/live/motion/phase-evidence.mjs` exports `selectPhaseEvidence` and `buildLiveCoachBundle`. It selects cached descent/bottom/ascent frames and measured phase samples within v1; three focused tests pass. Live cache wiring is browser-verified; use the returned bound report/packet/images together. Current real-provider evidence remains bottom-only. Preserve per-rep accessible labels in the redesigned root: a recent compact-label regression was fixed and the fifteen-check development probe passes.

### Sparse phase-evidence API (integrated and browser-verified)

Import from `harness/live/motion/phase-evidence.mjs` (typed sibling `.d.mts`):

- `selectPhaseEvidence(report, rep, Map<timestampMs, JPEGBlob>)` chooses the exact measured bottom plus available cached mid-descent/mid-ascent samples, at most three images. A missing phase is omitted; a missing exact bottom is never replaced with a nearby screenshot.
- `buildLiveCoachBundle(report, repId, evidenceImages)` returns `{packet, images, phases, report}` with actual trace knee/torso phase measurements (at most seven), matching source references and a valid CoachPacket v1. Original report data is unchanged; the returned report binds the added measurements for replay validation.
- The summary explicitly describes sparse phase coverage. Display returned phase times/labels; do not imply every video frame went to AI or infer evidence from an omitted phase. Keep source-generation/epoch binding and existing live request caps.

Three pure tests pass. Combined live browser QA passes cache selection: five controlled-provider requests each received three phase JPEGs. Actual real-provider phase interpretation remains pending. This increment expands evidence coverage; it does not establish full-motion visual understanding or phase-angle accuracy.

### View-epoch versus source/session invalidation

A view-epoch change within the same active source/session clears current measurements, unfinished reps and relative baselines, but does not invalidate an immutable completed-rep image/measurement bundle. Let its in-flight AI request finish and append a card labeled with the original rep/view and source time. Do not apply that historical response to current geometry. Live Stop drains the current session’s bounded queue; new source/session or revoked authorization aborts unfinished work.

### Integrated live result contract

`LiveSample` adds `poseDisplayFrame` (full-body drawing independent of side-view measurement validity), `analysisEligible`, `metricValidity` (each projected key has `{status,reason}`), experimental `multiView` diagnostics/provenance and `viewGuard: {state,reason,epoch,declaredView,experimental:true}`. `LiveRep` adds its epoch and up to three exact phase JPEGs. `startLiveSquat` defaults declared view to side as an explicit workflow assumption; `setView`/`resetView` reset window baselines. These labels do not infer a validated camera angle.

Adaptive video dimensions no longer fatally stop the session: old-size in-flight detections are discarded and the new epoch reacquires. Historical completed-rep AI can finish across a view epoch with its original view/time labels; Live Stop now lets its queued review finish; a new session still aborts it. Twenty-three focused motion/live/phase tests and combined real-Heavy browser QA passed, including dynamic resize, fresh subsequent reps, five controlled-provider three-image requests, real WebRTC AI return and QR cleanup. Offline browser QA passes with zero provider calls. Public HTTPS real-provider return, physical iPhone and independent moving-camera accuracy remain unverified.

## Local history integration

The confirmed storage scope is local to the analysis computer/browser/origin. [Shared history API](../harness/history/index.d.mts) saves versioned source-hashed originals, immutable reports, accepted coaching and bounded live evidence. [History UX and acceptance](HISTORY.md) govern save states, opt-out, retry, search/rename/reopen/download/delete and source-timing provenance. Reopen uses stored evidence and never triggers fresh inference. See [setup prompts](AI-SETUP.md) and [developer guide](DEVELOPMENT.md) for new-computer handoff.
