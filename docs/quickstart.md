# Start the MoveIDE demo

Use the [Claude/Codex copy-paste prompts](AI-SETUP.md) for an assisted setup, or the commands below. Developers can follow [DEVELOPMENT.md](DEVELOPMENT.md).

From the repository on your Mac:

```sh
npm run demo
```

The launcher checks Node and ports, installs missing or version-mismatched locked dependencies, prepares the pinned pose/QR assets, builds the current code without pulling Git changes, then starts the private app on **127.0.0.1:4173** and dedicated pairing service on **127.0.0.1:4176**. Open the printed local app address. Use **Start coached squat** for a recording, or **Live coached squat** for a camera session. The default command opens no public tunnel.

Keep that terminal open. **Ctrl+C** stops only child processes started by the launcher. If a port is occupied, startup stops with a clear message; it never kills an existing app or test process.

## First run

Use Node.js 22.18 or newer. Run `npm run demo`, or double-click **Start MoveIDE.command** on macOS. Missing or version-mismatched app/harness dependencies are installed with `npm ci`; model and WASM files are downloaded and checked against the pinned manifest. Large model binaries stay out of GitHub. Each computer running the analysis app prepares its own local assets. The iPhone sender does not install MediaPipe or download the Heavy model: it sends camera video to the Mac, where analysis runs.

To prepare a fresh checkout without starting services:

```sh
npm run demo -- --setup-only
```

Asset setup may need network access on the first run. The launcher uses the pinned setup script and locked npm dependencies. It does not install Node/cloudflared or change account credentials. Initial ChatGPT connection happens in the app; connected sessions can automatically send bounded rep images/measurements under the Start disclosure. Local analysis still works when the coach is disconnected.

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

A fresh detached checkout of `9446951` with no installed dependencies or generated assets passed `npm run demo -- --setup-only`, followed by `CI=1 npm run build`. Both locked dependency groups installed automatically. Full/Heavy task files matched their pinned SHA-256 values, all four WASM/runtime files matched the locked dependency, and the built `dist/pose` copies matched too. See [fresh setup evidence](../qa/fresh-setup.json). This acceptance did not start services or use the occupied demo ports.

The public HTTPS phone workflow passed real WebRTC video, Heavy analysis and returned **real ChatGPT** coaching across two Chrome contexts, using a fixture-backed synthetic camera. One request carried three phase images; the response returned in10.209 seconds and appeared as a historical review after adaptive resolution changed. This is not a physical iPhone test or a latency guarantee. [Phone evidence](../qa/phone-https.json). Production root checks on `c1c9378` passed15 controlled-provider lifecycle checks,7 real-provider checks and20 readiness checks; subsequent UI changes require their own affected-gate rerun. Physical iPhone/venue rehearsal, independent angle/orbit accuracy and the final two Wren workflows remain separate gates.

Latest designed root checkpoint (`9446951`): [15 production-preview checks](../qa/root-one-start.json) pass. The [user-visible demo](../qa/user-visible-demo.json) also ran real Heavy (57/57 tracked samples, two reps) and real GPT-6.1 Sol, showing two retained short cards with Why collapsed. Fresh setup and built asset hashes pass on the same revision. The earlier seven-check real-provider and twenty-check readiness records retain their exact `c1c9378` scope.

## Compare the two included recordings

On the recorded page choose **Compare examples**. Both videos run through the selected Heavy/Full model locally. Use **Compare bottoms** or choose each recording’s rep to inspect corresponding phases. The three primary measurements have expandable detail; the recordings keep separate source clocks and hashes. This action does not send an AI request or declare either person’s technique good/bad. **Start coached squat** returns to the integrated single-recording AI workflow.

If Safari reported “did not present the requested video frame,” update to include `6c1bae0` or later: that was a decoder callback problem, not a missing model. Its fallback uses the seeked media time when Safari omits the decoded-frame callback. Physical iPhone and HEVC decoder coverage remain separate.
