# MoveIDE

An open-source squat analysis and coaching app. Start with a recorded clip or a camera: MediaPipe Heavy measures motion locally, and an optional connected ChatGPT coach reviews bounded source images and measurements. Short coaching notes stay visible alongside the video.

**[Set up with Claude or Codex →](docs/AI-SETUP.md)** · [Quickstart](docs/quickstart.md) · [Developer guide](docs/DEVELOPMENT.md) · [Current status and evidence](tracker.md)

## Run it

Install [Node.js22.18 or newer](https://nodejs.org/en/download), then on macOS/Linux:

```sh
git clone https://github.com/quinn-lgtm26/MoveIDE.git
cd MoveIDE
npm run demo
```

The launcher installs locked dependencies, downloads and verifies the pinned Heavy/Full models, builds the UI, and starts the local services. On macOS, you can also double-click **Start MoveIDE.command** after cloning. Keep the terminal open; Ctrl+C stops its owned services.

Open **[the app](http://127.0.0.1:4173/)** or **[live coaching](http://127.0.0.1:4173/harness/live/)**. Choose **Try a sample squat** for the bundled recording or **Compare examples** for two independently analyzed videos. Local measurements work without a ChatGPT connection. Connect the coach once in the app to enable automatic evidence-linked interpretation.

Already cloned? Preserve your work, update from main when safe, then run `npm run demo` again. Need diagnosis rather than another server? Use **`npm run doctor`**: it checks dependencies, model hashes, runtime files and local service state without installing, changing or stopping anything.

## iPhone camera → MacBook

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) and use this instead of the ordinary startup command:

```sh
npm run demo -- --phone
```

On the Mac, open **Live camera**, choose **iPhone via private link**, and Start. Scan the in-app QR with the iPhone, open it in Safari, tap **Start camera**, and allow the camera. Video streams to the Mac through WebRTC; local tracking and coaching captions return to the phone. The phone needs no MediaPipe installation. Keep the phone foregrounded and the whole body visible.

Only the dedicated pairing service4176 gets temporary HTTPS access. The credential-bearing app/provider4173 stays private. QR encoding is local. Do not publish the pairing link. See [the complete phone checklist and recovery steps](docs/quickstart.md#iphone--macbook).

## What is available

- Recorded Heavy/Full analysis, rep segmentation, source-timed measurements, full-body overlays and replay controls.
- One-Start optional AI coaching with cited evidence; playback/seek does not request new inference.
- Two actual video examples with independent hashes, rep selection, phase anchors and descriptive metric differences.
- Live camera analysis and QR/WebRTC phone transport with bounded asynchronous coaching.
- OpenCap result import labeled as imported/unverified; native inference remains deferred.
- Local history/recording work is tracked in [the history contract](docs/HISTORY.md) and [global tracker](tracker.md); use their acceptance status for availability.

Measurements are projected or explicitly experimental estimates, not independently validated anatomical angles. Physical iPhone/venue acceptance and moving-camera/orbit accuracy remain separate from the browser fixture tests. The examples are not a validated good/bad technique pair. [Read what was actually tested](qa/latest-local-checkpoint.json).

## Developers and coding assistants

| Start here | Purpose |
| --- | --- |
| [Claude and Codex copy-paste prompts](docs/AI-SETUP.md) | Set up the existing product, verify it, and leave it running |
| [Development guide](docs/DEVELOPMENT.md) | Commands, architecture, module contracts, tests, parallel work and release checklist |
| [Frontend handoff](harness/FRONTEND-HANDOFF.md) | Shared APIs and integration requirements |
| [UI/UX amendment](docs/frontend-design-amendments.md) | One-Start flow, stable coaching cards, capture/recovery and uncertainty |
| [Global tracker](tracker.md) and [epics](_bmad-output/specs/epics.md) | Owners, implementation status and acceptance evidence |
| [workflow.html](workflow.html) | Download/open the standalone interactive development workflow |
| [AnalysisReport/CoachPacket contract](_bmad-output/specs/shared/analysis-report-v1.md) | Versioned shared data and evidence rules |
| [Fixture provenance](fixtures/squat/README.md) | Attribution, labels and what they do or do not prove |

For a controlled development build, `CI=1 npm run dev` skips the historical automatic Git pull. `npm run typecheck`, `npm test` and `CI=1 npm run build` are the main local gates. Chrome is required for the default browser tests; see the developer guide for scoped verifiers. No Seldon credits are needed to install or use local analysis. Final Wren runs are budgeted separately in [AI.md](AI.md) and [the ledger](qa/seldon-ledger.md).

Source is [MIT](LICENSE); model/runtime, QR and dataset attributions are in [third-party notices](harness/setup/THIRD-PARTY-NOTICES.md) and the fixture documentation.
