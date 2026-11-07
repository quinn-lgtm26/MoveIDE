# BE-5 source timeline audit

Status: done. Baseline: 2f6c2a12e97defb675202aee999d48148486bbad.

Intent: verify which independently decoded presentation timestamps appear in saved analysis reports. Keep the production 15 Hz sampler and wire contracts unchanged. This is one part of BE-5; it does not close the independent-angle or exact-decoder work.

Acceptance and evidence:

- The clear and supported fixture reports are matched to ffprobe source timestamps rounded to the contract's integer milliseconds. Every saved timestamp must resolve to a source frame. The result includes source/report hashes, counts, skipped source indices, and unmatched analysis times.
- A 15 Hz trace over a 30 Hz test timeline passes timestamp identity but cannot pass complete coverage. Variable timestamps are matched by presentation time. Duplicate and ambiguous millisecond timestamps, unknown source times, shifted origins, and unverified rotation are refused.
- Run `node --test harness/verify/source-timeline.test.mjs` and `npm --prefix harness run verify:source-timeline -- --write`. Initial result: three tests passed; actual fixture timelines are 57/57 and 90/90 with zero unmatched samples.
- Frontend amendment names analyzed-sample stepping and avoids claiming full-rate analysis for arbitrary uploads. Seldon remains on hold until the final integrated build.

Review: independent reviewer reran all three tests and the real ffprobe audit; no actionable findings. Coverage is explicitly limited to timestamp identity and accounting for the two saved fixtures.
