# Give this to your coding assistant

These prompts set up the **existing MoveIDE repository**. They do not ask an assistant to recreate the product or invent new pose calculations. Start with a normal macOS/Linux terminal and Node.js22.18+ ([official downloads](https://nodejs.org/en/download)). The launcher does not install Node. Phone mode also needs [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/).

## Claude copy-paste

```text
Set up and run MoveIDE from https://github.com/quinn-lgtm26/MoveIDE.git.
Work in the existing checkout if there is one; otherwise clone it into a new MoveIDE directory.
Read CLAUDE.md, AI.md, docs/quickstart.md, docs/DEVELOPMENT.md, and tracker.md first.
Do not recreate the app or change the selected pose models.

Inspect git status and the remote before updating. Fetch main. Fast-forward only if safe;
preserve local changes and report conflicts instead of resetting or force-pushing.
Check Node22.18+, npm and the supported macOS/Linux platform. If a prerequisite is
missing, give the official installation step; don't bypass OS/browser security prompts.
Run npm run doctor. Missing dependencies/models are expected on a fresh checkout.
Run npm run demo -- --setup-only, then npm run doctor again.
The setup installs locked dependencies and verifies Heavy/Full models and WASM locally.
Do not commit downloaded models, node_modules, recordings, account tokens or private links.

If a MoveIDE app is already healthy on127.0.0.1:4173, show it and preserve its session.
Otherwise run npm run demo in a terminal that stays alive. Open the printed root and
/harness/live/ pages. The ordinary command opens no public tunnel.
Verify the included recording produces actual measurements and that errors are visible.
Use the user's browser for any account/camera permission step. Local analysis works
without ChatGPT; never claim AI coaching passed unless a real response was observed.

Explain where History is stored: this browser/profile on this exact local origin,
not the ChatGPT account or GitHub. Reopen a saved session without requesting new AI.
Leave the app running and report the commit, local URLs, checks that passed, and any
remaining device/account prerequisites. Do not claim a physical phone test from emulation.
```

## Codex copy-paste

```text
Set up and run https://github.com/quinn-lgtm26/MoveIDE.git locally; finish the setup
and show me the actual running product. Read AGENTS.md -> CODEX.md -> AI.md, then
docs/quickstart.md, docs/DEVELOPMENT.md and tracker.md.

Find the existing checkout or clone into a new directory. Inspect git status and
origin; fetch main and fast-forward only when safe. Preserve uncommitted work and
other running services. Never reset/force-push to make setup convenient.
Require Node22.18+ and macOS/Linux; use official prerequisite instructions if missing.
Run npm run doctor (read-only), npm run demo -- --setup-only, and npm run doctor.
Use the pinned dependency locks/model manifest; no model binaries or secrets in Git.

If the existing app is healthy on127.0.0.1:4173, leave it running and open it.
Otherwise run npm run demo and keep its terminal alive. Verify the root sample
and open /harness/live/. Do not start a second service on an occupied port.
Let me complete camera/account permissions. ChatGPT setup is optional for local
measurements; describe observed connected AI separately from mock or offline tests.

Explain local History, original-video/report downloads, and Stop-to-save for live
recordings. Do not claim cloud sync or permanent browser storage. Use the same
browser/profile and127.0.0.1:4173 to reopen saved sessions.
Finish with commit, working URLs, verified behavior and concrete remaining steps.
Do not spend Seldon/Wren simulations as part of installation.
```

## Add this for iPhone QR + WebRTC

Append this to either prompt when you want the phone workflow:

```text
Also set up iPhone -> MacBook video using the app's private QR/WebRTC workflow.
Check cloudflared is installed using the official Cloudflare instructions. Phone
mode intentionally makes only the dedicated pairing service on4176 reachable over
temporary HTTPS. Keep the ChatGPT/provider app on4173 loopback-only.
If an existing phone-enabled launcher is healthy, reuse it. Otherwise stop only
the prior launcher I started for this app and run npm run demo -- --phone.
Never kill unrelated port owners or expose the whole repository/provider.

Open /harness/live/ on the Mac, choose iPhone via private link, then Start coached
squat. Show the in-app QR privately. I will scan it in iPhone Safari, tap Start camera
and grant camera access. Do not print/store the pairing invitation in logs or Git.
Keep the phone foregrounded and whole body visible. Verify actual arriving video,
local tracking and returned captions separately. Recordings/history save on the Mac.
Stop ends the stream and saves an enabled local recording; wait for Saved before leaving.
If pairing fails, inspect the relevant stage: HTTPS page, permission, signaling,
WebRTC media, pose assets, then optional coach. Don't infer one passed from another.
Report physical-device results only after observing them. No TURN/general-network
guarantee or arbitrary-angle accuracy claim.
```

## Expected result

- A healthy local app on`http://127.0.0.1:4173/` and live page at`/harness/live/`.
- Verified pose assets on the analysis computer. The phone sender downloads no pose model.
- A running terminal whose Ctrl+C cleans up only its owned services.
- A clear account/camera handoff where needed; installation does not require sharing credentials in chat.
- A truthful distinction between working local analysis, connected AI, and physical phone acceptance. See [current evidence](../tracker.md).

For a developer implementing features rather than installing the demo, use [DEVELOPMENT.md](DEVELOPMENT.md) and the current contracts; these setup prompts do not authorize publishing unrelated code or spending QA credits.
