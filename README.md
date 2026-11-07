# MoveIDE

Current delivery: [global tracker](tracker.md) · [AI integration amendments](AI-AMENDMENTS.md) · [workflow status](workflow.html)


MoveIDE is an open-source squat analysis and coaching workbench. One Start runs local MediaPipe Heavy analysis and, when connected, sends bounded source images and measurements for cited AI coaching. Recorded playback and live camera sessions share the harness. Estimated geometry is not a clinical assessment or independently validated arbitrary-view motion capture.

## Run the demo

```sh
npm run demo
```

On macOS you can also double-click **Start MoveIDE.command**. Missing locked dependencies and pinned model assets are installed automatically. Node.js 22.18 or newer is required.

Open the printed local address. For iPhone pairing, use `npm run demo -- --phone` with `cloudflared` installed. The launcher builds the app, prepares pinned assets and starts the necessary services. See the [quickstart](docs/quickstart.md) for phone setup, permissions and recovery. Stop the launcher with Ctrl+C.

## Development status

Open [workflow.html](workflow.html) for the development workflow, story status, verification results, and remaining frontend integration. Download the HTML and open it in a browser to use its tabs. The [harness guide](harness/README.md) documents the verified Heavy analysis and OpenCap import APIs; [frontend amendments](harness/FRONTEND-HANDOFF.md) describe the pending product pickup.

## Build handoff

- Read the [epics and stories](_bmad-output/specs/epics.md) for the frontend and backend workstreams.
- Use the [bundled squat fixtures](fixtures/squat/README.md) and [AnalysisReport v1 contract](_bmad-output/specs/shared/analysis-report-v1.md) for integration. Foundational analysis and account integration are implemented; the tracker records remaining release gates.
- Follow the [latest frontend contracts](docs/frontend-harness-amendments.md) and [UX requirements](docs/frontend-design-amendments.md). The [original harness spec](_bmad-output/specs/spec-moveide-harness/SPEC.md) is historical where the amendments supersede it.
- Use [AI.md](AI.md) for Seldon setup, [seldon.yml](seldon.yml) for the two submission cases, and the [simulation ledger](qa/seldon-ledger.md) to track the 16-simulation allocation.

Hosted Seldon validation and final runs require an authenticated MCP connection and a reachable build.

## Develop

Requires Node 22.18+.

```bash
npm ci
npm --prefix harness ci
npm run dev      # workbench on http://127.0.0.1:5173 (ChatGPT shows unavailable)
npm test         # harness tests
npm run build    # typecheck + production build
MOVEIDE_ENABLE_CHATGPT=1 npm run preview   # built app on 127.0.0.1:4173 with live ChatGPT sign-in
```

Layout: [AnalysisReport v1](_bmad-output/specs/shared/analysis-report-v1.md) types come from `harness/motion` · `src/App.tsx` recorded workbench and coaching · `src/Compare.tsx` rep comparison · `harness/live/` live analysis and phone transport · `harness/provider/` private ChatGPT provider (`/api`, mounted in Vite). Backlog: [epics](_bmad-output/specs/epics.md).
