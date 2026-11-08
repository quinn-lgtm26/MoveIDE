# Seldon simulation ledger

- Hackathon allocation · **16 simulations**
- Current connected account, reconciled 2026-11-07 · **16 granted, 8 used, 0 pending, 8 remaining**. The older frontend run is not visible under this API key and is tracked separately; do not subtract an unconfirmed cross-account debit.
- Account balance at first preflight on 2026-11-07 · **16 granted, 0 used, 0 pending, 16 remaining**
- Final-build reserve · **4 simulations**, including room to rerun both workflows if the verified debit allows

A local check or a YAML validation is not evidence of a hosted simulation. After each dispatch, record the confirmed debit and the account balance. Treat pending debits as reserved until they reconcile.

Seldon MCP validated both cases in the [workbench baseline](../seldon.yml) and both in the [harness baseline](seldon-harness.yml). The workspace is on the usage tier. The Seldon CLI's `get_task_balance` returned the balance above, and `list_baseline_runs` returned no prior QA runs. A harness run with two cases in one browser reserves two simulations and leaves at least 14 available from this preflight. [Seldon Wren billing units](https://www.seldon.com/pricing)

## Dispatch record

Append one entry per dispatch. Include date, purpose, target and build ID, selected case or persona IDs, reserved and confirmed simulation debit, experiment or run ID, report and summary references, verdicts, and the next action. For the final submission, identify the single final build that both core verdicts cover.

### 2026-11-07 · Harness smoke QA

- Target · Static HTTPS copy of the public fixture harness at `https://categories-spoken-fee-ashley.trycloudflare.com/harness/smoke/`. Chrome preflight exercised both journeys, checked the downloaded 90-frame AnalysisReport and clipboard, and confirmed the native provider routes return 404.
- Build · `2a6511f62ee3018606c8ee19ea009350a41712ee`, static manifest SHA-256 `ca5d271d430301eef1f7b43f627107a66da1f6aada351194931f2665be877c1c`.
- Cases · `harness-measure-squat` and `harness-coaching-handoff`.
- Expected debit · **2 simulations**. Account immediately before dispatch · 16 granted, 0 used, 0 pending, 16 remaining. Expected remaining after run · 14.
- Seldon experiment · `9c9dabb7-9f02-4925-88e2-56eb9172b505`. Both browser runs finished at 13:30 Pacific on November 7, 2026. [Seldon report and summary](https://app.seldon.com/experiments/9c9dabb7-9f02-4925-88e2-56eb9172b505)
- Report · `get_report` returned **2 passed**, with zero failures, blocked cases or timeouts. `harness-measure-squat` passed in 86.892 seconds and `harness-coaching-handoff` passed in 173.032 seconds.
- Summary · `get_summary` confirmed two complete reps with displayed knee-flexion estimates and a report download. It also confirmed both timestamped preview frames and a usable manual handoff without an account. The run evaluated browser behavior and the fixture outputs.
- Actual debit · **2 simulations**. Official account balance after the run · 16 granted, 2 used, 0 pending, 14 remaining.
- Follow-up · Run the separate [workbench baseline](../seldon.yml) against the reachable integrated frontend and retain at least four simulations for the final build and a rerun.


### 2026-11-07 · Workbench dispatch · measure-squat

- Target · `http://localhost:5173` via Seldon tunnel · build `2e0d55e` (`feat/frontend-workbench`, clean tree)
- Cases · `measure-squat` only. `compare-and-handoff` skipped because FE-3 was not built yet.
- Local pre-check · passed. Knee flexion 66.6° at 500 ms opened its evidence frame with skeleton and angle.
- Reserved debit · 1 simulation
- Run · `92de42c1-1168-4346-9730-e7d903fe94c4` · [report](https://app.seldon.com/experiments/92de42c1-1168-4346-9730-e7d903fe94c4) · label `build-2e0d55e`
- Verdict · `measure-squat` **PASS** (69 s)
- Confirmed debit · **pending**. Reconcile against Seldon Usage; the CLI does not report balance. Expected balance after this run · 3 used, 13 remaining.
- Next action · run both workbench cases on the final build, which now includes FE-3.


### 2026-11-07 · Current product QA preflight

- Hosted Seldon MCP connected; `list_baseline_runs` sees the earlier two-case harness experiment. Official `get_task_balance` reconciles **16 granted, 2 used, 0 pending, 14 remaining**, $3 per simulation outside the grant.
- `search_knowledge` retrieved four prior harness findings. They describe the old manual-handoff surface, not the current product. [Current product context](PRODUCT-CONTEXT.md) and `seldon.yml` now describe one-action review, persistent local history, distinct-video comparison and live setup/navigation.
- `validate_seldon_yaml` returned **valid, 3 runnable cases**, usage tier, no case/concurrency cap.
- Persona catalog access returned **Your plan does not include usability**. No paid persona experiment was created or dispatched. Current review uses Wren task QA plus local accessibility/lifecycle checks.
- Planned first dispatch: three cases, expected debit **3**, expected remaining **11**. Reserve at least four for final two-core-workflow coverage and rerun. Static public-fixture build, disconnected provider, no personal recordings or private phone invites.
- Dispatch/build/report IDs will be appended after public-build preflight. This entry alone does not claim a run occurred.


### 2026-11-07 · Integrated product QA · 2ad37f8

- Build: `2ad37f8659bbb9b3b8bbea0d2b10e736440491a4`; immutable staging manifest `bd942dadd406ce0f99f1606256a429c4536e7ab783a2388b4626f9e3bda06192`. [Build manifest](wren-build.json).
- Target: public fixture-only HTTPS staging. [Exact public preflight](wren-initial-public-preflight.json) passes nine checks: private-route isolation, real Heavy sample, overlay, saved rename/reload/replay/download, independent comparison, responsive layout, live setup and History navigation. Initial preflight was interrupted by a staging copy; the frozen-copy retry passed before dispatch.
- Cases: `measure-squat`, `compare-and-handoff`, `live-setup-and-navigation`. Three expected simulations. This is current product QA; final polish will be rerun separately.
- Seldon MCP `run_seldon` dispatched experiment **`8c85e97b-ddb4-4e3a-bf78-4171930de874`**. [Report](https://app.seldon.com/experiments/8c85e97b-ddb4-4e3a-bf78-4171930de874).
- Terminal report: **3/3 PASS**, zero failures/blocked/timeouts. Recorded/history272.980s; comparison500.467s; live setup102.014s. get_summary confirms allthree journeys and honest disconnected/empty states. Wren could not resize or test physicalcamera; local responsive/device-simulation evidence remains separate.
- Finding: repeated native rep-menu mouse clicks failed in Wren; keyboard eventually worked. Replaced the dropdowns with visible pressed-state Rep1/Rep2 buttons;22 localcomparison checks pass including independent click/keyboard selection. Minor summary suggestions also cover saving-warning placement, coaching wording and overlapping video-jump affordances. Stop-before-closing guidance now appears beside Start; other alternate seek controls retain distinct phase/metric purposes.
- Actual debit: **3 simulations**. Official balance after completion:16granted,5used,0pending,11remaining. This is a passed checkpoint, not the laterpolish finalrerun.


### 2026-11-07 · Final polished-build rerun · f4a987a

- Product build: `f4a987aa9fd2a90acd65c71f4db43e07bd322a70`. Frozen static manifest `e3725a8481899f6d2c2f177182a3083a5d6c77d9ba39173bb76cb6792aeec379`; [manifest](wren-final-build.json), [public preflight](wren-public-preflight.json).
- Baseline validated again:3runnablecases. Local fullsuite110harness+8launcher/doctor=118passes; finalproduction15controlled-provider checks and9realChatGPT checks pass, including History/reload restoring realnotes without inference. Nine exact publicHTTPS preflight checks pass. Read-only doctorready; phonepage200, publicprovider404, localChatGPTconnected.
- Dispatch reserves3simulations for the same recorded/history, comparison, and live-setup journeys. Balance before:16granted5used11remaining0pending; expected remaining8. Preserve four for any needed finalcore rerun.
- Final experiment **2151c1b9-ae1c-484e-bd25-327cbe64b283** dispatched through Seldon MCP; [report](https://app.seldon.com/experiments/2151c1b9-ae1c-484e-bd25-327cbe64b283). Balance after reservation:5used,8remaining; terminal verdicts now complete.

- Final `get_report` and `get_summary`: **3/3 PASS**, zero failures/blocked/timeouts. Recorded/history438.139s, comparison306.222s, live setup166.243s. [Saved final result](wren-final-results.json). Both core workflows cover the same final product build.
- Actual final-run debit: **3 simulations**; official account now16granted,8used,0pending,8remaining.
- Wren confirms visible rep selection works. Remaining nonblocking observations: restore-banner readability, retaining the original video filename after session rename, and limited end-of-clip Play feedback. These are tracked polish notes, not failed journeys.
- **GO for hands-on testing of the current demo.** Real ChatGPT/history/reload pass locally; physical iPhone and independent movement accuracy remain separate gates. No product files changed during the final run; frozen manifest rechecked after completion.

## Phone repair and queued-review build — 32159db

- Source runtime: `32159db`; public frozen artifact manifest: `qa/wren-phone-repair-build.json`.
- MCP validation: 3 runnable cases, schema valid. Official balance before dispatch:16 granted,8 used,0 pending,8 remaining.
- Expected debit:3 simulations for recorded/reference/history, independent comparison and live setup/chart/diagnostics UX. No personas; no camera permission/account on public host. Five simulations remain for targeted reruns if all3debit as expected.
- Local evidence:128 integrated tests; queued Stop lifecycle with real MediaRecorder/IndexedDB; isolated replay/status/reference browser checks. Real-provider phone regression remains separate and opt-in.
- Experiment **60ba178a-ee4e-469e-a676-57074a9b88ae**, terminal **3/3 PASS**, zero failures/blocked/timeouts. Recorded/history682.392s, comparison419.238s, live setup202.754s. Both get_report and get_summary retrieved; [saved result](wren-phone-repair-results.json).
- Actual debit3; official balance16granted,11used,0pending,5remaining. Minor findings: expandable controls lack affordance, empty recorded video, reference dropdown keyboard friction, downloads discoverability, reference selection resets after reopen. Final tutorial/replay/graph changes require a new exact-build run; reserve3 for final coverage and2 for targeted rerun.
