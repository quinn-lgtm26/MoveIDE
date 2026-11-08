# Start the MoveIDE demo

Use the [Claude/Codex copy-paste prompts](AI-SETUP.md) for an assisted setup, or the commands below. Developers can follow [DEVELOPMENT.md](DEVELOPMENT.md).

From the repository on your Mac:

```sh
npm run demo
```

The launcher checks Node and ports, installs missing or version-mismatched locked dependencies, prepares the pinned pose/QR assets, builds the current code without pulling Git changes, then starts the private app on **127.0.0.1:4173** and dedicated pairing service on **127.0.0.1:4176**. Open the printed local app address. Use **Try a sample squat** for a recording, or open **Live camera** and choose **Start coached squat** for a camera session. The default command opens no public tunnel.

Keep that terminal open. **Ctrl+C** stops only child processes started by the launcher. If a port is occupied, startup stops with a clear message; it never kills an existing app or test process.

## First run

Use Node.js 22.18 or newer. Run `npm run demo`, or double-click **Start MoveIDE.command** on macOS. Missing or version-mismatched app/harness dependencies are installed with `npm ci`; model and WASM files are downloaded and checked against the pinned manifest. Large model binaries stay out of GitHub. Each computer running the analysis app prepares its own local assets. The iPhone sender does not install MediaPipe or download the Heavy model: it sends camera video to the Mac, where analysis runs.

To prepare a fresh checkout without starting services:

```sh
npm run demo -- --setup-only
```

Asset setup may need network access on the first run. The launcher uses the pinned setup script and locked npm dependencies. It does not install Node/cloudflared or change account credentials. Initial ChatGPT connection happens in the app; connected sessions can automatically send bounded rep images/measurements under the Start disclosure. Local analysis still works when the coach is disconnected.

## Open the same saved demo on another computer

For an existing checkout, preserve local changes and update with `git pull --ff-only` when safe, then run `npm run demo`. A fresh clone or ZIP uses the normal first-run setup above.

1. Open **History → Open demo session**. The button is shown only when `/demo/session.json` is present in the build; it points to the portable `.moveide.json` demo package.
2. Open the imported recording and play, pause or seek. Saved coaching and source evidence are already included; **ChatGPT login is not needed to replay them**.
3. Expect approximately **60.2 seconds, 7 detected reps and 6 AI reviews** in the designated demo. The session allows up to six AI reviews, so an additional detected rep can remain without a coach note while retaining its video and measurements.

The package includes the original video, original saved notes and JPEG evidence, live measurement data, and the prepared report/cache when available. Import validates the package and creates a new local session ID. It carries no account credentials, pairing invitation or authenticated ChatGPT session. Existing browser history stays local; signing in does not synchronize it. If the pose cache is absent, a bounded local preparation pass can run without sending an AI request.

For your own recording, open **Recording details and downloads → Export session** and transfer the resulting `.moveide.json` file. On the other computer choose **History → Import session**. Unlike a measurements-only JSON download, the session export includes the saved media needed for replay. Treat an export as a copy of its recording and coaching; share it only with the people you intend to receive that content.

The designated bundle is served from `harness/public/demo/latest-session.moveide.json` with its manifest at `harness/public/demo/session.json`. Both files are published in `ab492c0`. [Ten fresh-browser checks](../qa/published-demo-replay.json) verify video identity, all seven reps/six reviews, 75 evidence JPEGs, 198 samples and 903 cached pose frames, without a new worker or AI request. If **Open demo session** is missing, update safely and run `npm run demo` again, or use **Import session** with an exported bundle. Connect your own eligible ChatGPT account only for new AI coaching.

## iPhone → MacBook

An installed `cloudflared` executable must be available on PATH. Use the [official installation instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) if needed; the launcher does not install it automatically.

```sh
npm run demo -- --phone
```

This additionally creates a temporary trusted HTTPS address for **the dedicated pairing service on port 4176 only**, configures that address, and checks that the phone page is reachable. The app/provider on port 4173 remains loopback-only. Existing cloudflared configuration is bypassed for this temporary tunnel; its metrics listener also stays on loopback. Raw tunnel output, account credentials and pairing invitations are not printed by the launcher.

1. Keep the iPhone and MacBook on the same Wi-Fi. Open the printed **Live camera** address on the Mac.
2. Choose **iPhone via private link**, then **Start coached squat**. Scan the private QR shown in the app, or open its private link on the iPhone.
3. In iPhone Safari, tap **Start camera** and allow camera access. The rear camera streams to the paired Mac; the microphone is off. Laptop tracking begins when the stream arrives.
4. Keep your full body visible and the phone page in the foreground. Use the supported camera view for the current measurement. Stop from the session controls, or end the launcher with Ctrl+C.

The QR/link contains temporary pairing access; use the app to share it directly with your phone. The HTTPS hostname changes each time phone mode starts. Quick Tunnels are intended for development, have no uptime guarantee and do not support SSE; the phone sender uses the repository's long-polling path. The laptop receiver remains local. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Same Wi-Fi does not guarantee peer connectivity on isolated venue networks. A reachable phone page proves HTTPS delivery, not video/pose accuracy. Actual iPhone permission, connection, motion, foreground/lock behavior and venue latency still need a device rehearsal. The launcher does not run Wren, certify arbitrary-angle accuracy or upload the full video to ChatGPT.

## Check or recover

`npm run doctor` is a read-only diagnostic that checks direct dependency locks, pinned model hashes, all four prepared runtime files, build presence and private app health. It is safe while a demo is already running. `node scripts/doctor.mjs --json` returns machine-readable results. It does not inspect credentials, open a camera or spend QA credits.

```sh
# No build, services or tunnel; connect-only checks do not bind demo ports.
npm run demo -- --check
npm run demo -- --phone --check
```

| Message / symptom | Next step |
| --- | --- |
| Port already in use | Stop your prior demo process or wait for its tests; retry. The launcher leaves it alone. |
| Dependencies missing during `--check` | Run `npm run demo`; it installs both dependency groups automatically. |
| TypeScript/Vite build failed | Run `CI=1 npm run build` to see the detailed build error; fix it before starting. |
| Pinned asset setup failed | Run `node harness/setup/pose-assets.mjs` from the repository and check network access. |
| Phone mode needs cloudflared | Install it through the official instructions, then retry; no tunnel is started by `--check`. |
| No HTTPS phone address / readiness timed out | Check network access or use the default command with Mac camera. The launcher tears down its own incomplete startup. |
| Phone camera permission denied | Allow camera access in Safari and start the camera again; a new pairing session may be needed after expiry. |
| Coach disconnected | Connect through the app's setup action, then start a new session; local tracking remains available. |

Launcher scope: macOS/Linux. Its helper checks cover occupied-port refusal, URL parsing and owned-child cleanup. A full real phone startup is separate from those checks.

The launcher may wait up to two minutes for a new phone HTTPS hostname to resolve. A transient OS DNS failure can occur even when browser DNS works; the failure message names the stage and error without printing private pairing links. Retry the same setup once DNS recovers; do not bypass browser TLS warnings.

## Verified setup and current demo evidence

The latest fresh-install acceptance used an `efe97bd` checkout with no dependencies, pose assets or dist. Automatic locked installs, pinned Full/Heavy hashes, four runtime files, TypeScript/Vite build and final doctor passed. No services or camera were started; occupied-port health belonged to the existing demo. See [fresh setup evidence](../qa/fresh-setup-history.json). The earlier `9446951` result remains in [its original record](../qa/fresh-setup.json).

The polished `f4a987a` runtime passed [15 controlled-provider production checks](../qa/root-one-start.json), [nine real ChatGPT checks](../qa/root-live-chatgpt.json), including saved notes and reload without new inference, and [all three final Wren workflows](../qa/wren-final-results.json). Both core workflows were rerun on that same frozen build. The source audit at `d17cb2a` found only documentation/evidence changes since that tested runtime; later runtime changes require their own affected-gate verification.

The public HTTPS phone workflow passed real WebRTC, Heavy and returned **real ChatGPT** coaching across two Chrome contexts using a fixture-backed synthetic camera. One three-phase request returned in10.209 seconds as historical coaching after adaptive resolution changed. This is not a physical iPhone test or latency guarantee. [Phone evidence](../qa/phone-https.json).

The published portable demo is ready for hands-on saved replay. The exact `ab492c0` public build passes [12 preflight checks](../qa/release-public-preflight.json); final Wren run [f0047a86](https://app.seldon.com/experiments/f0047a86-ebfb-4918-924e-cec64026bdb6) has one reported History reload failure and one case without a verdict, so final hosted sign-off is not granted. Physical iPhone/venue rehearsal, broader accessibility and independent angle/orbit accuracy remain open. OpenCap import UI, evidence-bound region accents, selectable goals/references and automatic viewpoint/calibration are unfinished implementation, distinct from those external checks. Native OpenCap execution is deferred. See [the current story backlog](../_bmad-output/specs/epics.md) before extending the product.

## Compare the two included recordings

On the recorded page choose **Compare examples**. Both videos run through the selected Heavy/Full model locally. Use **Compare bottoms** or choose each recording’s rep to inspect corresponding phases. The three primary measurements have expandable detail; the recordings keep separate source clocks and hashes. This action does not send an AI request or declare either person’s technique good/bad. **Try a sample squat** returns to the integrated single-recording AI workflow.

If Safari reported “did not present the requested video frame,” update to include `6c1bae0` or later: that was a decoder callback problem, not a missing model. Its fallback uses the seeked media time when Safari omits the decoded-frame callback. Physical iPhone and HEVC decoder coverage remain separate.
