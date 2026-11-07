# Seldon simulation ledger

- Hackathon allocation · **16 simulations**
- Confirmed use recorded here · **0**
- Account balance at first preflight on 2026-11-07 · **16 granted, 0 used, 0 pending, 16 remaining**
- Final-build reserve · **4 simulations**, including room to rerun both workflows if the verified debit allows

No dispatches have been recorded. A local check or a YAML validation is not evidence of a hosted simulation. After each dispatch, record the confirmed debit and the account balance. Treat pending debits as reserved until they reconcile.

Seldon MCP validated both cases in the [workbench baseline](../seldon.yml) and both in the [harness baseline](seldon-harness.yml). The workspace is on the usage tier. The Seldon CLI's `get_task_balance` returned the balance above, and `list_baseline_runs` returned no prior QA runs. A harness run with two cases in one browser reserves two simulations and leaves at least 14 available from this preflight. [Seldon Wren billing units](https://www.seldon.com/pricing)

## Dispatch record

Append one entry per dispatch. Include date, purpose, target and build ID, selected case or persona IDs, reserved and confirmed simulation debit, experiment or run ID, report and summary references, verdicts, and the next action. For the final submission, identify the single final build that both core verdicts cover.
