# Local session history and recordings

User decision: **save locally for this demo**, confirmed2026-11-07. This is part of the product flow, not a raw-report archive. Implemented with scoped local browser acceptance; final Seldon product verdicts are pending. Evidence and remaining physical-device gates are tracked in [tracker.md](../tracker.md).

## Experience

- **Save on this device** is visible beside Start, enabled by default. Turning it off applies to that session. Upload/sample analysis remains usable when saving fails.
- A completed recorded analysis stores its original video and report. Validated AI coaching updates the same session; replay uses the stored response and makes no new provider request.
- Live sessions can record the received camera video on the analysis computer. **Stop** finalizes and saves it with bounded measurements, accepted coaching and exact retained evidence images. Show Recording → Saving → Saved; never claim persistence before the transaction completes.
- Stop also keeps the recording, accepted coaching and historical measurements on screen for immediate review until a new Start. Switching the source dropdown alone retains the review. With saving off, the bounded recording remains only in memory and is cleared on new Start/page exit; no IndexedDB session is created.
- Saved live replay offers slow playback, concise notes with full Why, approximate note navigation and a bounded measurement inspector. Missing timing, recording prefixes or unmatched view/time evidence withhold associations. Live replay has no frame-exact overlay; recorded-video analysis retains its original source-timed overlay.
- **History** lists saved sessions with title, date, source kind, duration, rep count/model where available and recording availability. Search, rename, reopen, download and explicit delete make the data usable.
- Recorded history restores the source-bound overlay, measurements, phase navigation and coaching details. Live history shows a playable recording and readable notes/metrics with explicit timing provenance. Approximate recording alignment must not masquerade as frame-exact overlay or evidence.
- Saving errors stay beside the session with a retry action. A newer session does not inherit an older save's status. A successful source/result remains usable when an optional storage operation fails.

## Storage contract and limits

Use IndexedDB with versioned metadata and media stored separately. Session IDs are stable and distinct from report-local rep IDs. A video SHA-256 protects source association across storage/reopen; integrity failures must block source-bound replay instead of showing measurements on the wrong clip. Update omitted fields without deleting previously stored media/coaching. Atomic writes commit metadata and assets together, or leave the prior session intact.

Initial demo limits:100MiB per recording and500MiB total saved application data. Live capture also has a five-minute video limit; if analysis continues after that, label the recording as a prefix. Live history keeps up to1,200 metric samples at most4Hz,150 completed reps,six accepted AI notes and18 evidence JPEGs. These are bounded review data, not every camera frame. Truncation flags remain in exported metadata. Never silently evict older sessions. Browser quota may be lower than the app limit, so the actual write can still fail. Preserve local analysis and let the user download or delete selected older data.

Storage belongs to the **same browser, profile and origin**. Use`http://127.0.0.1:4173` consistently: localhost,127.0.0.1, other ports, other browsers and other devices are separate stores. Restarting the app server does not intentionally clear history. Clearing site data/private-browsing cleanup or browser eviction can remove it; downloadable originals and JSON are the portable backup. Browser persistence support/status is not a cloud backup or an absolute durability guarantee. [MDN storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Phone recordings save on the Mac receiving/analyzing the stream, not automatically in the phone's Photos library. ChatGPT account sign-in does not synchronize history. Source video/landmark traces stay local; only the separately disclosed bounded coaching images/metrics are sent through the existing provider.

Do not put provider credentials, pairing invitations, access tokens or arbitrary local file paths into session metadata. Deleting a session removes its associated saved video/evidence; require an inline session-specific confirmation. Removing local history does not retract an already completed provider request.

## Acceptance stories

| ID | Status and evidence | Required proof |
| --- | --- | --- |
| HIST-1 · Durable recorded review | Passed · [root history](../qa/history-root.json) | Analyze sample, save original/report, reload, reopen; hashes/metrics/notes match and no new analysis/provider request occurs |
| HIST-2 · Useful history | Passed · [22 root/live viewer checks](../qa/history-root.json) | Search, rename, inspect metadata, play/review, download video/JSON, cancel and confirm deletion; missing/deleted IDs show a useful state |
| HIST-3 · Live recording | Passed in Chrome · [recorder tests](../harness/history/live-recorder.test.mjs), [live integration](../harness/live/app.browser.test.mjs) | Real browser MediaRecorder video can replay after Stop/reload; telemetry and accepted notes persist; source-vs-recording timing is explicit |
| HIST-4 · Failure and lifecycle | Passed · [six races/recovery checks](../qa/history-races.json), [live download recovery](../harness/live/save-recovery.browser.test.mjs) | Opt-out, unavailable storage, quota/oversize/integrity errors, aborted source changes, old-save/new-session race and retry preserve correct ownership |
| HIST-5 · Data retention | Passed · [10 storage groups](../harness/history/browser-verification.json) | Versioned transactions, bounded assets, no silent eviction, coherent metadata/media deletion, no credentials or room tokens in saved exports |

Synthetic camera tests establish browser recording/lifecycle behavior. Physical iPhone codecs, background interruptions and device-storage behavior require their own acceptance. Crash recovery for an in-progress unsaved recording and cross-device sync are not promised by this local demo.

Post-merge evidence: root/live history 22/22; source/save/recovery races 6/6; atomic storage 10 groups; production-preview root coaching 15/15. These tests use real local Heavy or MediaRecorder where stated and controlled/disconnected providers. They are not physical iPhone, actual disk-full, or independent angle-accuracy tests.

Recorded save failures remain available while History is used to free storage; return and retry without reanalysis. Live failures allow downloading the finalized video (when available), session JSON and retained JPEGs before retry or discard. Each older asynchronous save keeps its own session identity/status.
