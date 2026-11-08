# Contributing to MoveIDE

Read [DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup, architecture, commands and verification, then [tracker.md](tracker.md) and [AI-AMENDMENTS.md](AI-AMENDMENTS.md) for current product behavior. Claude and Codex setup prompts are in [AI-SETUP.md](docs/AI-SETUP.md).

1. Fetch the latest main, preserve local work, and agree file ownership when working in parallel.
2. Implement against shared motion/coaching/history contracts. Do not duplicate geometry, introduce manual packet steps into the normal flow, or request inference during replay.
3. Run relevant tests and typecheck/build. For video/provider work, record fixture/source identity, whether the provider was real or mocked, and the actual browser/device used.
4. Update the applicable spec/story and tracker with linked evidence and remaining limits.
5. Rebase or merge incoming main changes without force-pushing shared history. Resolve behavior conflicts explicitly and rerun affected checks.

Keep secrets, private pairing URLs, user recordings and generated model assets out of Git. Preserve fixture and dependency attribution. The Seldon budget is managed in [AI.md](AI.md) and its ledger; installing or contributing code does not require a paid QA run.

Bug reports should include a commit, OS/browser, source type (sample/upload/camera/phone), the step that failed and expected behavior. `node scripts/doctor.mjs --json` supplies credential-free setup diagnostics. Share a public fixture or a minimal reproduction rather than personal recordings or account data.
