# Try MoveIDE

[GitHub repository](https://github.com/quinn-lgtm26/MoveIDE) · [Current delivery status](../tracker.md) · [QA evidence](../qa/PRODUCT-CONTEXT.md)

MoveIDE turns a squat video into local motion measurements, rep comparisons and optional evidence-linked ChatGPT coaching. The fastest demonstration uses the included public recording; no camera or phone is required.

## Download and start

Use macOS or Linux, **Node.js 22.18+ with npm**, and **Google Chrome**. The clone command needs Git. First setup needs network access and disk space for locked dependencies, the pinned Heavy/Full pose models and the built app; allow several minutes. The launcher installs the app dependencies and verifies model downloads automatically. It does not install Node or Chrome. See [official Node downloads](https://nodejs.org/en/download).

In a terminal, choose a parent folder where `MoveIDE-judge` does not already exist, then run:

```sh
git clone https://github.com/quinn-lgtm26/MoveIDE.git MoveIDE-judge && cd MoveIDE-judge && npm run demo
```

Alternatively, use GitHub **Code → Download ZIP**, extract it, open a terminal in that folder and run `npm run demo`. On macOS, double-clicking **Start MoveIDE.command** in the extracted folder also starts setup. Keep the terminal open while using the app.

Open **[MoveIDE locally](http://127.0.0.1:4173/)** when the launcher says it is ready. GitHub is the source download, not a hosted analysis service. Each judge runs their own local app and keeps their own account and recordings.

## Connect the optional coach

1. Look for the persistent **ChatGPT** status in the header on the home or live page. Local measurements work without an account connection.
2. Select **Connect ChatGPT**, complete the browser sign-in with your own eligible ChatGPT account, and return to the local app. Account eligibility and usage limits still apply; this repository does not include a shared subscription or bypass them.
3. Choose **Try a sample squat** after returning. This starts a new analysis/coaching session using the connected account. It sends selected source JPEGs and bounded measurements automatically; the full video stays local. No API key, packet copy or separate Send action is required.

Allow the asynchronous coach time to return. An unavailable account or model leaves local measurements usable and shows the connection/error state. Never treat a disconnected or mock result as a successful live AI review.

## A roughly 90-second tour after setup

| Action | What to inspect |
| --- | --- |
| **Try a sample squat** | Real MediaPipe Heavy measurements, detected reps and the source-timed overlay. Play, pause and seek; accepted coaching stays in short cards with expandable Why. Model warm-up and AI response may take longer than the tour. |
| **Compare examples** | Two independently analyzed public videos. Pick each recording's rep and Compare bottoms. Good/Bad labels belong to the source dataset. Differences are descriptive, not a validated universal technique standard. |
| **Live camera → Start coached squat** | Grant camera permission, stand side-on with your whole body visible, and do a few reps. Local angles/graphs appear without AI. Completed reps queue for coaching when connected. |
| **Stop → Open saved session / History** | Camera capture ends, replay and measurements remain, and queued reviews continue in the original live tab. See detected reps separately from saved AI reviews. Reopening or seeking never requests another AI analysis. |

In the live graph, **Compare with your first rep** provides a personal reference. The curved comparison aligns the down and return phases at start/bottom/end while keeping knee angles in degrees; compare actual phase durations separately. The selectable ±5°/±10°/±15° tolerance is a visual aid for differences from your own reference, not an error guarantee or a “good form” zone. Missing tracking stays missing, and incompatible views cannot establish a comparison. This increment needs its linked local and final-build checks before a submission GO; consult the tracker for that status.

For live sessions, keep the original live tab open until queued reviews finish. The queue allows up to six reviews, one at a time, with at least eight seconds between dispatches. Starting another session cancels unfinished reviews from the previous one; closing the tab interrupts the queue. Older sessions do not gain invented or retroactive reviews.

Saved live replay prepares a local pose overlay from the recorded video, with progress and Cancel. After preparation, pause or seek to inspect the estimated skeleton; cached reopen reuses it without another model pass. Coach-note links still show approximate recording alignment, and original live rep counts remain unchanged. This preparation sends no new AI request.

History is local to this browser profile and **this exact app address**. ChatGPT login does not sync recordings. Phone recordings save on the receiving computer. Live replay alignment is approximate, and exact source JPEG evidence is shown separately. Download the original video and measurements for a backup. No angles are fabricated when tracking is unavailable.

## Optional iPhone → MacBook demonstration

Use the same Wi-Fi and install `cloudflared` through [Cloudflare's instructions](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). This tool is needed only for phone pairing. Stop your own existing launcher with Ctrl+C, then run:

```sh
npm run demo -- --phone
```

On the Mac, choose **Live camera → iPhone via private link → Start coached squat**. Scan the private QR with the iPhone, open it in Safari, tap **Start camera**, and grant camera access. Keep Safari in the foreground. Video travels to the Mac; local feedback and delayed AI captions return to the phone. The phone installs no pose model.

Only the dedicated phone transport on 4176 receives a temporary HTTPS address. The account/provider app on 4173 stays private. Do not expose the provider through a tunnel or share a pairing invitation publicly. Same Wi-Fi does not guarantee WebRTC connectivity on isolated venue networks; no universal TURN fallback is configured. [Phone recovery checklist](quickstart.md#iphone--macbook).

## Evidence and limits

- [Fresh setup evidence](../qa/fresh-setup-history.json): clean checkout, automatic locked installs, verified model assets and build on `efe97bd`. This is historical install evidence; the tracker identifies later runtime revisions.
- [Queued-review phone regression](../qa/phone-queued-review.json): real HTTPS/WebRTC, Heavy and connected ChatGPT using a public fixture stream, including AI arriving after Stop and enriching the same recording. This is **not** a physical iPhone test.
- [Current local checkpoint](../qa/phone-repair-checkpoint.json) and [layout probe](../qa/live-layout-polish.json) identify their tested revisions, source hashes and controlled/mock boundaries.
- Wren passed the [earlier polished build](../qa/wren-final-results.json). The newer `32159db` rerun is [tracked here](https://app.seldon.com/experiments/60ba178a-ee4e-469e-a676-57074a9b88ae); final acceptance for subsequent changes remains pending. Consult [the ledger](../qa/seldon-ledger.md) and [tracker](../tracker.md) for terminal verdicts rather than assuming an old pass covers new code.

The product measures supported squat motion using projected estimates. It does not certify clinical angles, an ideal squat for everyone, arbitrary moving-camera accuracy or calibrated 3D. Native OpenCap inference is deferred. Physical iPhone/venue verification remains separate from browser fixture tests.

If startup fails, run **`npm run doctor`** for read-only diagnostics. Missing assets/dependencies on a fresh checkout are repaired by `npm run demo`; occupied ports are left alone. Setup helpers never stop unrelated processes or spend Wren credits. For an assistant-led install, use [these Claude/Codex prompts](AI-SETUP.md).
