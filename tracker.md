# MoveIDE global delivery tracker

Updated 2026-11-08 UTC (2026-11-07 Pacific). Latest local acceptance covers `efe97bd` plus documented worktree changes: history/recovery, onboarding and production-preview coaching passed. Final Seldon/Wren qualification is in progress; final verdicts are pending. **Incoming frontend agent: read this first.** This tracker distinguishes implemented code, the surface actually verified, and remaining acceptance. Later commits do not inherit an earlier build's final-QA status automatically.

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
| Plain-language UX pass (P0) | Recorded, compare and live copy rewritten for lifters: form check shown in seconds, a specific reason when tracking pauses, "Try a sample squat" / "Upload your squat video", model/2D/local badges hidden, metrics renamed (Depth (knee bend), Hip hinge, Chest angle, Coach notes), rep names "Rep 1", times in seconds, degrees with no decimals, "See the moment" evidence links, one ⓘ estimate caveat, "same" in place of -0 differences. Gates on this tree: npm test 99/99 + 6/6, tsc and build OK, product-readiness, two-recordings and root-coaching passed (verifier copy updated); manual browser check at desktop and 375 px, no overflow | Better Design review run after P0 (see the row below); root-live-chatgpt not rerun (needs a live ChatGPT account) |
| Better Design review (post-P0) | Ran get-review-rules, check-comprehension and inspect-spacing on the rendered root (idle, sample loaded, Compare examples) and Live (idle) pages at 1440, 1728 and 390. **Comprehension:** root idle and Live idle pass. Loaded root went from 192 words, ~96 s and 10 actions to 90 words, ~42 s and 5 actions. Compare examples went from ~140 words and 4 actions to 58 words, ~22 s and 2 actions. **Spacing:** serious findings went from root-loaded 36 / root-idle 3 / root-compare 8 / Live 5 to 0 / 0 / 0 / 0, with moderate findings only. Fixes: every `summary` has a 44 px hit area; mobile Compare cells wrap; comparison cards share one 14 px text edge; the Live page on mobile uses one 24 px column rhythm; the "Save on this device/computer" checkbox is a 44 px custom control that draws an 18 px box. | Remaining serious comprehension findings: loaded root still needs ~42 s because the controls the tests require and the data table stay; the comparison is still ~22 s, which we accept. The Live page during a running camera session was not reviewed (it needs a camera). The checkbox focus ring and the moderate spacing findings were not visually signed off on a phone |
| Better Design review: Live page after upstream merge | Merged f4a987a (kept Wren's Live redesign). Live idle copy trimmed 263→183 words: shorter start disclosure, empty state, depth-goal legend, save status and notes placeholder; removed footer paragraph and the footer link duplicating the Recorded clip tab. Spacing: #empty gap and footer hit area fixed; Live idle 0 serious, 13 moderate. Residual: comprehension still flags 183 words / 4 actions (3 are nav tabs; the rest is metric labels), accepted. npm test, build, product-readiness, root-coaching, two-recordings, history-root/races/accessibility pass. one-start-live not run (needs provider on :4173). Note: copy changed after the final Wren 3/3 build; no paid rerun spent. | Done |
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
| Local history and recordings | Implemented and browser-verified: [22 history journeys](qa/history-root.json), [six lifecycle/recovery checks](qa/history-races.json), [10 storage groups](harness/history/browser-verification.json), real Chrome recorder replay and live save-failure downloads | Physical iPhone codecs/background behavior and real storage-pressure durability remain; no cloud sync or unsaved crash recovery |
| Developer onboarding | README, AI setup prompts, architecture/check matrix, contributor template and doctor delivered. [Fresh efe97bd acceptance](qa/fresh-setup-history.json): initially missing dependencies/assets, automatic setup, TypeScript/Vite build, final doctor and pinned asset hashes passed | Fresh build proof does not test a physical camera/account. Occupied demo services were left untouched |
| Final Wren qualification | User authorized full product QA now; final-build baseline/run preparation is in progress | Two final core-workflow verdicts, build identity and actual debit still pending; [ledger](qa/seldon-ledger.md) is authoritative |

**Automated-suite status:** latest integrated `npm test` passed 109 harness and eight launcher/doctor tests (117 total), with zero failures, cancellations or skips. The [checkpoint](qa/latest-local-checkpoint.json) records the source/worktree scope. Historical `65fc875` passed 99 harness and six launcher tests. Combined live browser QA passes adaptive resize, historical/fresh-view cards, three phase JPEGs, offline behavior and returned mock-AI via real WebRTC. Test transports use ephemeral ports and cannot touch the running demo. Latest local processing78ms at9.9fps (camera) /7.2fps (browser phone path) is not network latency. [Latest checkpoint](qa/latest-local-checkpoint.json).

**Newest recorded production acceptance:** [15 controlled-provider checks](qa/root-one-start.json) passed on the prebuilt root preview from `efe97bd` plus worktree changes, recorded at 2026-11-08 00:16 UTC. [22 history checks](qa/history-root.json) and [six source/save races](qa/history-races.json) passed on isolated development surfaces. Earlier real-account and readiness results retain their original revisions; these newer mock-provider tests do not replace account or physical-device acceptance.

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
| P0 · final QA | Run Seldon on the integrated product | Two core workflows on one identified final build; retain per-case verdicts and rerun fixes |
| P0 · integration | Public HTTPS AI return verified; physical rehearsal next | Recorded run proves public media, Heavy, real three-image response and visible returned AI cue; repeat with actual iPhone on venue Wi-Fi |
| P0 · motion/integration | Integrated guard, validity and sparse phase evidence browser-verified | Keep experimental labels; physical-device rehearsal and independent motion accuracy remain |
| P1 · design QA | Complete broad accessibility/device review | Keyboard/focus, contrast, text zoom, reduced motion and physical narrow-screen usability; existing responsive fixture checks already pass |
| P0 · device QA | Actual iPhone/Mac and venue rehearsal | Permission, connection, motion, feedback, lock/background, disconnect/reconnect, cleanup and measured end-to-end latency |
| P1 · coaching/motion | Phase/trajectory evidence + reference calibration | Versioned bounded contract, correct source pixels, per-view baseline reset and unsupported-motion abstention |
| Research · motion QA | VIEW-3–6 and R-2 accuracy gates | Independent front/oblique/orbit references, prespecified errors/coverage/delay and false-cue limits |
| Final · QA | Full suite, refreshed browser gates and Wren | Exact final build and per-case records; no active fixed-port service conflicting with tests |

**Blocked versus pending:** native OpenCap execution is explicitly deferred for missing runtime/assets. Physical device and independent angle/orbit evidence are missing prerequisites. Public AI return now passes after adaptive-resolution recovery, with a real three-phase request and returned historical card across two Chrome contexts. Physical iPhone remains unverified. Recorded/live frontend, local history and two-source example comparison are implemented; remaining design work is broader accessibility and device acceptance.

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

Transport/proxy regression tests use ephemeral ports. Leave the user’s active demo and unrelated processes untouched; run Heavy/GPU browser suites serially. Physical-provider/public-HTTPS runs are separate, account-dependent checks.

**Final Wren status — in progress:** the user has now requested Seldon/full product QA. The earlier hold is superseded. Run preparation and final verdict collection are pending; do not label the product qualified from historical smoke runs. Reconcile actual balance/debit and retain final build, experiment and per-workflow results in the [ledger](qa/seldon-ledger.md).

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

**Published checkpoint65fc875:** the comparison/setup bundle is on main with the incoming Safari fix preserved. TypeScript/build,15 production root lifecycle checks,21 comparison browser checks,99 harness tests and6 launcher tests pass. `workflow.html` and quickstart reflect this delivery. That historical checkpoint did not establish final Wren qualification; the current final-product run is in progress.

## Local history and developer onboarding — verified local bundle

Local-only persistence is implemented. [HIST-1–5](docs/HISTORY.md) have scoped browser acceptance: 22 recorded/live history checks, six save/source/recovery races and 10 atomic-storage groups. Live Stop saves original video, bounded measurements, accepted notes and exact retained JPEGs. Save failures expose downloads/retry; recorded failures survive storage management without reanalysis. Live video timing is approximate and may cover only a bounded prefix.

[Fresh setup evidence](qa/fresh-setup-history.json) starts from an `efe97bd` worktree without either dependency tree, pose assets or dist. Automatic locked installs, Full/Heavy SHA-256 verification, four WASM files, TypeScript/Vite build and a final read-only doctor passed. Its occupied-port/health observations belonged to the already-running demo, not a runtime test of the fresh build. No services or camera were started by that setup check.

## Full-product remaining checklist

- [x] Local history, replay without inference, search/rename/delete, exports, opt-out and bounded live recording.
- [x] Save/source races and storage-management recovery; recording-unavailable fallback and unsaved download recovery.
- [x] Fresh dependency/model setup, production build and read-only doctor; current root coaching lifecycle checks.
- [ ] Final Seldon/Wren verdicts for both core workflows on the same submitted build; record actual debit and rerun any fixes.
- [ ] Physical iPhone → Mac on venue Wi-Fi: camera permission, codec/orientation, foreground/background/lock, reconnect, recording playback, return captions and end-to-end delay.
- [ ] Broader accessibility review: keyboard/focus, contrast, text zoom and reduced motion, beyond the passing responsive fixture checks.
- [ ] Independent side/front/oblique/orbit angle references, identity/left-right continuity, false-cue rates and temporal-claim validation. No perfect-squat or arbitrary-angle accuracy claim before these pass.
- [ ] If scope resumes: real dual-upload/cross-recording AI and native OpenCap inference require separate implementation/runtime/asset/accuracy gates. Current example comparison and imported-unverified OpenCap support remain available.

Cloud sync and recovery of a recording lost before Stop are outside the chosen local-only demo scope.
