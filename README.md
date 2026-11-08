# MoveIDE

<img src="harness/public/moveide-mark.svg" alt="MoveIDE movement logo" width="48" height="48">

**Measure your squat. Understand your next rep.**

Free, open-source squat analysis on your laptop, with optional coaching through your own ChatGPT account. Watch your movement, compare reps, and see the images and measurements behind each coaching note.

[Get started](#get-started) · [Try the saved demo](#try-the-saved-demo) · [Read the pitch](docs/PITCH.md) · [Presentation](docs/PITCH.md#presentation) · [For judges](docs/JUDGES-START-HERE.md)

**Measurement should be free. Knowing what to do about it is the product.**

<details>
<summary><strong>Set it up with Claude or Codex — copy this prompt</strong></summary>

```text
Set up and run https://github.com/quinn-lgtm26/MoveIDE.git for me.
Use an existing checkout if present; otherwise clone into a new folder.
Read AGENTS.md/CODEX.md or CLAUDE.md, then AI.md, docs/quickstart.md and tracker.md.
Preserve local changes, existing recordings and running services. Check the remote;
update only by a safe fast-forward. Do not recreate the app or replace its models.

Check Node.js 22.18+, npm and Chrome. Run npm run doctor (read-only); missing
dependencies/models are expected before first setup. If this app is already healthy
on 127.0.0.1:4173, reuse it. Otherwise run npm run demo and keep its terminal alive.
The launcher installs locked dependencies, verifies pose assets and builds the UI.
Run doctor again once ready, then open the actual local homepage for me.

Open History and choose Open demo session if that button is available. Replay its
saved video and coaching without signing in; do not regenerate its notes. If the
bundled demo is absent, show Import session for a .moveide.json session export.
Show me Quick tour, Try a sample squat and the header's Connect ChatGPT button.
For new AI coaching, let me sign in with my own eligible account. Let me grant
any camera permission myself.
Verify real local measurements; report AI success only after a real reply arrives.
Explain local History and keeping the original live tab open for queued reviews.
For optional iPhone pairing, follow docs/quickstart.md and npm run demo -- --phone;
only the dedicated phone service may be public, never the account/provider service.
Leave the working app running. Report the URL, revision and any remaining setup step.
```

[More setup prompts, including iPhone pairing →](docs/AI-SETUP.md)

</details>

![MoveIDE: squat videos, pose overlays, movement comparisons and ChatGPT connection controls](docs/images/homepage.png)

*Homepage with bundled examples and a simulated disconnected account. [Screenshot details](docs/images/homepage.capture.json).*

<sub>Presentation link: awaiting the supplied URL.</sub>

## Why MoveIDE

Coaches and athletes already film their lifts. Turning that footage into measurements can mean another subscription and a cloud upload. Markerless AI’s Basic plan, for example, is $29/month; it also offers pay-as-you-go pricing. [Pricing](https://markerless.ai/pricing) · [Video processing](https://markerless.ai/privacy), checked November 7, 2026 Pacific.

MoveIDE makes the measurement layer free and open source. See how far you lowered, how your body moved, how long each rep took, and what changed between reps. Local measurement needs no MoveIDE subscription or AI account.

Google’s MediaPipe Heavy pose model estimates 33 body landmarks on your laptop. MoveIDE turns those points into squat measurements, graphs and video overlays. Connect your own eligible ChatGPT account for short, rep-by-rep coaching based on selected source images and measurements. Open **Why** to inspect the evidence behind a suggestion.

[The pitch, product explanation and presentation notes →](docs/PITCH.md)

## What you can do

| Feature | What you see |
| --- | --- |
| **Review a recording** | Play, pause, slow down and step through a squat with a body overlay and estimated angles. |
| **Measure your movement** | Knee bend, hip bend, chest lean, rep timing and a graph showing how they change. |
| **Compare reps** | Compare your own reps or the two included examples at matching points in the movement. |
| **Get optional AI coaching** | Short tips, an explanation and the saved images behind them. This version reviews up to six completed reps per live session. |
| **Use a live camera** | Track on a Mac camera, or send iPhone video to the laptop using a private QR link and WebRTC. |
| **Save and replay** | Keep recordings, measurements and accepted coaching in local History. Export a complete session and import it on another computer. |

Current measurement support focuses on side-view squats. The movement logo represents the broader vision; gait and other exercises are not finished features.

## Get started

You need **macOS or Linux**, **[Node.js 22.18+](https://nodejs.org/en/download)** with npm, and **Google Chrome**. The command below also needs Git.

From a folder where `MoveIDE` does not already exist:

```sh
git clone https://github.com/quinn-lgtm26/MoveIDE.git
cd MoveIDE
npm run demo
```

The launcher installs dependencies, downloads and verifies the pose models, builds the app and starts the local services. First setup needs internet access and may take several minutes. Keep the terminal open, then visit **[http://127.0.0.1:4173](http://127.0.0.1:4173/)**.

**No Git?** Download the repository using **Code → Download ZIP**, extract it, and run `npm run demo` in that folder. On a Mac with Node installed, double-click **[Start MoveIDE.command](Start%20MoveIDE.command)** instead.

Already installed? Preserve local changes, update safely with `git pull --ff-only`, then run `npm run demo`. If something is missing or a port is busy, run **`npm run doctor`** for a read-only check. [Full setup and troubleshooting](docs/quickstart.md).

## Try the saved demo

1. Open **History → Open demo session**. No camera or ChatGPT login is needed.
2. Play the recording, pause to inspect the overlay, and choose a rep.
3. Open **Rep 5 → Why** to see a movement suggestion and its supporting images. Then inspect the graph or compare the included examples.

The bundled run contains **60.2 seconds of video, seven detected reps and six saved AI reviews**. The seventh rep has no AI note because this version caps live reviews at six. These are original saved results; replay does not ask the AI to generate them again.

Use **Recording details and downloads → Export session** to move your own run. On the other computer, choose **History → Import session** and select the exported file. It includes video, notes, images, measurements and any prepared pose cache; it does not include account credentials.

[Judge walkthrough](docs/JUDGES-START-HERE.md) · [Verified demo and known issues](docs/FINAL-HANDOFF.md)

## Start your own session

Choose **Try a sample squat**, open a supported recorded clip, or select **Live camera**. For reliable squat measurements, use a steady side view with your whole body and feet visible. **Quick tour** shows the controls.

For AI coaching, use **Connect ChatGPT** in the header and sign in with your own eligible account before starting. Local tracking works without it. Coaching takes time: notes appear as reviews finish and stay available for replay. Press **Stop** to save a live session, and keep its original tab open until queued reviews finish. Starting again cancels unfinished reviews.

<details>
<summary><strong>Use your iPhone as the camera</strong></summary>

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/), then use this startup command instead:

```sh
npm run demo -- --phone
```

On the Mac, open **Live camera → iPhone via private link → Start coached squat**. Scan the QR code with your iPhone, open the link in Safari, tap **Start camera** and allow camera access. Keep both devices on the same Wi-Fi and the phone page open.

The phone sends video to the Mac; the Mac runs pose tracking and sends feedback back. The phone needs no pose-model installation. Only the dedicated phone service gets temporary HTTPS access; the app and account service remain private. Keep the pairing link private. Venue Wi-Fi may restrict connections, so rehearse on the actual devices.

[Phone setup and recovery checklist →](docs/quickstart.md#iphone--macbook)

</details>

## Where your data goes

| Data | Where it is used |
| --- | --- |
| Full recording and pose measurements | Processed on your laptop; saved in this browser’s local History when saving is enabled. |
| Optional AI review | Selected source JPEGs and a bounded measurement summary go to the connected ChatGPT service. The full video is not sent to ChatGPT. |
| iPhone camera feed | Streams to the paired laptop through WebRTC. Recording and analysis happen on the receiving laptop. |
| Exported session | A portable copy you choose to transfer. ChatGPT sign-in does not synchronize History. |

Local measurement is free. Optional AI requires your own eligible account and is subject to its usage limits. Source-image selection is bounded to up to 32 images per reviewed live rep; it is not continuous full-video AI streaming.

“Save on this device” is on by default. Live recordings are bounded to five minutes / 100 MiB and may cover only the start of a longer session. If saving fails, retry or download the unsaved recording before leaving. [History and storage details](docs/HISTORY.md).

## What the results mean

Angles are camera-based estimates, not validated anatomical measurements. Comparison curves show differences between reps; their shaded bands are visual guides, not a universal good-squat zone. Saved live coaching uses approximate recording-time alignment, while prepared pose replay follows the recorded video’s timestamps. Open the original images when you want to inspect what the AI saw.

The selected demo clips each match two manually labeled reps, with bottom-timing errors of 0 and 67 ms within a 150 ms tolerance. The older occluded challenge clip misses its labeled reps; there is no independent joint-angle accuracy certification. [Measurement evidence and limits](docs/FINAL-HANDOFF.md#developer-evidence-map).

The current release has **150 passing local tests**, **12 public preflight checks**, and **10 saved-demo replay checks**. Final hosted QA is **not a clean pass**: a History reload error is reported and the latest documented run has an outstanding verdict. [Current status](tracker.md) · [QA handoff](docs/FINAL-HANDOFF.md) · [Seldon evidence](qa/seldon-ledger.md).

## Documentation

| I want to… | Read this |
| --- | --- |
| Understand the product or present it | [Pitch and presentation](docs/PITCH.md) |
| Try it as a judge | [Judge guide](docs/JUDGES-START-HERE.md) |
| Set up or fix my installation | [Quickstart](docs/quickstart.md) · [Claude/Codex prompts](docs/AI-SETUP.md) |
| Understand recordings and replay | [History guide](docs/HISTORY.md) |
| Develop the product | [Developer guide](docs/DEVELOPMENT.md) · [Frontend handoff](harness/FRONTEND-HANDOFF.md) |
| Integrate the harness | [Harness API](harness/README.md) · [AnalysisReport contract](_bmad-output/specs/shared/analysis-report-v1.md) |
| See the plan and verification | [Tracker](tracker.md) · [Epics](_bmad-output/specs/epics.md) · [Interactive workflow](workflow.html) |
| Check attribution | [Fixture sources](fixtures/squat/README.md) · [Third-party notices](harness/setup/THIRD-PARTY-NOTICES.md) |

For development: `npm run typecheck`, `npm test`, and `CI=1 npm run build`. Use `CI=1 npm run dev` to skip the historical automatic Git pull. Chrome is required for browser tests. OpenCap import is available in the harness; native OpenCap inference and expanded movement support remain outside this demo.

MoveIDE source is licensed under **[MIT](LICENSE)**. Model, runtime and dataset licenses are listed separately in the notices above.
