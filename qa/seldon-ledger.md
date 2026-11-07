# Seldon simulation ledger

- Hackathon allocation · **16 simulations**
- Confirmed use recorded here · **3 simulations, 13 remaining** (the third debit still needs to be confirmed in Seldon Usage)
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
