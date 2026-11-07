# MoveIDE agent instructions

Start with [tracker.md](tracker.md) for current ownership/status and [AI-AMENDMENTS.md](AI-AMENDMENTS.md) for the one-Start coaching flow. These amendments supersede older manual preview/send requirements in the historical backlog. Update the tracker with evidence when finishing or handing off work.

Read the [BMad backlog](_bmad-output/specs/epics.md) and [AnalysisReport contract](_bmad-output/specs/shared/analysis-report-v1.md) before implementing a story. MoveIDE runs movement analysis locally and uses an optional model for interpretation. Test each story locally before spending a Seldon simulation.

## Seldon MCP

Use the hosted HTTP endpoint with a private `X-API-Key` header. In a client that accepts `mcpServers` JSON, use this template in private client settings. Replace the placeholder there. Keep the actual key in the client’s secret store or local environment.

```json
{
  "mcpServers": {
    "seldon": {
      "url": "https://app.seldon.com/mcp",
      "headers": {
        "X-API-Key": "seldon_<your-key>"
      }
    }
  }
}
```

For Codex's private `config.toml`, map the header to a local `SELDON_API_KEY` environment variable.

```toml
[mcp_servers.seldon]
url = "https://app.seldon.com/mcp"
env_http_headers = { "X-API-Key" = "SELDON_API_KEY" }
```

[Official Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

The [official Seldon Claude Code plugin](https://github.com/blok-intelligence/seldon-claude-plugin) also supports keychain-backed setup. A connected status verifies transport only. Check key access with a read-only tool such as `list_baselines`. Keep keys and user credentials out of Git, tool output, and the QA YAML.

## QA and the 16-simulation budget

- [seldon.yml](seldon.yml) is the baseline. It covers **measure a sample squat** and **compare two reps and prepare a coaching packet**. Keep the case IDs stable.
- Use `validate_seldon_yaml` after changing YAML and before dispatch. `create_baseline` and `add_test_case` author the same file. A schema check is free according to Seldon's QA guide.
- Before a paid run, verify the target is reachable by Seldon, exercise the exact build locally, and reconcile the account's remaining simulations with [the ledger](qa/seldon-ledger.md). Reserve at least four of the 16 for final-build coverage and a rerun. Record the expected debit before dispatch. Confirm the account's billing unit, including case/persona fan-out, before relying on any estimate.
- Use `run_seldon` with a real preview URL override and tag the commit or build ID. The baseline’s `.example` URL is a placeholder. Use `list_baseline_runs`, `get_experiment_status`, and `get_run_logs` to follow it. `cancel_baseline_run` can stop a stale run. Reconcile any failed, blocked, or canceled dispatch against the account's actual debit.
- Get both `get_report` for per-case verdicts and `get_summary` for findings and repro steps. Record the experiment ID, case verdicts, what changed, and the follow-up run in the ledger. Fix failures locally. Spend reruns on relevant cases during development.
- For the prize submission, run both core workflows against the same final build after fixes, keep the experiment ID and both case verdicts, and show the report in the demo or submission. The reachable QA route uses public or otherwise approved fixtures and the manual coaching handoff. Run the eligible ChatGPT account check locally.
- Treat persona and messaging experiments as optional and budgeted. Keep the four-simulation reserve and verify their fan-out before using them.

## Other Seldon tools

- Personas · `list_personas` for catalog IDs, `list_experiments` for run IDs, `create_experiment` to prepare, `run_experiment` to dispatch, and `get_experiment_status` to poll.
- Messaging · `create_messaging_experiment` and `run_messaging_experiment` to compare variants, then `get_messaging_status` and `get_messaging_results`.
- Research · `get_summary` explains what was learned. `search_knowledge` searches findings across experiments or personas. For QA, pair the summary with `get_report`.

[Official Seldon QA baseline guide](https://github.com/blok-intelligence/seldon-claude-plugin/blob/main/plugins/seldon/skills/seldon-qa/SKILL.md)
