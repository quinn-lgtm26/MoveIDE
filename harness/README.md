# MoveIDE local analysis harness

The harness runs MediaPipe Pose Landmarker Full float16 v1 in a browser worker. It decodes a stationary side-view squat clip, estimates knee flexion and torso lean in the video plane, segments complete reps, and prepares an evidence packet for coaching. The browser keeps the full clip and landmark trace. The optional ChatGPT connector sends the previewed packet and JPEGs through a local service after an explicit request.

## Run it

Requires Node 22.12+ and a current desktop Chrome for browser verification.

```sh
npm --prefix harness ci
npm --prefix harness test
npm --prefix harness run verify:fixtures
npm --prefix harness run build
npm --prefix harness run verify:build
npm --prefix harness run start:local
```

Open [the local smoke page](http://127.0.0.1:4173). It runs the actual worker, shows the generated packet and frame downloads, and exercises the clipboard. The React workbench is a separate frontend track.

The setup script installs pinned WASM from the npm lock and fetches the exact Full v1 model, verifies its SHA-256, and stages the assets under `harness/public/pose`. The build serves those assets alongside the harness. Browser verification blocks other origins and checks that the local path attempts no outbound requests. To publish a frontend static build, serve the staged `pose/` directory from the app's Vite base and include the [fixture and attribution](../fixtures/squat/README.md). The harness source uses the [MIT license](../LICENSE). MediaPipe has its own [asset terms](setup/THIRD-PARTY-NOTICES.md).

## Frontend integration

The standalone package leaves the frontend's root Vite, TypeScript, and app files separate. Use the supported sample and real report below in place of the scaffold's synthetic data. TypeScript consumers can import the declared types from the same modules.

```js
import { analyzeSquat, getMotionTrace } from './harness/motion/analyze.mjs';
import { formatManualHandoff, prepareCoachingBundle } from './harness/coaching/index.mjs';

const source = '/fixtures/squat/supported-squat.mp4'; // Or the original File from the user's picker.
const job = new AbortController();
const report = await analyzeSquat(source, { signal: job.signal, onProgress: console.log });
const trace = getMotionTrace(report); // Timestamped angles and phase for the chart or scrubber.
const repIds = report.reps.slice(0, 2).map((rep) => rep.id);
const bundle = await prepareCoachingBundle(report, source, { repIds, signal: job.signal });
const text = formatManualHandoff(bundle.packet, bundle.images);
```

- **Measure.** Use the same source for the player, analysis, and bundle. `onProgress` reports `stage`, a 0–1 `progress`, and `frameCount`. Map normalized landmarks to the displayed video content rectangle. Seek to `evidenceTimestampMs` and leave a gap when a usable sample is more than 100 ms away. Render unavailable states and report warnings. The report keeps all 33 landmark slots at each sampled timestamp. `getMotionTrace` adds usable knee flexion and torso lean, the containing rep, and descent, bottom or ascent phase for every sample. The trace stays local.
- **Compare and copy.** Pass the chosen rep IDs and optional `userGoal`. The packet includes selected rep start, bottom and end times as context. The bundle has a bounded `packet`, `images` with JPEG blobs, and `unavailableImages` with per-frame messages. Preview and download by evidence ID. Copy the Magna Carta and packet with `formatManualHandoff`. The original report can be downloaded separately.
- **Handle replacement.** Abort the job when the source or pair changes and compare the completed request with the active selection before applying it. Each report owns its own evidence IDs. Retain the local report when provider, image capture, or clipboard actions fail.
- **Provider boundary.** The [browser adapter](provider/client.mjs) exposes connection, models, and interpretation. The [server middleware](provider/local-server.mjs) can replace the scaffold stub on the same HTTP `127.0.0.1` origin. Keep the server module out of the browser bundle. Hosted frontend previews use the manual handoff.

## Evidence and accuracy

- [Real AnalysisReport v1](results/supported-squat.analysis-report.v1.json) · [Local motion trace](results/supported-squat.motion-trace.v1.json) · [CoachPacket v1](results/supported-squat.coach-packet.v1.json) · [1,600 ms JPEG](results/supported-squat-evidence/frame-1600ms.jpg) · [4,400 ms JPEG](results/supported-squat-evidence/frame-4400ms.jpg)
- [Fixture verification](results/fixture-verification.json) covers report schema and geometry, visibility, browser cancellation and decode failure, front-view capture guidance, and local-only coaching bundles. Run `npm --prefix harness run verify:fixtures -- --write` to regenerate the artifacts.
- `supported-squat.mp4` yielded two reps at 1,600 and 4,400 ms, both within the predeclared 150 ms tolerance. Knee flexion was 100.8° and 100.3°. Torso lean from vertical was 35.8° and 39.2°. Rep duration was 1,867 and 1,800 ms. The original two-rep sample is retained as a hard case. Blur and other people interrupted tracking and yielded no trusted complete reps. The other side views are exploratory.
- Run `cd harness && uv run verify/python-agreement.py` for the optional Python check (requires FFmpeg and ffprobe). Python and Chrome using the same model differed by 0.41° and 0.29° at the two knee measurement frames. The fixtures have timing labels and lack reference joint angles. The estimates describe the camera plane. [Report and packet contract](../_bmad-output/specs/shared/analysis-report-v1.md) · [Google Pose Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)

## ChatGPT spike and Seldon gate

The standalone adapter is available on the fixed loopback preview port 4173. Use one local service per credential directory when embedding the adapter. Start the smoke build with `MOVEIDE_ENABLE_CHATGPT=1 npm --prefix harness run start:local`, then choose **Continue with ChatGPT**. The loopback service holds credentials under `~/.config/moveide/` with owner-only permissions. The browser receives connection state and eligible models. It can request interpretation after previewing the exact packet and images. Local mocked-upstream verification covers callback state, PKCE, scope gating, model checks, response completion, and unknown evidence IDs. The live eligible-account exchange, model discovery and GPT-6.1 Sol inference with both fixture JPEGs passed. [Live verification evidence](results/live-chatgpt-verification.json). The optional `npm --prefix harness run verify:live` command uses the active plan to send the public fixture packet and both JPEGs. [OpenAI local plan protocol](https://developers.openai.com/siwc/token-sharing-open-source)

The [Seldon baseline](../seldon.yml) covers sample measurement and compare-and-handoff. After the workbench uses the supported sample, validate the YAML through the connected Seldon MCP, smoke-test the exact workbench build, and record the expected debit before dispatching both cases against its reachable URL. Keep at least four of the 16 simulations for the final run and a rerun. Record the experiment ID, actual debit, both verdicts, and summary in the [ledger](../qa/seldon-ledger.md).
