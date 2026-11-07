# MoveIDE

MoveIDE is a free, open-source workbench for human movement. The hackathon build starts with a side-view squat clip. The plan is to measure movement locally, show the frames behind each measurement, and let the user choose an AI model to interpret the evidence.

## Build handoff

- Read the [epics and stories](_bmad-output/specs/epics.md) for the frontend and backend workstreams.
- For the harness session, start **BE-1** with the [bundled two-rep squat clip](fixtures/squat/README.md) and the [AnalysisReport v1 contract](_bmad-output/specs/shared/analysis-report-v1.md). The first checkpoint is one real MediaPipe report with an evidence-linked knee angle.
- Timebox **BE-3**, the ChatGPT sign-in spike, in parallel. [Backend and harness spec](_bmad-output/specs/spec-moveide-harness/SPEC.md)
- Use [AI.md](AI.md) for Seldon setup, [seldon.yml](seldon.yml) for the two submission cases, and the [simulation ledger](qa/seldon-ledger.md) to track the 16-simulation allocation.

Hosted Seldon validation and final runs require an authenticated MCP connection and a reachable build.
