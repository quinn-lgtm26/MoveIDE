# MoveIDE
MoveIDE is the IDE for human movement: an open-source tool that turns any phone into a biomechanics lab for coaches, clinics, and athletes. Record a squat or gait clip, get joint angles, flagged compensations, and a coach-built corrective plan in seconds. Measurement should be free. Knowing what to do about it is the product.

## Develop

Requires Node 22.18+ (runs the TypeScript service and tests directly).

```bash
npm install
npm run server   # loopback service on 127.0.0.1:8787 (ChatGPT connector)
npm run dev      # workbench on http://localhost:5173, proxies /api to the service
npm test         # angle math checks
npm run build    # typecheck + production build
```

Layout: `src/contract.ts` mirrors [AnalysisReport v1](_bmad-output/specs/shared/analysis-report-v1.md) · `src/engine/` pose worker and angle math (harness spec) · `src/App.tsx` workbench (frontend spec) · `server/` loopback service. Backlog: [epics](_bmad-output/specs/epics.md).
