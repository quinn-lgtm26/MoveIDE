---
title: 'MoveIDE local analysis and coaching harness'
type: 'feature'
created: '2026-11-07'
status: 'in-review'
route: 'dispatch'
baseline_commit: '28a96f502198e0feccf6b6c20bb3cb0e38bc9b45'
review_loop_iteration: 0
context:
  - '{project-root}/AI.md'
  - '{project-root}/_bmad-output/specs/spec-moveide-harness/SPEC.md'
  - '{project-root}/_bmad-output/specs/shared/analysis-report-v1.md'
---

<frozen-after-approval reason="human-owned intent">

## Intent

**Problem** — The workbench needs real squat measurements and a bounded coaching handoff to integrate against.

**Approach** — Deliver BE-1 through BE-4 as one open-source harness. Run the MediaPipe and packet tracks in parallel with the optional native provider spike. Provide evidence, verification commands, and the product development workflow report.

## Boundaries & Constraints

- Run analysis on-device with MediaPipe Full v1. Use same-side landmarks and screen-plane geometry. Measure timing against the pre-labeled fixture with the declared 150 ms tolerance. Preserve unavailable evidence.
- Use the AnalysisReport v1 and CoachPacket v1 contracts. A request can send only the user's chosen packet and previewed JPEGs. Keep the manual path independent.
- Keep native credentials in an optional loopback service and verify provider capability and evidence references. Leave live activation behind the eligible-account check.
- Keep the final Seldon gate and allocation ledger. Dispatch requires a reachable final workbench and verified balance. Local harness checks use no simulations.
- Scope covers the backend, real results and frontend integration handoff. The workbench has its own implementation track.

## I/O & Edge Cases

- Bundled sample in, a schema-valid report with two complete reps and bottom timestamps within tolerance out.
- An occluded landmark or unsupported view yields an explicit unavailable result or capture guidance.
- Two selected reps produce bounded comparison metrics and matching unannotated JPEGs. Missing images leave a usable report and copy flow.
- A failed, canceled, or invalid interpretation leaves the local report intact. An old selection cannot populate a newer selection's result.

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/epics.md` identifies BE-1 to BE-4, FE dependencies and the final gate.
- `_bmad-output/specs/shared/analysis-report-v1.schema.json` defines the report wire format.
- `fixtures/squat/` contains public fixtures, attribution and independent golden timing labels.
- `seldon.yml` and `qa/seldon-ledger.md` define the hosted final gate and allocation.

## Tasks & Acceptance

- [x] `harness/motion/`, `harness/verify/` and `harness/results/` — run the browser worker and record real evidence and fixture checks.
- [x] `harness/coaching/` — build the packet and JPEG bundle, format the Magna Carta copy handoff, and validate interpretation shape and evidence references.
- [x] `harness/provider/` — implement and locally verify the optional adapter and loopback OAuth boundary. Record live account availability separately.
- [x] `harness/setup/`, `harness/package.json`, `harness/vite.config.mjs` and `harness/README.md` — pin assets, build a runnable smoke harness and publish the frontend interface and outputs.
- [x] Development workflow report — document stack, implementation stages, ownership, evidence and remaining integration gates.

## Implementation Notes

- The installed BMAD Build sources use legacy placeholder syntax. A temporary compatibility copy renders the project snapshot. The installed plugin and existing planning files stay outside the implementation changes.
- The user authorized the full workstream and parallel implementation. The active working tree already contains project planning changes, so build edits are kept in separate paths.

- Chrome ran the real Full v1 WASM model on six fixture inputs. The independent supported fixture matched both timing labels. The original blur-heavy fixture missed the rep count and remains in the suite with warning evidence.
- The built smoke verified clipboard, images and zero third-party requests. The optional Python Tasks reproduction agreed with Chrome within 0.41° on two frames. Live account inference and hosted Seldon depend on separate access and the final frontend build.

## Spec Change Log

## Review Triage Log

## Verification

- `npm --prefix harness test` covers motion geometry, packet scope, and provider protocol and failure paths.
- `npm --prefix harness run verify:fixtures` runs browser inference and checks the labeled and challenge clips.
- `npm --prefix harness run build` followed by the local browser smoke verifies the shipped worker, assets and copy path.
