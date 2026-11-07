# AI integration amendment — one session, retained coaching

Read this with the [global tracker](tracker.md), [UI/UX contract](docs/frontend-design-amendments.md), [frontend API handoff](docs/frontend-harness-amendments.md) and [shared report/packet contract](_bmad-output/specs/shared/analysis-report-v1.md). This supersedes normal-flow Preview/Generate/Send/Handoff requirements and disappearing single-paragraph coaching.

## One Start and shared interpretation

After initial account/camera setup, **Start coached squat** automatically coordinates local Heavy, measures, source evidence and connected AI. Disclose selected image/measurement transmission beside Start. Full video and raw landmark traces remain local. Provider supplies the shared Magna Carta principles, structured response schema and citation validation; do not create a parallel prompt or replace measured values with generated numbers.

For a recording, call shared `analyzeSquat`, then `prepareCoachingBundle(report, originalSource, {repIds,signal})`; the current path selects up to two complete reps/four source images. Call `chatGPTProvider.interpret` once per authorized report. Validate source binding through `getCoachingSegments`; seek/play uses stored results, not new requests. Report/packet exports are developer details only.

For live video, use `startLiveSquat` and its completed-rep event/cached exact accepted pixels. Join packet evidence by source timestamp, not current screenshot time. Current limits: **one request in flight,≥8 seconds between dispatches, six calls per Start/Stop session**, skip while busy with no queue. Keep local analysis/video usable while waiting.

## Stacked coaching behavior

Append a concise source-timestamped card when an eligible observation arrives. Keep prior cards across phase changes, tracking loss and Stop; highlight the newest, and expand full rationale/uncertainty per card. Current implementation bounds are12 smoke cards and6 live AI cards. These supersede the earlier proposed20-card default; redesigned root should use explicit documented bounds rather than an unbounded transcript.

Short primary actions aim for12 words or fewer; full observations remain in details. The provider asks for concise output, but a prompt alone is not a UI length guarantee. Local templates need local labels. A delayed AI card says **About rep N** and must not imply current-frame detection. Deduplicate semantic events across rewind/replay; preserve scroll/focus for someone reading an earlier card. No typed-out paragraphs or page jumps.

New source/session/model invalidates pending work and clears the applicable history. Stop aborts pending requests but preserves accepted session cards. Capture/view loss clears unreliable current geometry/numbers; historical cards remain explicitly evidence-bound. Never pin an old body's skeleton or an old region highlight onto a different current frame.

## Phone and provider boundaries

Phone video arrives over the existing WebRTC transport and enters the same Heavy controller. Local cues and AI text return through the bounded data-channel messages. Phone sender uses authenticated JSON long polling for temporary HTTPS tunnels; the private laptop receiver uses its local connection/proxy. Only dedicated4176 is exposed; the credential-bearing provider on4173 remains loopback-only. QR generation is local and pairing invitations must not enter logs or external QR services.

Public HTTPS, real WebRTC, Heavy and returned real ChatGPT captions passed across two Chrome contexts after adaptive-resolution recovery. One request carried three phase images and returned in 10.209 seconds; its original-view historical card remained valid. See [phone evidence](qa/phone-https.json). This used a fixture-backed synthetic camera; physical iPhone/venue behavior remains unverified.

## Viewpoints, experimental metrics and motion evidence

Green means a disclosed goal met with usable evidence; amber means a supported selected-goal miss at the correct phase; gray means unavailable/uncertain. The illustrative110° projected knee goal is not a universal good squat or medical threshold. Full-body detection/visibility is not measurement accuracy. Side-view timing/formula checks are not independent joint-angle validation.

The requested orbiting-camera feature requires identity/left-right continuity, bounded filter delay, per-metric view validity and baseline reacquisition. `createViewGuard` is integrated into the live per-metric validity/epoch path and passed combined browser checks; it remains an experimental image-continuity heuristic. `analyzeMultiViewFrame` returns experimental estimates/projection reasons; it does not modify AnalysisReport v1. Estimated world-XYZ knee/hip angles and front-only medial offsets are not calibrated 3D or clinical valgus. Preserve nulls and uncertainty; never infer arbitrary-angle accuracy from33 landmarks.

Current real-provider evidence uses bottom JPEGs and bounded report measurements. The new `buildLiveCoachBundle` helper adds selected cached descent/bottom/ascent images and measured phase samples within the existing v1 contract; four focused tests and live cache/browser wiring passed, with five controlled-provider requests carrying three phase JPEGs each. The public real-provider request also returned validated interpretation from three phase images. Direction, sequencing or knee-path claims still require adequate temporal evidence; bottom stills alone do not prove whole motion. Keep phase images exact and bounded, and do not describe this as full-video upload.

## Evidence and remaining gates

- Real Heavy + real ChatGPT passed smoke and [root](qa/root-live-chatgpt.json), with one request and source images1067/3000 ms; root replay showed both rep cues without extra requests.
- Smoke stacked playback passed its controlled-provider check. Live stacked feed passed a two-card local-camera browser check. Root's designed retained feed passed fifteen production-preview checks and a user-visible real-provider demo on 9446951.
- [Root readiness](qa/product-readiness.json) has20 passing local checks on its recorded build; [archived evidence](qa/product-readiness.md) keeps the old preview/copy result separate.
- Physical phone, independent cross-view/orbit accuracy and both final Wren workflows remain distinct gates. No historical test should be relabeled as those results.

Root retained-feed integration now passes fifteen controlled-provider development checks: short cards, delayed rep ordering, expanded reasons/limits/citations, Stop/reset, replay deduplication and source races. Per-rep accessible labels are preserved. Earlier built readiness and real-provider passes remain scoped to their recorded builds.

### View-epoch versus source/session invalidation

A view-epoch change within the same active source/session clears current measurements, unfinished reps and relative baselines, but does not invalidate an immutable completed-rep image/measurement bundle. Let its in-flight AI request finish and append a card labeled with the original rep/view and source time. Do not apply that historical response to current geometry. Stop, new source/session or revoked authorization still aborts or invalidates pending work.

Final automated suite checkpoint: `npm test` passed86 harness tests and4 launcher tests with no failures, cancellations or skips. Public real-provider return now passes; physical-device and independent-accuracy acceptance remain separate.

## Two independent recordings

**Compare examples** is a local comparison action using the same selected pose model for both attributed recordings. It retains separate source hashes, reports, rep IDs and media clocks. Compare bottoms seeks each selected rep to its own bottom. It does not dispatch an AI request or label one person good/bad. See the [comparison amendment](docs/two-recording-comparison-amendment.md) and shared `compareRecordings` API. Normal single-recording Start continues to orchestrate connected AI automatically.
