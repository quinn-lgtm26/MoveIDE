# MoveIDE global delivery tracker

Updated 2026-11-07; incorporates frontend through `747ca8a` (trace/replay controls and deferred Movement Charter). **Read this first when picking up the product.** This file is the cross-agent source of truth; update the status and evidence whenever work changes. A merged implementation is not automatically a verified product workflow.

## Current product decision

One **Start coached squat** action coordinates capture/video playback, MediaPipe Heavy tracking, measurements, evidence extraction, shared coaching principles, automatic AI requests and timestamp-linked feedback. Account and camera permissions are one-time setup. Packet preview/copy/export belongs in developer details. Do not add a separate Generate/Send/Handoff step to the normal experience.

Current priority: a simple one-Start squat coach with a persistent timestamped cue feed, full-body visualization, two-video comparison, and iPhone → MacBook live video with feedback returned to the phone. The requested target now includes a camera moving around the person during squats; view-aware stability and independently verified cross-view measurements are required before claiming that capability. Native OpenCap inference and broad movement coverage are deferred. The OpenCap import adapter remains available, explicitly imported/unverified.

Read [AI amendments](AI-AMENDMENTS.md), [frontend API amendment](docs/frontend-harness-amendments.md), [complete UX amendment](docs/frontend-design-amendments.md), [live product stories](_bmad-output/specs/live-squat-product.md), [frontend integration guide](harness/FRONTEND-HANDOFF.md), and [demo runbook](docs/live-squat-demo.md). The generated [workflow dashboard](workflow.html) is a summary; this tracker owns actionable status.

## Delivered and evidence

| Item | Status | Evidence / location |
| --- | --- | --- |
| Shared Heavy analysis in root frontend | Merged in PR #13, `e5dea78` | `src/analyze.ts`, `src/App.tsx`; no duplicate geometry engine |
| Heavy, full pose exports, source-timed metrics, OpenCap import | Implemented, fixture/browser verified | `harness/motion/`, `harness/results/`, `harness/opencap/` |
| One-Start sample review | Implemented; real Heavy + real ChatGPT verified | `harness/smoke/`; `qa/one-start-heavy-live.json`, screenshot alongside |
| Real AI evidence from current clear fixture | Passed 2026-11-07 | GPT-6.1 Sol; exactly one request; six measurements and JPEGs at 1067/3000 ms; validated citations and visible playback cue |
| Playback reuse and evidence navigation | Browser verified with controlled provider | `harness/verify/coaching-playback.mjs`; no new inference on play/seek |
| Root one-Start automatic AI | Implemented in this increment; Chrome root acceptance passed with controlled provider | `src/App.tsx`, `src/Compare.tsx`; 8 checks cover offline behavior, automatic AI, replay, Stop, source replacement and races |
| Manual Generate panel removed | Done 2026-11-07; `src/Coach.tsx` deleted so developer tools only preview/copy/export (nothing sent) | typecheck clean, 54/54 tests, `root-coaching.mjs` 8/8 on the resulting main |
| Live Heavy engine | Browser verified with real-clip `captureStream` | `harness/live/motion/`; bounded frame/JPEG cache, one inference in flight, no queued frames |
| Live local camera page + automatic per-rep AI | Implemented; synthetic-camera UI and controlled-provider test passed | `harness/live/`; local camera only on Start; Stop releases tracks and aborts requests |
| Live AI rate/evidence bounds | Implemented | Max 6 requests/session, ≥8 seconds between starts, one in flight; skip while busy; only exact cached completed-rep pixels |
| Phone signaling and video transport | Implemented; two independent Chrome contexts verified | `harness/live/transport/`; pixel decode, expiry, role isolation and Stop cleanup tested |
| Shared automated suite | 54 tests passed in final local suite | `npm --prefix harness test` (includes real browser transport test) |
| Product specialist review + revised stories | Written | `_bmad-output/specs/live-squat-product.md`, `docs/live-squat-demo.md` |

Local live-engine processing benchmark: 37 processed frames, 72 dropped while busy, mean 76.8 ms/max 164.6 ms. Two reps reconstructed; only one stabilized completion event because the clip ends before later samples confirm the last rep. **Not an iPhone end-to-end latency result or independent joint-angle accuracy benchmark.**

## Full product feature inventory — latest requested scope

Status is evidence-based: **verified** names the actual tested surface; **implemented** still needs broader acceptance; **in progress** is not shipped; **research gate** is a required capability without adequate accuracy evidence yet.

| Feature / owner | Status | Acceptance / next action |
| --- | --- | --- |
| One Start for video, measurements and AI / integration | Verified in smoke and root product with real ChatGPT | `qa/root-live-chatgpt.json`; one actual request, both rep cues visible, no inference on seek |
| Persistent coaching feed / frontend + harness | In progress; replaces disappearing paragraph panel | New short timestamped cards stack; previous cards remain; Why expands reasoning; rewind never duplicates; new session resets |
| Concise actionable output / coaching | In progress | Next focus ≤12 words requested by versioned presentation policy; max three short observations; no invented posture fault, no unsupported core/spine diagnosis |
| Whole-body skeleton / motion | Implemented; five focused overlay checks passed | Both arms, torso, both legs, hands/feet when visible; uncertain joints dimmed or omitted; no fabricated occluded geometry |
| Camera moving/orbiting around squatting person / motion | Required target — **not verified** | Detect continuity/view changes, preserve person identity, handle left/right assignment changes, gate each metric, reacquire rather than carry stale baselines |
| View-change/temporal stability guard / motion | In progress prototype | Conservative image-geometry continuity guard, epoch reset, stable dwell; cannot itself establish true camera motion or calibrated 3D tracking |
| Estimated 3D knee/hip geometry / motion | In progress experimental adapter | Both sides from world XYZ; rotation/scale/missing-data tests; label estimated and uncalibrated; independent real-camera accuracy still required |
| Front-facing knee inward trend / motion | In progress experimental diagnostic | Signed image-plane offset relative to hip/ankle line with units/confidence; front-only; baseline/camera/visibility gates; not clinical valgus |
| Oblique-view and arbitrary-angle measurements / motion research | Research gate | Separate from side-validated protocol; independent labeled front/oblique/orbit captures needed; full body in frame does not prove angle accuracy |
| Multi-phase visual AI evidence / coaching | Planned requirement | Provide bounded descent/bottom/ascent evidence and trajectory summaries; current real AI checks used bottom JPEGs only, so no full-motion visual understanding claim |
| Phone video → Heavy → feedback/AI → phone / integration | Implemented; separate Chrome contexts passed | Actual WebRTC, source-pixel evidence, bounded AI, persistent phone AI caption; physical iPhone still required |
| Pairing and easy setup / integration | Implemented; browser verification passed | One Start creates local QR/private link; phone permission then automatic analysis; expiry, Stop and stale invitation cleanup |
| HTTPS phone signaling / integration | In progress public endpoint verification | Phone long polling avoids temporary tunnel SSE limitation; provider stays private on4173, dedicated phone service4176 only |
| Session orchestration / harness | Local/browser verified | One pose frame in flight, no frame backlog; one AI request in flight,≥8s spacing,6/session cap; cancel/source/Stop rejects stale work |
| Two genuinely different videos / frontend | Remaining | Distinct source/report identities, synchronized evidence, disclosed comparison target; not two reps mislabeled as two videos |
| Main UI polish / frontend | Design handoff supplied; acceptance remaining | Video and feed visible together, restrained metrics, stable layout, no technical packet steps, accessible controls, mobile sender feedback |
| One-command local launch / integration | Remaining | Install pinned dependencies/assets and launch private app + dedicated signaling with readiness checks and simple recovery; no secrets in configuration committed to Git |
| Independent accuracy benchmark / QA | Missing | Rep-count/timing evidence exists; anatomical angle truth and moving-camera ground truth do not |
| Final two-workflow Wren run / QA | Held | Exact final integrated build, both stable core workflow IDs, reconcile budget first; no claim of hackathon qualification until recorded |

The frontend must expose the latest capability state honestly. Capture or view uncertainty should clear **current** untrusted geometry/measurements while retaining past accepted coaching cards labeled with their source rep/time. Do not present a past cue as a current-frame measurement.

## Remaining work, in pickup order

| Priority / owner | Work | Done means |
| --- | --- | --- |
| P0 · frontend/integration | Finish root one-Start acceptance and polish; align actual root build with smoke behavior | Connected Start → Heavy → exact evidence → AI → matching-rep playback, without packet actions; offline mode honest; Stop/source replacement rejects late results |
| P0 · frontend | Bring live session into the primary product navigation | One obvious session entry; choose recorded/live source; reuse existing `startLiveSquat` and provider APIs rather than rebuild them |
| P0 · frontend | Two **different video** comparison | Clear and supported source clips retain distinct source/report identities; per-source seeks and images verified; illustrative 110° projected target clearly disclosed; green/amber never presented as clinical correctness |
| P0 · integration | Received phone stream is wired; finish actual HTTPS/device acceptance | `connectReceiver(...,{onStream})` feeds the same Heavy controller; no seekable-file analyzer used on a stream; Stop ends peer, camera and analysis |
| P0 · device QA | iPhone + Mac same-Wi-Fi physical check | Trusted HTTPS phone camera page; permission, connect, motion, disconnect/reconnect, latency and stop tested on actual hardware. Continuity Camera is an alternative source, not yet hardware-verified |
| P1 · frontend | Concise coaching presentation and target indication | Short timestamped cues append and remain in a bounded session feed; fuller reasoning expandable; local measurements vs local target feedback vs AI narration distinguishable; stale pose (>500 ms live) clears geometry/numbers |
| P1 · integration QA | Refresh old readiness probe and baseline expectations | Use Start journey; developer-copy is optional, not a required product step. Preserve old historical evidence; write a new result for the exact final build |
| Final · QA owner | Wren/Seldon final acceptance | Both stable core case IDs run against the same reachable final build, fix issues and rerun, record experiment/case verdicts and actual debit |

**Held QA budget:** last confirmed balance was 14 after two harness cases. The newly merged frontend ledger records one additional workbench run (`92de42c1-1168-4346-9730-e7d903fe94c4`), debit pending; expected remaining balance is 13. Reconcile before any dispatch. User requested Seldon after the product is built. Do not spend runs merely to validate this handoff. Follow `AI.md` and `qa/seldon-ledger.md`; never expose the credential-bearing local provider through a tunnel.

The main root recorded-video readiness probe now passes20 scoped checks; the exact physical-phone/moving-camera and final Wren gates above remain open. The older failed product audit is archived under `qa/archive/`.

## Entry points and commands

```sh
npm --prefix harness ci
npm --prefix harness test
npm --prefix harness run build
npm --prefix harness run verify:build
npm --prefix harness run verify:coaching-playback
node harness/live/app.browser.test.mjs
node harness/live/motion/verify-browser.mjs
```

The ordinary test/build commands do not need ChatGPT credentials. Browser checks use Chrome and pinned local pose assets.

```sh
# Local signed-in review; credentials remain private to the local service.
MOVEIDE_ENABLE_CHATGPT=1 npm --prefix harness run start:local
# Visit /harness/smoke/ or /harness/live/ on http://127.0.0.1:4173
# Explicit real-provider check, consumes the connected plan:
node harness/verify/one-start-live.mjs

# Root product (avoid the development prebuild git-pull hook in CI/worktrees):
npm ci
CI=1 npm run build
npm run typecheck
node harness/verify/root-coaching.mjs

# Separate credential-free signaling service; defaults to loopback4176:
node harness/live/transport/server.mjs
```

Read the transport README before configuring a trusted HTTPS origin. Same Wi-Fi alone does not make a plain HTTP LAN URL camera-capable on iPhone. Do not tunnel port4173 or publish OAuth credentials.

## Coordination rules

- Pull/rebase latest `main` before starting; publish focused changes to `quinn-lgtm26/MoveIDE`. User has authorized updates to `main`. Never force-push over another agent’s commits.
- Claim the relevant item above with your branch/owner before editing shared UI. Current implementation separates root frontend, smoke reference, live motion, and credential-free transport for ownership; these are internal modules, not required user steps.
- Update this tracker, the AI amendment if contracts change, and `workflow.html` after verification. Record **implemented**, **mock-verified**, **real-provider verified**, and **physical-device verified** separately.
- Local models provide estimated projected angles. No universal good-squat score, clinical safety verdict, calibrated 3D accuracy, or native OpenCap success is established.
- Keep keys, session files, dependency symlinks, model binaries and temporary output out of commits. Model assets are installed from the pinned setup script.
