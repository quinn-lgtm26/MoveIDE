# Start the MoveIDE demo

From the repository on your Mac:

```sh
node scripts/start-demo.mjs
```

The launcher checks Node/dependencies and ports, prepares the pinned pose/QR assets, builds the current code without pulling Git changes, then starts the private app on **127.0.0.1:4173** and dedicated pairing service on **127.0.0.1:4176**. Open the printed local app address. Use **Start coached squat** for a recording, or **Live coached squat** for a camera session. The default command opens no public tunnel.

Keep that terminal open. **Ctrl+C** stops only child processes started by the launcher. If a port is occupied, startup stops with a clear message; it never kills an existing app or test process.

## First run

Use Node.js 22.18 or newer. If dependencies are missing, install the repository's locked versions once:

```sh
npm ci
npm --prefix harness ci
node scripts/start-demo.mjs
```

Asset setup may need network access on the first run. The launcher uses the existing pinned setup script and does not install new tools or change account credentials. Initial ChatGPT connection happens in the app; connected sessions can automatically send bounded rep images/measurements under the Start disclosure. Local analysis still works when the coach is disconnected.

## iPhone → MacBook

An installed `cloudflared` executable must be available on PATH. Use the [official installation instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) if needed; the launcher does not install it automatically.

```sh
node scripts/start-demo.mjs --phone
```

This additionally creates a temporary trusted HTTPS address for **the dedicated pairing service on port 4176 only**, configures that address, and checks that the phone page is reachable. The app/provider on port 4173 remains loopback-only. Existing cloudflared configuration is bypassed for this temporary tunnel; its metrics listener also stays on loopback. Raw tunnel output, account credentials and pairing invitations are not printed by the launcher.

1. Keep the iPhone and MacBook on the same Wi-Fi. Open the printed **Live camera** address on the Mac.
2. Choose **iPhone via private link**, then **Start coached squat**. Scan the private QR shown in the app, or open its private link on the iPhone.
3. In iPhone Safari, tap **Start camera** and allow camera access. The rear camera streams to the paired Mac; the microphone is off. Laptop tracking begins when the stream arrives.
4. Keep your full body visible and the phone page in the foreground. Use the supported camera view for the current measurement. Stop from the session controls, or end the launcher with Ctrl+C.

The QR/link contains temporary pairing access; use the app to share it directly with your phone. The HTTPS hostname changes each time phone mode starts. Quick Tunnels are intended for development, have no uptime guarantee and do not support SSE; the phone sender uses the repository's long-polling path. The laptop receiver remains local. See [Cloudflare's Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Same Wi-Fi does not guarantee peer connectivity on isolated venue networks. A reachable phone page proves HTTPS delivery, not video/pose accuracy. Actual iPhone permission, connection, motion, foreground/lock behavior and venue latency still need a device rehearsal. The launcher does not run Wren, certify arbitrary-angle accuracy or upload the full video to ChatGPT.

## Check or recover

```sh
# No build, services or tunnel; connect-only checks do not bind demo ports.
node scripts/start-demo.mjs --check
node scripts/start-demo.mjs --phone --check
```

| Message / symptom | Next step |
| --- | --- |
| Port already in use | Stop your prior demo process or wait for its tests; retry. The launcher leaves it alone. |
| Dependencies missing | Run both locked `npm ci` commands above. |
| TypeScript/Vite build failed | Run `CI=1 npm run build` to see the detailed build error; fix it before starting. |
| Pinned asset setup failed | Run `node harness/setup/pose-assets.mjs` from the repository and check network access. |
| Phone mode needs cloudflared | Install it through the official instructions, then retry; no tunnel is started by `--check`. |
| No HTTPS phone address / readiness timed out | Check network access or use the default command with Mac camera. The launcher tears down its own incomplete startup. |
| Phone camera permission denied | Allow camera access in Safari and start the camera again; a new pairing session may be needed after expiry. |
| Coach disconnected | Connect through the app's setup action, then start a new session; local tracking remains available. |

Launcher scope: macOS/Linux. Its helper checks cover occupied-port refusal, URL parsing and owned-child cleanup. A full real phone startup is separate from those checks.
