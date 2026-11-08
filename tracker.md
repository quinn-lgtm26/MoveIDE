# MoveIDE global delivery tracker

Updated 2026-11-08 UTC (2026-11-07 Pacific). **Final demo GO pending the combined production verification below.** Main includes the phone/replay repair, paced personal-reference graph and latest homepage. The integrated suite passed137tests (129harness+8launcher/doctor); the persistent ChatGPT header is receiving its own focused checks. Wren passed3/3 on32159db. Later changes require their own final rerun; physical iPhone rehearsal and independent motion accuracy remain separate. Incoming frontend agents: preserve the recorded evidence boundaries and keep the final runtime frozen during Wren.

## Latest runtime checkpoint — `32159db`

Published to main and the existing localhost4173 service without restarting the account or replacing browser storage. [128-test checkpoint](qa/phone-repair-checkpoint.json). [Public production preflight](qa/phone-repair-public-preflight.json) passes12 gates. [Real HTTPS/WebRTC/Heavy/ChatGPT delayed-review regression](qa/phone-queued-review.json) passes: populated graph/angles, returned local feedback, Stop before response, accepted AI about11s later, same saved session and unchanged verified video hash. This used a public fixture stream, not a physical iPhone.

Live graphs, per-rep queue/loading states, retained cards, personal reference comparisons, synchronized saved replay and downloadable operational diagnostics are integrated. [New Seldon review](https://app.seldon.com/experiments/60ba178a-ee4e-469e-a676-57074a9b88ae) passed3/3 on frozen32159db ([report](qa/wren-phone-repair-results.json)). Physical retest GO remains pending final QA; older empty AI notes are not retroactively fabricated.

## Final submission work in progress

The latest user incident has3detected reps and1saved AI review, not1detected rep. Older sessions lack review-state diagnostics, so missing notes cannot be retrospectively diagnosed or fabricated. New code makes every detected rep visible, follows rep/phase citations during replay, shows a full saved metric trace, and distinguishes pending/failed/unavailable review states. The shared coach now receives the disclosed practice goal and asks for Observed/Meaning/Next rep reasoning; single-rep consistency and unsupported good-form claims are prohibited. Native supported rep thresholds are unchanged;3complete plus1unfinished cycle remains3until standing is observed.

Graph polish uses real measured knee/hip/chest data, descent/bottom/return spans, per-rep timing and personal reference; the empty state no longer looks like a measured flat curve. A quick guided tour and [judge setup packet](docs/JUDGES-START-HERE.md) are being integrated with the incoming homepage. BMAD skill runner is unavailable in this checkout (missing `_bmad/scripts/render_skill.py` and sibling installer skill); repo specs and local verification are used without claiming a BMAD runner pass. Final integrated tests, fresh production build, real provider prompt check and final Seldon rerun remain gates before GO.

## Active phone workflow repair

The user's real QR session saved video,128 samples and3 completed reps but no accepted AI notes. This is not a missing-model failure. Saved replay previously kept its measurement selection independent of playback. A separate deterministic reproduction shows the250ms continuity gap can starve stable tracking at slow inference cadence; the saved archive is downsampled and cannot prove that was this session's exact cause. The original run did not retain provider-request diagnostics, so Stop aborting late interpretation remains a hypothesis.

User-approved behavior: local pose/metrics remain immediate; completed-rep AI enters a bounded sequential queue. Stop ends capture and saves replay while the current session's queued work finishes. Show per-rep queued/analyzing/ready/failed states and enrich saved history with accepted results. Browser closure and new sessions must not silently imply all queued work completed. Keep original recordings intact. Integrated local suite now passes128tests (120harness+8launcher/doctor). New checks cover Stop queue drain and same-session storage,12 replay-sync checks,13 History revision checks and11 personal-reference checks. Updated hosted QA and a fresh physical phone rehearsal remain before final phone acceptance.

## Completion audit

Audited `d17cb2a` against the original harness goal and later accepted stories. Runtime is unchanged from Wren-tested `f4a987a`; documentation updates do not rebuild or restart the user's demo.

**Delivered original core:** CAP-1–4 / BE-1–4 have real schema-valid reports, versioned packets and source JPEGs; clear/supported fixtures each detect2/2 reps with bottom errors0/67 ms against labels declared before inference (150 ms tolerance). Both reports, packets and source/report hashes were revalidated. The difficult original fixture remains0/2 with explicit unavailability. Shared APIs/examples, manual developer export, actual optional ChatGPT and the development workflow are delivered. [Fixture evidence](harness/results/fixture-verification.json), [source audit](harness/results/source-timeline-verification.json), [real provider](qa/root-live-chatgpt.json), [workflow](docs/DEVELOPMENT.md).

**The expanded backlog is not complete.** These are implementation tasks, not merely missing physical tests:

| Story / owner | Required remaining work |
| --- | --- |
| FE-6 · frontend | Wire `importOpenCapResult` / `openCapFrameAt` into the root source-bound review UI. Importer tests exist; root UI integration does not. Native inference remains user-deferred. |
| UX-3 · frontend/shared overlay | Add evidence-bound body-region green/amber accents with neutral unavailable state; current shared overlay uses fixed colors. Never paint a historical cue on unrelated current geometry. |
| VIEW-2 · live UX/motion | Add selectable goal/reference setup and stable calibration. Current live target110° and declared side view are fixed illustrative defaults. |
| VIEW-2–5 · motion | Implement automatic view estimation, person/anatomical-side continuity, bounded-latency filtering, body-relative coordinates and frontal phase baselines. Existing continuity heuristic cannot infer view or separate camera motion from athlete motion. |
| TEMP-1 · coaching | Enforce sufficient temporal evidence for sequencing claims; add bottom-only and reversed-sequence negative acceptance. Structure/citation validation and three phase JPEGs alone do not prove claim support. |
| BE-5 · analysis QA | Sequential exact-source-frame decoding and memory profiling remain unfinished. Independent angle annotations, agreement/bias and repeated-capture evaluation require separate reference data. |

**External acceptance:** physical iPhone/Safari and venue streaming/reconnect/recording, measured end-to-end latency, independent front/oblique/orbit accuracy and false-cue rates, and broader accessibility review remain. The two comparison examples are not a labeled same-person good/bad demonstration. Chat, cloud sync, native OpenCap inference and broad movement expansion remain deferred. The scoped demo GO does not certify these items.

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
| Bounded live AI | Exact accepted source pixels cached; one request in flight,≥8 seconds between dispatches, maximum6/session, bounded completed-rep FIFO that drains after Stop | Preserve caps, abort/generation guards and evidence origin during integration |
| Phone pairing, QR and received stream | Dedicated transport + same-origin private receiver proxy; local-generated QR/private link, expiry/late-QR/Stop cleanup; received MediaStream feeds shared Heavy | Real iPhone permission/foreground/lock/reconnect and venue network check |
| Phone return feedback | Real WebRTC data channel carries local feedback and AI captions; independent Chrome-context integration passed | A physical phone has not been verified |
| Trusted HTTPS / long polling | Phone sender long-polls authenticated signaling to avoid quick-tunnel SSE limitation; private receiver stays local | Public HTTPS real WebRTC + Heavy + local and real ChatGPT feedback pass across two Chrome contexts; one three-image request returned in10.209s after adaptive resize. Physical iPhone and venue behavior remain |
| Experimental multiview adapter | `analyzeMultiViewFrame` provides estimated world-XYZ knee/hip angles and front-only signed image-plane knee offsets; six focused tests passed | Integrated as experimental diagnostics with per-metric availability; real frontal/oblique accuracy missing |
| Actual Heavy confidence compatibility | [Browser evidence](harness/motion/multiview-browser-evidence.json):57 frames,1,881 normalized and world points each with observed confidence; left estimates available, occluded right withheld, front proxies withheld on side view | Compatibility/abstention evidence only; not angle-accuracy proof |
| Experimental continuity/view guard | `createViewGuard` integrated into live samples; eight focused tests and combined real-Heavy browser QA passed; real clear fixture49/57 stable without epoch break | Live epochs reset current metric/baseline state, preserve completed-rep history; guard remains an experimental image-continuity heuristic |
| Moving-camera / orbit analysis | UX and VIEW-4/5/6 requirements recorded: identity, anatomical sides, view changes, latency-bound filtering, baseline reacquisition | Automatic viewpoint/identity/filter/calibration implementation remains partial; independent orbit references, false-cue and accuracy benchmarks are also missing |
| Front knee-inward projection | Experimental front-only normalized image-plane offset exists with per-metric reason/confidence/provenance | Person/phase baseline, view stability, independent real frontal labels and cue precision; not clinical valgus |
| Multi-phase AI evidence | `buildLiveCoachBundle` / `selectPhaseEvidence` implemented in `harness/live/motion/phase-evidence.mjs`; four focused tests passed | Live cache wiring and combined browser QA passed: five controlled-provider requests each carried three phase JPEGs; public real-provider request now carries three phase JPEGs (1205/1605/1937ms), returns validated historical coaching; full-motion understanding remains unproven |
| Two different videos | One **Compare examples** action analyzes clear/supported with the same Heavy/Full model; distinct byte hashes, independent reports/reps/clocks, phase navigation, three primary metrics and expanded detail | [Browser evidence](qa/two-recording-comparison.json) covers actual Heavy; no good/bad ground truth or automatic cross-recording AI is claimed |
| OpenCap import | Constructed-data tests and browser File import passed; imported-unverified units/hashes/source rows retained | FE-6 root review integration pending; native inference deferred by user for unavailable runtime/assets/metadata |
| Easy launch | `npm run demo` / launcher and quickstart implemented; six persistent launcher tests passed, plus syntax/helper cleanup/port-refusal checks | Fresh9446951 setup-only auto-installs locked dependencies and pinned models; TypeScript/Vite build and dist asset hashes pass [evidence](qa/fresh-setup.json). Physical phone rehearsal remains; no tunnel by default |
| Final design polish | [11 history replay checks](qa/history-replay-polish.json) pass: video/notes together, stable video size, measurement inspector, slow playback, prefix/gap guards, reduced motion and narrow layout. [10 history accessibility checks](qa/history-accessibility.json) cover focus/routes/keyboard flows. Shared biomechanics logo is integrated | Broad manual contrast, text zoom, screen-reader and physical-device review remain; logo is a movement identity, not gait-support evidence |
| Local history and recordings | Implemented and browser-verified: [22 history journeys](qa/history-root.json), [six lifecycle/recovery checks](qa/history-races.json), [10 storage groups](harness/history/browser-verification.json), real Chrome recorder replay and live save-failure downloads | Physical iPhone codecs/background behavior and real storage-pressure durability remain; no cloud sync or unsaved crash recovery |
| Developer onboarding | README, AI setup prompts, architecture/check matrix, contributor template and doctor delivered. [Fresh efe97bd acceptance](qa/fresh-setup-history.json): initially missing dependencies/assets, automatic setup, TypeScript/Vite build, final doctor and pinned asset hashes passed | Fresh build proof does not test a physical camera/account. Occupied demo services were left untouched |
| Final Wren qualification | [Final report](https://app.seldon.com/experiments/2151c1b9-ae1c-484e-bd25-327cbe64b283) passes 3/3 on frozen `f4a987a`, including both core workflows after rep-button fixes | Scope is public-fixture recorded/history/comparison plus live setup; physical camera remains separate. [Result](qa/wren-final-results.json), [ledger](qa/seldon-ledger.md) |

**Automated-suite status:** latest integrated `npm test` passed 110 harness and eight launcher/doctor tests (118 total), with zero failures, cancellations or skips. The [checkpoint](qa/latest-local-checkpoint.json) records the source/worktree scope. Historical `65fc875` passed 99 harness and six launcher tests. Combined live browser QA passes adaptive resize, historical/fresh-view cards, three phase JPEGs, offline behavior and returned mock-AI via real WebRTC. Test transports use ephemeral ports and cannot touch the running demo. Latest local processing75ms at10.8fps (camera) /8.0fps (browser phone path) is not network latency. [Latest checkpoint](qa/latest-local-checkpoint.json).

**Newest recorded production acceptance:** [15 controlled-provider root checks](qa/root-one-start.json) passed on the prebuilt `f4a987a` root preview at 2026-11-08 00:41 UTC. [22 history checks](qa/history-root.json), [six source/save races](qa/history-races.json), [11 replay-polish checks](qa/history-replay-polish.json), and [22 comparison checks](qa/two-recording-comparison.json) retain their explicit development/worktree scopes. Older real-account results remain separate.

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
| P0 · integration | Public HTTPS AI return verified; physical rehearsal next | Recorded run proves public media, Heavy, real three-image response and visible returned AI cue; repeat with actual iPhone on venue Wi-Fi |
| P0 · motion/integration | Integrated guard, validity and sparse phase evidence browser-verified | Keep experimental labels; physical-device rehearsal and independent motion accuracy remain |
| P1 · design QA | Complete broad accessibility/device review | Keyboard/focus, contrast, text zoom, reduced motion and physical narrow-screen usability; existing responsive fixture checks already pass |
| P0 · device QA | Actual iPhone/Mac and venue rehearsal | Permission, connection, motion, feedback, lock/background, disconnect/reconnect, cleanup and measured end-to-end latency |
| P1 · coaching/motion | Phase/trajectory evidence + reference calibration | Versioned bounded contract, correct source pixels, per-view baseline reset and unsupported-motion abstention |
| Research · motion QA | VIEW-3–6 and R-2 accuracy gates | Independent front/oblique/orbit references, prespecified errors/coverage/delay and false-cue limits |

**Blocked versus pending:** native OpenCap execution is explicitly deferred for missing runtime/assets. Physical device and independent angle/orbit evidence are missing prerequisites. Public AI return now passes after adaptive-resolution recovery, with a real three-phase request and returned historical card across two Chrome contexts. Physical iPhone remains unverified. Recorded/live frontend, local history and two-source example comparison are implemented. FE-6, UX-3, goal/reference setup, VIEW-2–5 and TEMP-1 retain implementation work listed in the completion audit, alongside broader accessibility/device acceptance.

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

**Final Wren status — passed:** [2151c1b9-ae1c-484e-bd25-327cbe64b283](https://app.seldon.com/experiments/2151c1b9-ae1c-484e-bd25-327cbe64b283) passed all three tasks on polished `f4a987a`; zero failures, blockers or timeouts. Both core cases were rerun on this same final build. Account:16 granted,8 used,8 remaining. Persona/usability studies are unavailable on this plan. Wren noted three nonblocking polish observations in [the saved report](qa/wren-final-results.json); physical phone and independent accuracy remain separate.

**Live layout review:** [seven checks passed](qa/live-layout.json) on a Vite development surface with fixture playback and inserted representative cards. Desktop1400×900 and1280×800 retain a520px video stage and390px feed through empty/two-card/expanded-Why states. Mobile390×844 retains a405.11px active stage; the first card ends at834.20px, fully inside the viewport. No horizontal overflow or page errors. [Desktop](qa/live-layout-desktop.png) and [mobile](qa/live-layout-mobile.png) screenshots are layout evidence, not camera, provider or physical-phone acceptance.

Frontend spacing update `a402e4e` is preserved: the live wordmark has a 44 px tap target; retain this alongside the newer responsive coaching layout.

**Fresh install acceptance:** [qa/fresh-setup.json](qa/fresh-setup.json) records clean9446951 setup, both locked npm installs, pinned Full/Heavy hashes, four WASM/runtime copies and identical built dist assets, plus TypeScript/Vite build. No services or demo ports were started. Only the analysis computer needs these models; the phone sender does not.

Historical designed root checkpoint (`9446951`): [15 production-preview checks](qa/root-one-start.json) pass. The [user-visible demo](qa/user-visible-demo.json) also ran real Heavy (57/57 tracked samples, two reps) and real GPT-6.1 Sol, showing two retained short cards with Why collapsed. Fresh setup and built asset hashes pass on the same revision. The earlier seven-check real-provider and twenty-check readiness records retain their exact `c1c9378` scope.

## Latest comparison, Safari and setup bundle

- [Comparison amendment](docs/two-recording-comparison-amendment.md) is the frontend contract. **Compare examples** preserves independent source SHA-256, rep/clip/phase references and same-model measurements. Clear/supported examples are different people/cameras, not annotated good/bad labels. A completed A survives B failure; retry processes only the unavailable recording.
- `compareRecordings` and its declaration/example are delivered with seven focused tests. Saved JSON examples explicitly retain imported-unverified association; actual browser analysis binds the original source URLs.
- Upstream Safari decoder fix `6c1bae0` is integrated. Five focused fallback regressions include cancellation after seek and during the callback grace. If Safari omits the callback, fallback timestamps are requested media time, **not confirmed decoded-frame presentation timestamps**.
- Launcher detects missing/version-mismatched direct dependencies and missing runtime/build entry files against both locks. Six launcher tests include stale MediaPipe/QR dependencies and repeated-signal cleanup of owned descendants without affecting unrelated processes.
- Latest local demo remains on port4173, with dedicated phone transport4176. Rebuilding preserves existing assets; active camera/provider services are not restarted. Missing pose assets are prepared on each analysis computer by the launcher; the iPhone sender needs no model files.
- Remaining product gates: physical iPhone/venue rehearsal, independent angle/front/oblique/orbit accuracy, broader temporal-claim validation, broader accessibility review; final Wren task cases now pass. Native OpenCap inference stays user-deferred.

**Comparison browser acceptance:** [21 checks pass](qa/two-recording-comparison.json) on merged78569d6 plus the recorded comparison worktree changes: Heavy57/57 and90/90, distinct actual hashes, independent rep/phase clocks, mobile375/390 layout, no AI calls, cancellation/source replacement and retained-A/B-only retry. Requested seek clocks and decoded frame labels are recorded separately; observed phase-frame difference is at most66ms (67ms tolerance), not frame-exact timing proof.

**Published checkpoint65fc875:** the comparison/setup bundle is on main with the incoming Safari fix preserved. TypeScript/build,15 production root lifecycle checks,21 comparison browser checks,99 harness tests and6 launcher tests pass. `workflow.html` and quickstart reflect this delivery. That historical checkpoint did not establish final Wren qualification; the final polished product run now passes 3/3.

## Local history and developer onboarding — verified local bundle

Local-only persistence is implemented. [HIST-1–5](docs/HISTORY.md) have scoped browser acceptance: 22 recorded/live history checks, six save/source/recovery races and 10 atomic-storage groups. Live Stop saves original video, bounded measurements, accepted notes and exact retained JPEGs. Save failures expose downloads/retry; recorded failures survive storage management without reanalysis. Live video timing is approximate and may cover only a bounded prefix.

[Fresh setup evidence](qa/fresh-setup-history.json) starts from an `efe97bd` worktree without either dependency tree, pose assets or dist. Automatic locked installs, Full/Heavy SHA-256 verification, four WASM files, TypeScript/Vite build and a final read-only doctor passed. Its occupied-port/health observations belonged to the already-running demo, not a runtime test of the fresh build. No services or camera were started by that setup check.

## Full-product remaining checklist

- [x] Local history, replay without inference, search/rename/delete, exports, opt-out and bounded live recording.
- [x] Stop retains recording, full accepted coaching and historical measurements until New Start; source selection alone preserves review. Opt-out supports bounded temporary replay without persistence.
- [x] History video/notes layout, measurement inspector and slow playback; approximate timing/prefix guards, reduced motion, shared biomechanics logo and visible comparison rep buttons.
- [x] Save/source races and storage-management recovery; recording-unavailable fallback and unsaved download recovery.
- [x] Fresh dependency/model setup, production build and read-only doctor; current root coaching lifecycle checks.
- [x] Final Seldon/Wren:3/3 on `f4a987a`, both core workflows rerun after fixes; debit reconciled,8 simulations remain.
- [ ] Physical iPhone → Mac on venue Wi-Fi: camera permission, codec/orientation, foreground/background/lock, reconnect, recording playback, return captions and end-to-end delay.
- [x] Scoped history focus/keyboard navigation, responsive layout and reduced-motion replay checks.
- [ ] Broader manual accessibility: contrast, 200% text zoom and screen-reader/device review beyond the scoped passing checks.
- [ ] Independent side/front/oblique/orbit angle references, identity/left-right continuity, false-cue rates and temporal-claim validation. No perfect-squat or arbitrary-angle accuracy claim before these pass.
- [ ] If scope resumes: real dual-upload/cross-recording AI and native OpenCap inference require separate implementation/runtime/asset/accuracy gates. Current example comparison and imported-unverified OpenCap support remain available.

Cloud sync and recovery of a recording lost before Stop are outside the chosen local-only demo scope.

## Polished replay and scope hold — f4a987a

Live Stop releases camera/peer/worker resources and clears current geometry while preserving the finished video, accepted cards and seven historical metric fields for review. Recording and analysis clocks remain approximate; no frame-exact live overlay is invented. New Start or leaving clears the temporary replay URL; changing the source selector alone does not. A recording error withholds incomplete bytes, while metadata/notes and failure downloads remain available.

History keeps video and notes together, supports slower playback and a measurement inspector, and respects reduced motion. Approximate note-to-video links abstain outside the recorded prefix or across unsupported gaps. The small biomechanics mark is a broader movement identity; currently supported analysis remains the disclosed squat workflow, not gait or arbitrary movement analysis.

**Chat is on hold.** No new chat UI, conversation endpoint or chat feature is part of this delivery. Continue the existing bounded evidence-linked coaching flow. Full local suite: 110 harness + eight launcher/doctor tests. The suite covers product behavior represented by `f4a987a`; the final Stop-before-closing guidance was added afterward as a copy-only change. The final Wren rerun subsequently passed3/3 on the exact polished build.

## Hands-on test release

Open the refreshed local app at http://127.0.0.1:4173/. Try the sample, play both reps, reopen History and reload; real AI notes are retained without another inference. Then start a live session, perform a few reps, and press Stop: the recording, historical measurements and full accepted coaching remain until the next Start. Use a newly generated phone QR. The current public phone page returns200 and private provider routes404. Nine real ChatGPT production checks include History/reload preservation.

Nonblocking Wren follow-ups: clearer restore banner, optional session-title filenames for original-video exports, and end-of-clip replay feedback. Broader manual accessibility, physical iPhone/venue behavior and independent angle/orbit accuracy are still explicit acceptance work. History chat remains on hold.

## Homepage at `/` (2026-11-07, Claude, uncommitted)
- New `src/Home.tsx`: a hero section with "Try a sample squat" / "Compare examples" plus a compare screenshot. Recorded review moved to `/#review`. Nav and harness links were updated, and so was seldon.yml step 1 (validated: 3 cases ok).
- Evidence: `tsc --noEmit` passes. At 390px there is no horizontal overflow. Better Design inspect-spacing at 1440 is completed: 0 serious, 7 moderate (shared header/button tokens, left as is). Comprehension has 1 borderline finding (17s vs 15s target), and the GitHub link was kept on purpose.
- The predev `git pull` is blocked by conflicts with pre-existing local edits. The `web-nopull` launch config was used instead.

### Homepage comparison graph (2026-11-07)
- `src/Home.tsx` adds "Good vs bad squat, measured" below the hero: static SVG of knee bend through rep 1 (Good vs Bad example) plus a joint-angle table (knee 117° vs 127°, chest 41° vs 46°, rep 1.4 s vs 1.3 s).
- Data captured from the live Compare examples run in the browser (matches its Rep measurements table); hardcoded, refresh by rerunning compare.
- Evidence: `tsc --noEmit` clean; rendered at desktop and 375px with no horizontal overflow. Full inspect-spacing/comprehension pass skipped for speed.
