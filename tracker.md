# MoveIDE global delivery tracker

Updated 2026-11-07; incorporates frontend through `747ca8a` (trace/replay controls and deferred Movement Charter). **Read this first when picking up the product.** This file is the cross-agent source of truth; update the status and evidence whenever work changes. A merged implementation is not automatically a verified product workflow.

## Current product decision

One **Start coached squat** action coordinates capture/video playback, MediaPipe Heavy tracking, measurements, evidence extraction, shared coaching principles, automatic AI requests and timestamp-linked feedback. Account and camera permissions are one-time setup. Packet preview/copy/export belongs in developer details. Do not add a separate Generate/Send/Handoff step to the normal experience.

Current priority: finish squat review, an honest two-video comparison, then iPhone → MacBook live squat coaching on the same Wi-Fi. Native OpenCap inference and broad movement coverage are deferred. The OpenCap import adapter remains available, explicitly imported/unverified.

Read [AI amendments](AI-AMENDMENTS.md), [frontend API amendment](docs/frontend-harness-amendments.md), [live product stories](_bmad-output/specs/live-squat-product.md), [frontend integration guide](harness/FRONTEND-HANDOFF.md), and [demo runbook](docs/live-squat-demo.md). The generated [workflow dashboard](workflow.html) is a summary; this tracker owns actionable status.

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

## Remaining work, in pickup order

| Priority / owner | Work | Done means |
| --- | --- | --- |
| P0 · frontend/integration | Finish root one-Start acceptance and polish; align actual root build with smoke behavior | Connected Start → Heavy → exact evidence → AI → matching-rep playback, without packet actions; offline mode honest; Stop/source replacement rejects late results |
| P0 · frontend | Bring live session into the primary product navigation | One obvious session entry; choose recorded/live source; reuse existing `startLiveSquat` and provider APIs rather than rebuild them |
| P0 · frontend | Two **different video** comparison | Clear and supported source clips retain distinct source/report identities; per-source seeks and images verified; illustrative 110° projected target clearly disclosed; green/amber never presented as clinical correctness |
| P0 · integration | Wire received phone `MediaStream` into the existing live page/session | `connectReceiver(...,{onStream})` feeds the same Heavy controller; no seekable-file analyzer used on a stream; Stop ends peer, camera and analysis |
| P0 · device QA | iPhone + Mac same-Wi-Fi physical check | Trusted HTTPS phone camera page; permission, connect, motion, disconnect/reconnect, latency and stop tested on actual hardware. Continuity Camera is an alternative source, not yet hardware-verified |
| P1 · frontend | Concise coaching presentation and target indication | One readable current rep cue; fuller reasoning expandable; local measurements vs local target feedback vs AI narration distinguishable; stale pose (>500 ms live) clears geometry/numbers |
| P1 · integration QA | Refresh old readiness probe and baseline expectations | Use Start journey; developer-copy is optional, not a required product step. Preserve old historical evidence; write a new result for the exact final build |
| Final · QA owner | Wren/Seldon final acceptance | Both stable core case IDs run against the same reachable final build, fix issues and rerun, record experiment/case verdicts and actual debit |

**Held QA budget:** last confirmed balance was 14 after two harness cases. The newly merged frontend ledger records one additional workbench run (`92de42c1-1168-4346-9730-e7d903fe94c4`), debit pending; expected remaining balance is 13. Reconcile before any dispatch. User requested Seldon after the product is built. Do not spend runs merely to validate this handoff. Follow `AI.md` and `qa/seldon-ledger.md`; never expose the credential-bearing local provider through a tunnel.

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
