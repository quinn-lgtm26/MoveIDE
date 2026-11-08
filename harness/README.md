# MoveIDE local analysis harness

The harness runs MediaPipe Pose Landmarker Heavy float16 v1 by default in a browser worker. It decodes a stationary side-view squat clip, estimates knee flexion and torso lean in the video plane, segments complete reps, and prepares an evidence packet for coaching. The browser keeps the full clip and landmark trace. After connection and the disclosure beside Start, the integrated product automatically sends selected measurements and JPEGs through the local ChatGPT service. Manual packet export remains a developer tool.

## Run it

Requires Node 22.18+ and a current desktop Chrome for browser verification.

```sh
npm --prefix harness ci
npm --prefix harness test
npm --prefix harness run verify:fixtures
npm --prefix harness run build
npm --prefix harness run verify:build
npm --prefix harness run start:local
```

For the integrated React product, run `npm run demo` from the repository root and open [MoveIDE](http://127.0.0.1:4173). Use the package commands above only for standalone harness verification; do not start a second server on an occupied demo port. The smoke page retains developer packet inspection and downloads.

In the integrated product, connect ChatGPT once, then choose **Start coached squat**. Local analysis and selected-image interpretation run together. Accepted short coaching cards remain visible through playback and Stop, with expandable reasoning and source evidence. Playback itself makes no model requests. A new session invalidates pending work. The normal flow has no separate Generate or Send step; see [AI amendments](../AI-AMENDMENTS.md).

The setup script installs pinned WASM from the npm lock and fetches the exact Heavy and Full v1 models, verifies each SHA-256, and stages the assets under `harness/public/pose`. The build serves those assets alongside the harness. Browser verification blocks other origins and checks that the local path attempts no outbound requests. To publish a frontend static build, serve the staged `pose/` directory from the app's Vite base and include the [fixture and attribution](../fixtures/squat/README.md). The harness source uses the [MIT license](../LICENSE). MediaPipe has its own [asset terms](setup/THIRD-PARTY-NOTICES.md).

## Frontend integration

The standalone package leaves the frontend's root Vite, TypeScript, and app files separate. [Frontend handoff amendments](FRONTEND-HANDOFF.md) Use the supported sample and real report below in place of the scaffold's synthetic data. TypeScript consumers can import the declared types from the same modules.

```js
import { analyzeSquat, getMotionTrace, getSquatProfile } from './harness/motion/analyze.mjs';
import { formatManualHandoff, prepareCoachingBundle } from './harness/coaching/index.mjs';

const source = '/fixtures/squat/clear-squat.mp4'; // Or the original File from the user's picker.
const job = new AbortController();
const report = await analyzeSquat(source, { signal: job.signal, onProgress: console.log });
const trace = getMotionTrace(report); // Timestamped angles and phase for the chart or scrubber.
const profile = getSquatProfile(report); // Rep and phase timings with source anchors.
const repIds = report.reps.slice(0, 2).map((rep) => rep.id);
const bundle = await prepareCoachingBundle(report, source, { repIds, signal: job.signal });
const text = formatManualHandoff(bundle.packet, bundle.images);
```

- **Measure.** Use the same source for the player, analysis, and bundle. `onProgress` reports `stage`, a 0–1 `progress`, and `frameCount`. Map normalized landmarks to the displayed video content rectangle. Seek to `evidenceTimestampMs` and leave a gap when a usable sample is more than 100 ms away. Render unavailable states and report warnings. The report keeps all 33 landmark slots at each sampled timestamp. `getMotionTrace` adds usable knee flexion and torso lean, the containing rep, and descent, bottom or ascent phase for every sample. The local trace also includes projected hip flexion, shin inclination, ankle closure change and two normalized depth proxies. [Metric definitions](motion/METRICS.md)
- **Compare and copy.** Pass the chosen rep IDs and optional `userGoal`. The packet includes selected rep phases and a bounded summary of their projected bottom metrics. The bundle has a bounded `packet`, `images` with JPEG blobs, and `unavailableImages` with per-frame messages. Preview and download by evidence ID. Copy the Magna Carta and packet with `formatManualHandoff`. The original report can be downloaded separately.
- **Handle replacement.** Abort the job when the source or pair changes and compare the completed request with the active selection before applying it. Each report owns its own evidence IDs. Retain the local report when provider, image capture, or clipboard actions fail.
- **Provider boundary.** The [browser adapter](provider/client.mjs) exposes connection, models, and interpretation. The [server middleware](provider/local-server.mjs) is integrated on the same HTTP `127.0.0.1` origin. Keep the server module out of the browser bundle. Public QA previews keep provider access disabled; optional manual export remains available in developer tools.

## Evidence and accuracy

- [Clear demo clip](../fixtures/squat/clear-squat.mp4) · [AnalysisReport](results/clear-squat.analysis-report.v1.json) · [Motion trace](results/clear-squat.motion-trace.v1.json) · [Squat profile](results/clear-squat.squat-profile.v1.json) · [CoachPacket](results/clear-squat.coach-packet.v1.json)
- The 810×1440 demo tracked all 57 frames. Heavy found two rep bottoms at 1,067 and 3,000 ms, 0 and 67 ms from the blind labels. Knee flexion was 117.4° and 117.5°. Torso lean was 41.1° and 40.7°. The tolerance remains 150 ms.
- [Full versus Heavy benchmark](results/pose-model-benchmark.json) uses the same model family, local Chrome CPU and fixed fixtures. On the labeled six-second regression, both models detected two reps. Full matched both labels in 3.77 seconds. Heavy was within tolerance with a 67 ms miss on rep two and took 7.75 seconds. Heavy is now the user-selected default. Both exact assets are staged by setup; select `model: 'full'` for the faster alternative. This historical benchmark does not establish Heavy as more accurate.

- [Real AnalysisReport v1](results/supported-squat.analysis-report.v1.json) · [Local motion trace](results/supported-squat.motion-trace.v1.json) · [CoachPacket v1](results/supported-squat.coach-packet.v1.json) · [1,600 ms JPEG](results/supported-squat-evidence/frame-1600ms.jpg) · [4,333 ms JPEG](results/supported-squat-evidence/frame-4333ms.jpg)
- [Fixture verification](results/fixture-verification.json) covers report schema and geometry, visibility, browser cancellation and decode failure, front-view capture guidance, and local-only coaching bundles. Run `npm --prefix harness run verify:fixtures -- --write` to regenerate the artifacts.
- [Source timeline audit](results/source-timeline-verification.json) independently decodes presentation timestamps with ffprobe and binds the audit to SHA-256 hashes of the clips and saved reports. The clear demo represents 57/57 source timestamps and the supported regression represents 90/90, with no unmatched report timestamps. Run `npm --prefix harness run verify:source-timeline -- --write` after regenerating reports. Requires FFmpeg's `ffprobe` on PATH. This proves timeline coverage for those two zero-origin, unrotated fixtures. Pixel identity, independent angle accuracy, and arbitrary-file exact decoding require separate checks. The production analyzer still samples at 15 Hz.
- `supported-squat.mp4` under Heavy yielded two reps at 1,600 and 4,333 ms, errors of 0 and 67 ms within the predeclared 150 ms tolerance. Knee flexion was 98.9° and 98.3°. Torso lean from vertical was 40.6° and 40.6°. Rep duration was 1,800 and 1,733 ms. The original two-rep sample is retained as a hard case. Blur and other people interrupted tracking and yielded no trusted complete reps. The other side views are exploratory.
- Run `cd harness && uv run verify/python-agreement.py` for the optional Python check (requires FFmpeg and ffprobe). The checker selects and verifies the model identified by the report. The [Heavy cross-runtime check](results/heavy-python-agreement.json) differed by 0.09° and 0.78° at its two supported-fixture knee frames. This measures agreement between implementations using the same weights, not ground-truth angle accuracy. The historical Full check differed by 0.41° and 0.29° at its two knee frames. The fixtures have timing labels and lack reference joint angles. The estimates describe the camera plane. [Report and packet contract](../_bmad-output/specs/shared/analysis-report-v1.md) · [Google Pose Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)

The [archived Full baseline](results/full-baseline/README.md) preserves the reports and JPEGs used before the Heavy default change, including the supported fixture used for earlier live ChatGPT and hosted harness evidence.

## Additional local analysis outputs

Pass `onPoseFrame(frame)` to `analyzeSquat` to retain all 33 normalized and 33 world landmark slots per analyzed sample, including estimated z and available visibility/presence. Missing coordinates remain null. `RAW_POSE_COORDINATES` describes units and origins. These are model estimates, independent of the projected measurements in AnalysisReport v1. The review page exports this trace through **Full pose data**. Raw traces never enter CoachPacket v1.

The [OpenCap adapter](opencap/README.md) imports separately produced, source-bound OpenSim kinematics with explicit per-row source timestamps, coordinate names, and units. It does not perform native OpenCap inference on this Mac. Import results remain `imported-unverified` until source alignment and accuracy are independently checked. See the recorded [runtime preflight](opencap/preflight-result.json).

Run `npm --prefix harness run verify:decoder-matrix -- --write` for generated 30 Hz, 7 Hz, variable-rate and rotated H.264 compatibility checks. These use the actual Full model explicitly to isolate decoder behavior from preset changes, independently decode source timestamps and selected pixels, and verify cancellation and malformed-input recovery. The [result](results/decoder-matrix.json) reports sampling coverage rather than claiming every arbitrary upload is decoded at its source rate.

## ChatGPT spike and Seldon gate

The standalone adapter is available on the fixed loopback preview port 4173. Use one local service per credential directory when embedding the adapter. Start the smoke build with `MOVEIDE_ENABLE_CHATGPT=1 npm --prefix harness run start:local`, then choose **Continue with ChatGPT**. The loopback service holds credentials under `~/.config/moveide/` with owner-only permissions. The browser receives connection state and eligible models. It can request interpretation after previewing the exact packet and images. Local mocked-upstream verification covers callback state, PKCE, scope gating, model checks, response completion, and unknown evidence IDs. The live eligible-account exchange, model discovery and GPT-6.1 Sol inference with both fixture JPEGs passed. [Live verification evidence](results/live-chatgpt-verification.json). The optional `npm --prefix harness run verify:live` command uses the active plan to send the public fixture packet and both JPEGs. [OpenAI local plan protocol](https://developers.openai.com/siwc/token-sharing-open-source)

The [Seldon baseline](../seldon.yml) now covers recorded review/history, independent-recording comparison and live setup/navigation. Final experiment [2151c1b9](https://app.seldon.com/experiments/2151c1b9-ae1c-484e-bd25-327cbe64b283) passed3/3 on frozen `f4a987a`, after fixes. Account:16 granted,8 used,8 remaining. [Saved result](../qa/wren-final-results.json) and [ledger](../qa/seldon-ledger.md). Real ChatGPT was verified separately; Wren does not establish physical iPhone behavior or angle accuracy. Consult the [global completion audit](../tracker.md#completion-audit) for unfinished implementation and external acceptance.
