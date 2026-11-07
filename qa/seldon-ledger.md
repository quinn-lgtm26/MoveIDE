# Seldon simulation ledger

- Hackathon allocation · **16 simulations**
- Confirmed use recorded here · **0** (1 reserved, pending reconciliation)
- External team use · **reconcile in Seldon before first dispatch**
- Final-build reserve · **4 simulations**, including room to rerun both workflows if the verified debit allows

No dispatches have been recorded. A local check or a YAML validation is not evidence of a hosted simulation. After each dispatch, record the confirmed debit and the account balance. Treat pending debits as reserved until they reconcile.

## Dispatch record

Append one entry per dispatch. Include date, purpose, target and build ID, selected case or persona IDs, reserved and confirmed simulation debit, experiment or run ID, report and summary references, verdicts, and the next action. For the final submission, identify the single final build that both core verdicts cover.

### 2026-11-07 · first dispatch · measure-squat

- Purpose · first hosted check of the sample-squat measurement flow
- Target · `http://localhost:5173` via Seldon tunnel · build `2e0d55e` (feat/frontend-workbench, clean tree)
- Cases · `measure-squat` only. `compare-and-handoff` skipped because FE-3 is not built, so it cannot pass yet.
- Local pre-check · passed. Knee flexion 66.6° at 500 ms opens its evidence frame with skeleton and angle.
- Reserved debit · 1 simulation
- Run · `92de42c1-1168-4346-9730-e7d903fe94c4` · [report](https://app.seldon.com/experiments/92de42c1-1168-4346-9730-e7d903fe94c4) · label `build-2e0d55e`
- Verdict · `measure-squat` **PASS** (69 s). The evidence frame shows the full pose skeleton, joints, and angle on the video.
- Confirmed debit · **pending**. Reconcile against Usage in Seldon. The CLI does not report balance.
- Next action · build FE-3, then run `compare-and-handoff`. Final submission needs both cases on one build.
