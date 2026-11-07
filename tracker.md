# MoveIDE global delivery tracker

Updated 2026-11-07; integration checkpoint `afb6fa1`, with newer frontend and experimental work still being verified. **Incoming frontend agent: read this first.** This tracker distinguishes implemented code, the surface actually verified, and remaining acceptance. Later commits do not inherit an earlier build's final-QA status automatically.

## Product decision and handoff

One **Start coached squat** coordinates the selected video/camera, local MediaPipe Heavy, measurements, exact source evidence, shared coaching principles and asynchronous AI. Initial account/camera permission is setup. No normal Generate/Send/packet-handoff task. Coaching cards append with source timestamps and remain across rep phases; each has a short focus and expandable explanation. Do not restore disappearing paragraphs or a shifting wall of text.

The requested target includes full-body visualization, two genuinely different video recordings, and iPhone → MacBook streaming with feedback returned to the phone. It also includes a camera moving around a person during squats. That orbit capability is a required research/integration target, **not a verified accuracy claim**. Full-body visibility alone is insufficient. Native OpenCap inference and broad non-squat movements remain deferred; the existing OpenCap import adapter stays available as imported-unverified data.

Read in this order:

1. [UI/UX contract](docs/frontend-design-amendments.md): layouts, stacked feed, setup, view gates, orbit behavior and accessibility.
2. [AI amendment](AI-AMENDMENTS.md): automatic dispatch, exact evidence, history and validity rules.
3. [Frontend API handoff](docs/frontend-harness-amendments.md) and [harness integration guide](harness/FRONTEND-HANDOFF.md).
4. [Shared report/packet contract](_bmad-output/specs/shared/analysis-report-v1.md), [motion API](harness/motion/analyze.d.mts), [live API](harness/live/motion/index.d.mts), [transport guide](harness/live/transport/README.md).
5. [Product spec](_bmad-output/specs/live-squat-product.md), [story backlog](_bmad-output/specs/epics.md), [demo runbook](docs/live-squat-demo.md) and [quickstart](docs/quickstart.md).

[workflow.html](workflow.html) is the interactive summary. This tracker and linked acceptance evidence remain authoritative.

## Complete feature and evidence inventory

| Feature | Implementation / tested surface | Remaining gate |
| --- | --- | --- |
| Shared recorded analysis | Root frontend consumes `analyzeSquat`; Heavy v1 default, Full explicit alternative; pinned assets and same-origin worker | Preserve shared engine during redesign; do not introduce private geometry |
| Source-timed measurements and reps | Clear fixture 57/57 tracked, two bottoms 1067/3000 ms; labels1067/2933 ms, errors0/67 ms within150 ms. Extended knee/hip/torso/shin/ankle/depth proxies and phase anchors exist | Independent anatomical-angle accuracy remains unmeasured |
| Full model output | 33 normalized/world slots per sample with observed confidence/provenance, local export | Estimated world XYZ is not calibrated 3D truth |
| Root one-Start AI | Real GPT-6.1 Sol, one request, six measurements, source JPEGs1067/3000 ms; both rep cues and no extra seek requests passed in [root evidence](qa/root-live-chatgpt.json) | Does not prove later redesigned UI or full-motion image interpretation |
| Root lifecycle and local readiness | Fifteen controlled-provider production-preview checks in [root-one-start](qa/root-one-start.json), including retained short cards, Why, delayed response ordering, Stop/reset and source races; twenty fresh-build offline checks in [readiness](qa/product-readiness.json), tested source `c1c9378` | Rerun affected gates after current integration; readiness is not Wren authorization |
| Safari recorded analysis | `6c1bae0`: `seekVideoFrame` falls back to the seeked `currentTime` when Safari skips `requestVideoFrameCallback` for the off-screen decoder (250 ms grace once per video). Simulated silent-callback run: 57/57 frames in WebKit and Chrome (previously failed with "did not present the requested video frame"); Quinn confirmed real Safari analysis completes (2026-11-07); 90/90 tests | iPhone Safari and HEVC clips not yet checked |
| Root replay controls | Trace, sample stepping, playback speed, rep anchors, evidence navigation verified by readiness probe | Preserve accessible equivalents and source clock in designed frontend |
| Root/live navigation | Main root links to live page; source navigation added upstream and preserved | Unified designed session experience and consistent source-state UX remain |
| Smoke stacked coaching | Implemented, controlled-provider playback verifier passed; persistent cards, no duplicates on seek/replay, reset on new analysis/model | Root feed passes fifteen production-preview checks on c1c9378; rerun affected gates for subsequent restyles |
| Live stacked coaching | Implemented; local-camera browser test produced two distinct cards, retained on Stop, reset on new Start, collapsed Why and narrow-layout checks passed | Public HTTPS real-provider AI caption return now passes; physical iPhone remains |
| Feed bounds and concise text | Smoke retains up to12 cards; live AI feed up to6 matching six-request budget. Short next focus/expanded reasoning; no paragraph streaming | Root retained feed now implemented; short cues and expanded evidence/limits verified with controlled provider |
| Full-body overlay | Shared overlay now draws reliable arms, torso, legs and hand/foot links; five focused tests passed | Designed region-specific emphasis and physical moving-camera stability remain |
| Live Heavy controller | Real fixture `captureStream` benchmark:37 processed/72 dropped, mean76.8 ms/max164.6 ms local processing; two reconstructed reps, one stabilized completion before clip end | Not phone end-to-end latency or independent angle validation |
| Bounded live AI | Exact accepted source pixels cached; one request in flight,≥8 seconds between dispatches, maximum6/session, skip while busy/no queue | Preserve caps, abort/generation guards and evidence origin during integration |
| Phone pairing, QR and received stream | Dedicated transport + same-origin private receiver proxy; local-generated QR/private link, expiry/late-QR/Stop cleanup; received MediaStream feeds shared Heavy | Real iPhone permission/foreground/lock/reconnect and venue network check |
| Phone return feedback | Real WebRTC data channel carries local feedback and AI captions; independent Chrome-context integration passed | A physical phone has not been verified |
| Trusted HTTPS / long polling | Phone sender long-polls authenticated signaling to avoid quick-tunnel SSE limitation; private receiver stays local | Public HTTPS real WebRTC + Heavy + local and real ChatGPT feedback pass across two Chrome contexts; one three-image request returned in10.209s after adaptive resize. Physical iPhone and venue behavior remain |
| Experimental multiview adapter | `analyzeMultiViewFrame` provides estimated world-XYZ knee/hip angles and front-only signed image-plane knee offsets; six focused tests passed | Integrated as experimental diagnostics with per-metric availability; real frontal/oblique accuracy missing |
| Actual Heavy confidence compatibility | [Browser evidence](harness/motion/multiview-browser-evidence.json):57 frames,1,881 normalized and world points each with observed confidence; left estimates available, occluded right withheld, front proxies withheld on side view | Compatibility/abstention evidence only; not angle-accuracy proof |
| Experimental continuity/view guard | `createViewGuard` integrated into live samples; eight focused tests and combined real-Heavy browser QA passed; real clear fixture49/57 stable without epoch break | Live epochs reset current metric/baseline state, preserve completed-rep history; guard remains an experimental image-continuity heuristic |
| Moving-camera / orbit analysis | UX and VIEW-4/5/6 requirements recorded: identity, anatomical sides, view changes, latency-bound filtering, baseline reacquisition | Independent orbit dataset/reference, per-metric validity, false-cue and accuracy benchmarks are missing |
| Front knee-inward projection | Experimental front-only normalized image-plane offset exists with per-metric reason/confidence/provenance | Person/phase baseline, view stability, independent real frontal labels and cue precision; not clinical valgus |
| Multi-phase AI evidence | `buildLiveCoachBundle` / `selectPhaseEvidence` implemented in `harness/live/motion/phase-evidence.mjs`; four focused tests passed | Live cache wiring and combined browser QA passed: five controlled-provider requests each carried three phase JPEGs; public real-provider request now carries three phase JPEGs (1205/1605/1937ms), returns validated historical coaching; full-motion understanding remains unproven |
| Two different videos | One **Compare examples** action analyzes clear/supported with the same Heavy/Full model; distinct byte hashes, independent reports/reps/clocks, phase navigation, three primary metrics and expanded detail | [Browser evidence](qa/two-recording-comparison.json) covers actual Heavy; no good/bad ground truth or automatic cross-recording AI is claimed |
| OpenCap import | Constructed-data tests and browser File import passed; imported-unverified units/hashes/source rows retained | Native inference blocked on unavailable compatible runtime/assets/metadata; deferred by user |
| Easy launch | `npm run demo` / launcher and quickstart implemented; six persistent launcher tests passed, plus syntax/helper cleanup/port-refusal checks | Fresh9446951 setup-only auto-installs locked dependencies and pinned models; TypeScript/Vite build and dist asset hashes pass [evidence](qa/fresh-setup.json). Physical phone rehearsal remains; no tunnel by default |
| Final design polish | Detailed UI/UX and engineering handoff supplied. Recorded clip (`/`) now uses the Live camera palette, wordmark, source nav, intro, pill buttons, dark stage and panels; checked in browser at 1440 and 375 after sample analysis, with no horizontal overflow (Compare table scrolls inside its card); `tsc` and `vite build` pass | Designed root/mobile implementation, rendered review, contrast/focus/text zoom/reduced-motion checks |
| Final Wren qualification | Prior harness cases and one older workbench case passed | Both core cases on the same final build, after local/device gates; reconcile debit before dispatch |

**Automated-suite status:** `65fc875` passes99 harness tests and6 launcher tests, zero failures/cancellations/skips. Combined live browser QA passes adaptive resize, historical/fresh-view cards, three phase JPEGs, offline behavior and returned mock-AI via real WebRTC. Test transports use ephemeral ports and cannot touch the running demo. Local processing73ms at10.0fps (camera) /7.4fps (browser phone path) is not network latency. [Latest checkpoint](qa/latest-local-checkpoint.json).

**Newest recorded production acceptance:** `c1c9378` passes fifteen controlled-provider lifecycle checks, seven real-provider checks (including retained short cards) and twenty fresh-build readiness checks. Later9446951 restyle passed fifteen production checks and the real user-visible demo; do not silently transfer evidence across revisions. Per-rep accessible labels remain required.

## Incoming frontend implementation contract

- Reuse `analyzeSquat`, `getMotionTrace`, `getSquatProfile`, `overlayFrameAt` and `drawSquatOverlay`. Use actual source media time and video content rect. The raw `onPoseFrame` hook is optional/local.
- Reuse `prepareCoachingBundle` for seekable recordings and `chatGPTProvider` for connected interpretation. Provider owns shared principles and response validation. `getCoachingSegments`/timeline helpers associate accepted responses with evidence; playback does not request inference.
- Reuse `startLiveSquat` for MediaStream. Exact cached `onRepComplete` source pixels supply live images. Never send a stream to the file analyzer or substitute a later screenshot for a prior rep bottom.
- Reuse `connectReceiver` and the dedicated phone path; do not expose the provider/OAuth service. Phone side uses authenticated polling; receiver-side streaming stays local. Render the local QR from the supplied private link, never through an external QR service.
- Root persistent-feed adoption is implemented and passed fifteen controlled-provider production-preview checks. Preserve these semantics in subsequent design work. Preserve accepted history on Stop/loss while clearing untrusted **current** values and geometry; new source/session clears history and invalidates late replies. Show observation time separately from delayed arrival.
- Experimental multiview metrics return `status`, `reason`, `confidence`, `unit` and `provenance`; never turn `unavailable` into zero or `estimated` into verified. View guard returns `{state,reason,epoch}`. On epoch change invalidate current metrics, unfinished reps and relative baselines; keep immutable completed-rep in-flight AI in the same source/session and label its eventual card with the original view; consume the integrated `LiveSample` fields `poseDisplayFrame`, `analysisEligible`, `metricValidity`, `multiView` and `viewGuard`; completed `LiveRep` adds `epoch` and up to three exact phase JPEGs.

## Remaining pickup order and blockers

| Priority / owner | Concrete task | Acceptance |
| --- | --- | --- |
| P0 · frontend | Designed one-Start root with stacked feed and readable video | No packet task, short retained cards, expandable reasons, no jumps, accurate timestamps/source reset, accessible narrow layout |
| P0 · integration | Public HTTPS AI return verified; physical rehearsal next | Recorded run proves public media, Heavy, real three-image response and visible returned AI cue; repeat with actual iPhone on venue Wi-Fi |
| P0 · motion/integration | Integrated guard, validity and sparse phase evidence browser-verified | Keep experimental labels; physical-device rehearsal and independent motion accuracy remain |
| P0 · frontend | Implement genuine two-video comparison | Distinct source identities and evidence, same definition/goal, no capture-failure-as-bad-posture story |
| P0 · device QA | Actual iPhone/Mac and venue rehearsal | Permission, connection, motion, feedback, lock/background, disconnect/reconnect, cleanup and measured end-to-end latency |
| P1 · coaching/motion | Phase/trajectory evidence + reference calibration | Versioned bounded contract, correct source pixels, per-view baseline reset and unsupported-motion abstention |
| Research · motion QA | VIEW-3–6 and R-2 accuracy gates | Independent front/oblique/orbit references, prespecified errors/coverage/delay and false-cue limits |
| Final · QA | Full suite, refreshed browser gates and Wren | Exact final build and per-case records; no active fixed-port service conflicting with tests |

**Blocked versus pending:** native OpenCap execution is explicitly deferred for missing runtime/assets. Physical device and independent angle/orbit evidence are missing prerequisites. Public AI return now passes after adaptive-resolution recovery, with a real three-phase request and returned historical card across two Chrome contexts. Physical iPhone remains unverified. Designed frontend and two-source UI are remaining implementation, not external blockers.

## Commands and final QA budget

See [quickstart](docs/quickstart.md) for `npm run demo` and phone mode. Ordinary verification uses Chrome and pinned local assets; no account or Seldon run is needed for controlled-provider tests.

```sh
npm --prefix harness test
CI=1 npm run build
npm --prefix harness run build
npm --prefix harness run verify:coaching-playback
node harness/verify/root-coaching.mjs
node harness/verify/product-readiness.mjs --write
node harness/live/app.browser.test.mjs
```

Some transport/proxy tests bind 4176. Stop owned demo services before those tests; do not kill unrelated processes. Physical-provider/public-HTTPS runs are separate, account-dependent checks.

**Held Wren budget:**16 granted; two harness simulations confirmed used, leaving 14. A later single workbench run `92de42c1-1168-4346-9730-e7d903fe94c4` has debit pending reconciliation, so expected remaining is 13. See [ledger](qa/seldon-ledger.md). Preserve at least four for two final cases and a rerun. User asked to save Seldon until the product is built. Historical smoke/one-case passes do not establish final qualification.

**Live layout review:** [seven checks passed](qa/live-layout.json) on a Vite development surface with fixture playback and inserted representative cards. Desktop1400×900 and1280×800 retain a520px video stage and390px feed through empty/two-card/expanded-Why states. Mobile390×844 retains a405.11px active stage; the first card ends at834.20px, fully inside the viewport. No horizontal overflow or page errors. [Desktop](qa/live-layout-desktop.png) and [mobile](qa/live-layout-mobile.png) screenshots are layout evidence, not camera, provider or physical-phone acceptance.

Frontend spacing update `a402e4e` is preserved: the live wordmark has a 44 px tap target; retain this alongside the newer responsive coaching layout.

**Fresh install acceptance:** [qa/fresh-setup.json](qa/fresh-setup.json) records clean9446951 setup, both locked npm installs, pinned Full/Heavy hashes, four WASM/runtime copies and identical built dist assets, plus TypeScript/Vite build. No services or demo ports were started. Only the analysis computer needs these models; the phone sender does not.

Latest designed root checkpoint (`9446951`): [15 production-preview checks](qa/root-one-start.json) pass. The [user-visible demo](qa/user-visible-demo.json) also ran real Heavy (57/57 tracked samples, two reps) and real GPT-6.1 Sol, showing two retained short cards with Why collapsed. Fresh setup and built asset hashes pass on the same revision. The earlier seven-check real-provider and twenty-check readiness records retain their exact `c1c9378` scope.

## Latest comparison, Safari and setup bundle

- [Comparison amendment](docs/two-recording-comparison-amendment.md) is the frontend contract. **Compare examples** preserves independent source SHA-256, rep/clip/phase references and same-model measurements. Clear/supported examples are different people/cameras, not annotated good/bad labels. A completed A survives B failure; retry processes only the unavailable recording.
- `compareRecordings` and its declaration/example are delivered with seven focused tests. Saved JSON examples explicitly retain imported-unverified association; actual browser analysis binds the original source URLs.
- Upstream Safari decoder fix `6c1bae0` is integrated. Five focused fallback regressions include cancellation after seek and during the callback grace. If Safari omits the callback, fallback timestamps are requested media time, **not confirmed decoded-frame presentation timestamps**.
- Launcher detects missing/version-mismatched direct dependencies and missing runtime/build entry files against both locks. Six launcher tests include stale MediaPipe/QR dependencies and repeated-signal cleanup of owned descendants without affecting unrelated processes.
- Latest local demo remains on port4173, with dedicated phone transport4176. Rebuilding preserves existing assets; active camera/provider services are not restarted. Missing pose assets are prepared on each analysis computer by the launcher; the iPhone sender needs no model files.
- Remaining product gates: physical iPhone/venue rehearsal, independent angle/front/oblique/orbit accuracy, broader temporal-claim validation, final accessibility review and final two Wren cases. Native OpenCap inference stays user-deferred.

**Comparison browser acceptance:** [21 checks pass](qa/two-recording-comparison.json) on merged78569d6 plus the recorded comparison worktree changes: Heavy57/57 and90/90, distinct actual hashes, independent rep/phase clocks, mobile375/390 layout, no AI calls, cancellation/source replacement and retained-A/B-only retry. Requested seek clocks and decoded frame labels are recorded separately; observed phase-frame difference is at most66ms (67ms tolerance), not frame-exact timing proof.

**Published checkpoint65fc875:** the comparison/setup bundle is on main with the incoming Safari fix preserved. TypeScript/build,15 production root lifecycle checks,21 comparison browser checks,99 harness tests and6 launcher tests pass. `workflow.html` and quickstart reflect this delivery. Seldon remains held for the final product/device gates.
