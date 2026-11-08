# AI integration amendment — one session, retained coaching

Read this with the [global tracker](tracker.md), [UI/UX contract](docs/frontend-design-amendments.md), [frontend API handoff](docs/frontend-harness-amendments.md) and [shared report/packet contract](_bmad-output/specs/shared/analysis-report-v1.md). This supersedes normal-flow Preview/Generate/Send/Handoff requirements and disappearing single-paragraph coaching.

## Current verification scope

Final GO is pending. The complete local baseline is 137 tests (129 harness +8 launcher/doctor), before the newest account-menu, anchored-tour, layout and saved-pose edits. Their focused checks do not replace the final integrated suite/build/provider check. Wren 60ba178a passed 3/3 on historical 32159db; the latest final rerun is pending with 5 credits remaining. Current working-tree behavior below is not a claim that every change is pushed or published.

## One Start and shared interpretation

After initial account/camera setup, **Start coached squat** automatically coordinates local Heavy, measures, source evidence and connected AI. Disclose selected image/measurement transmission beside Start. Full video and raw landmark traces remain local. Provider supplies the shared Magna Carta principles, structured response schema and citation validation; do not create a parallel prompt or replace measured values with generated numbers.

For a recording, call shared `analyzeSquat`, then `prepareCoachingBundle(report, originalSource, {repIds,signal})`; the current path selects up to two complete reps/four source images. Call `chatGPTProvider.interpret` once per authorized report. Validate source binding through `getCoachingSegments`; seek/play uses stored results, not new requests. Report/packet exports are developer details only.

For live video, use `startLiveSquat` and its completed-rep event/cached exact accepted pixels. Join packet evidence by source timestamp, not current screenshot time. Current limits: **one request in flight,≥8 seconds between dispatches, six calls per Start/Stop session**, queue immutable completed-rep bundles in a bounded FIFO. Keep local analysis/video usable while waiting.

## Physical-demo correction — queued rep reviews

The 2026-11-07 phone test showed that an empty AI panel could hide late/aborted interpretation. Show every completed rep's review state: queued, analyzing, ready, failed, cancelled or not queued at the six-review limit. Keep the last accepted card visible while the next request works. One request runs at a time, with at least eight seconds between actual dispatches; busy reps enter the bounded queue rather than disappearing. Full video remains local.

Live Stop stops capture and saves the recording while queued reviews finish in the originating page. Save accepted results and state updates with `patchSession`, which cannot recreate a deleted recording or replace its video. History polls revisions, preserves playback while results arrive, and labels stale queue progress unconfirmed. Open History separately while work remains; leaving/closing the originating page interrupts its in-memory queue. Do not imply server-side continuation or automatic restart. New Start cancels unfinished old reviews. Persistent resumable jobs are a future extension.

The live chart shows a bounded thirty-second window of knee/hip/torso estimates and rep markers, with gaps for unavailable tracking and view changes. A collapsible local diagnostic log exposes frame cadence, tracking reasons and review progress without packet contents, media, credentials or pairing URLs. Original live notes follow the approximate recording clock map. A separately prepared saved-video pose overlay uses measurements decoded from that saved video itself; never relabel the original notes as frame-exact.

## Saved-video pose replay and setup

Opening a saved live recording without a valid source-bound pose cache automatically runs one local Heavy pass. Cache the report against the original video hash and reuse it on reopening; a failed cache write can retry without repeating retained inference. Playback and stored notes remain usable while preparation runs. This creates no new ChatGPT request and does not rewrite the original live rep count, AI notes, evidence or recording. Pose drawings use actual saved-video sample times; original live AI alignment remains approximate. Missing/unsupported pose stays unavailable. The public-MP4 replay probe passes14 scoped checks, and actualChrome VP9 MediaRecorder passes6 separate decoder/Heavy/hash/cache/abort/no-AI checks. Final combined acceptance and physical-phone behavior remain separate.

The persistent header exposes connection status and explicit Connect before analysis. Account options remain compact and close on outside interaction/Escape; sign-in is never automatic. The small optional tour highlights real controls, including the actual coaching panel, and never starts a camera. Notes sit beside video on desktop and immediately below it on mobile. Icons are local Material SVGs, not remote assets.

## Stacked coaching behavior

Append a concise source-timestamped card when an eligible observation arrives. Keep prior cards across phase changes, tracking loss and Stop; highlight the newest, and expand full rationale/uncertainty per card. Current implementation bounds are12 smoke cards and6 live AI cards. These supersede the earlier proposed20-card default; redesigned root should use explicit documented bounds rather than an unbounded transcript.

Short primary actions aim for12 words or fewer; full observations remain in details. The provider asks for concise output, but a prompt alone is not a UI length guarantee. Local templates need local labels. A delayed AI card says **About rep N** and must not imply current-frame detection. Deduplicate semantic events across rewind/replay; preserve scroll/focus for someone reading an earlier card. No typed-out paragraphs or page jumps.

New source/session/model invalidates pending work and clears the applicable history. Live Stop ends capture, retains cards and drains already queued reviews for that session. New Start or revoked authorization cancels unfinished work. Capture/view loss clears unreliable current geometry/numbers; historical cards remain explicitly evidence-bound. Never pin an old body's skeleton or an old region highlight onto a different current frame.

## Phone and provider boundaries

Phone video arrives over the existing WebRTC transport and enters the same Heavy controller. Local cues and AI text return through the bounded data-channel messages. Phone sender uses authenticated JSON long polling for temporary HTTPS tunnels; the private laptop receiver uses its local connection/proxy. Only dedicated4176 is exposed; the credential-bearing provider on4173 remains loopback-only. QR generation is local and pairing invitations must not enter logs or external QR services.

Public HTTPS, real WebRTC, Heavy and returned real ChatGPT captions passed across two Chrome contexts after adaptive-resolution recovery. One request carried three phase images and returned in 10.209 seconds; its original-view historical card remained valid. See [phone evidence](qa/phone-https.json). This used a fixture-backed synthetic camera; physical iPhone/venue behavior remains unverified.

## Current live review input: bounded sequence + sampled trace

The current live builder submits **up to seven real cached JPEGs** across start, two descent points, the exact bottom, two ascent points and end. A phase anchor may use a usable source frame within250ms inside that phase; missing anchors are omitted and the bottom is never substituted. Images are at most640px on the long edge and1MiB each. Optional `CoachPacket v1.motionContext` carries the source clip/model IDs, one rep's timing bounds and at most31 ordered actual knee/hip/chest-angle samples, with unavailable values kept null and no interpolation. Existing packets without this additive field remain accepted; recorded-clip default image selection staysfour. Trace samples do not create new response citation IDs. An observation must still cite submitted measurement/frame IDs; sparse samples do not establish behavior between them. The illustrative110° display reference is not a prescribed depth or an inferred user-selected target.

The six-review/one-in-flight queue and rolling capture cache stay bounded. Accepted review snapshots are saved up to42/session (seven times six), with existing100MiB video and500MiB application caps. No full video or raw landmark stream is sent. Focused local tests cover source timestamps, missing samples, seven-image provider request assembly with mock transport, and real IndexedDB42-image persistence/43rd-image rollback. These are contract checks, not new real-provider, physical-phone or biomechanical-accuracy acceptance; earlier three-image real-provider records below remain historical evidence.

## Viewpoints, experimental metrics and motion evidence

Green means a disclosed goal met with usable evidence; amber means a supported selected-goal miss at the correct phase; gray means unavailable/uncertain. The illustrative110° projected knee goal is not a universal good squat or medical threshold. Full-body detection/visibility is not measurement accuracy. Side-view timing/formula checks are not independent joint-angle validation.

The requested orbiting-camera feature requires identity/left-right continuity, bounded filter delay, per-metric view validity and baseline reacquisition. `createViewGuard` is integrated into the live per-metric validity/epoch path and passed combined browser checks; it remains an experimental image-continuity heuristic. `analyzeMultiViewFrame` returns experimental estimates/projection reasons; it does not modify AnalysisReport v1. Estimated world-XYZ knee/hip angles and front-only medial offsets are not calibrated 3D or clinical valgus. Preserve nulls and uncertainty; never infer arbitrary-angle accuracy from33 landmarks.

Earlier root real-provider evidence used bottom JPEGs and bounded report measurements. The new `buildLiveCoachBundle` helper adds selected cached descent/bottom/ascent images and measured phase samples within the existing v1 contract; four focused tests and live cache/browser wiring passed, with five controlled-provider requests carrying three phase JPEGs each. The public real-provider request also returned validated interpretation from three phase images. Direction, sequencing or knee-path claims still require adequate temporal evidence; bottom stills alone do not prove whole motion. Keep phase images exact and bounded, and do not describe this as full-video upload.

## Evidence and remaining gates

- Real Heavy + real ChatGPT passed smoke and [root](qa/root-live-chatgpt.json), with one request and source images1067/3000 ms; root replay showed both rep cues without extra requests.
- Smoke stacked playback passed its controlled-provider check. Live stacked feed passed a two-card local-camera browser check. Root's designed retained feed passed fifteen production-preview checks and a user-visible real-provider demo on 9446951.
- [Root readiness](qa/product-readiness.json) has20 passing local checks on its recorded build; [archived evidence](qa/product-readiness.md) keeps the old preview/copy result separate.
- Historical polished Wren passed 3/3 on `f4a987a` ([result](qa/wren-final-results.json)); the later completed run60ba178a passed 3/3 on `32159db`. The final rerun for current edits is pending. Physical phone and independent cross-view/orbit accuracy remain separate gates. OpenCap root import, cited-region accents, goal/reference setup and automatic moving-camera analysis are unfinished implementation; see the [audit](tracker.md#completion-audit).

Root retained-feed integration now passes fifteen controlled-provider development checks: short cards, delayed rep ordering, expanded reasons/limits/citations, Stop/reset, replay deduplication and source races. Per-rep accessible labels are preserved. Earlier built readiness and real-provider passes remain scoped to their recorded builds.

### View-epoch versus source/session invalidation

A view-epoch change within the same active source/session clears current measurements, unfinished reps and relative baselines, but does not invalidate an immutable completed-rep image/measurement bundle. Let its in-flight AI request finish and append a card labeled with the original rep/view and source time. Do not apply that historical response to current geometry. Live Stop drains the current session’s bounded queue; new source/session or revoked authorization aborts unfinished work.

Historical automated checkpoint: `npm test` passed86 harness tests and4 launcher tests. The historical f4a987a checkpoint passed110 harness and8 launcher/doctor tests (118 total), with no failures, cancellations or skips. Public real-provider return now passes; physical-device and independent-accuracy acceptance remain separate.

## Two independent recordings

**Compare examples** is a local comparison action using the same selected pose model for both attributed recordings. It retains separate source hashes, reports, rep IDs and media clocks. Compare bottoms seeks each selected rep to its own bottom. It does not dispatch an AI request. Its Good example / Bad example labels come from the source dataset for one person's two clips, not from MoveIDE. See the [comparison amendment](docs/two-recording-comparison-amendment.md) and shared `compareRecordings` API. Normal single-recording Start continues to orchestrate connected AI automatically.

Historical runtime checkpoint `f4a987a`:118 integrated tests,15 controlled-provider root checks and9 real ChatGPT/history checks passed;22 comparison checks covered independent recordings and visible rep buttons. That historical GO does not cover later changes. Use the current tracker and exact-build QA ledger for final acceptance. Native OpenCap, chat, physical iPhone and independent angle/orbit gates retain their stated scope.
