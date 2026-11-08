# MoveIDE QA product knowledge

Updated 2026-11-08 UTC. This and the Seldon baseline describe the current product. Earlier manual handoff experiments are historical. Acceptance below is a requirement; a particular build is verified only by its linked report.

MoveIDE is local squat video review and live coaching. One action coordinates video, MediaPipe Heavy measurements, source evidence and optional connected ChatGPT coaching. A normal user never copies a packet. Recorded review uses Try a sample squat or upload; live uses Start coached squat. Two examples demonstrate independent recordings, not validated good/bad labels.

## Current journeys
- Recorded: analyze, play/step with overlay, review reps, select evidence and compare phases. Disconnected ChatGPT does not block measurements.
- Comparison: two sources, independently chosen reps, equivalent phase navigation and identical metric definitions.
- Live: camera or iPhone sender, local Heavy, projected-angle graphs, personal reference and short retained coaching cards. Stop ends capture and saves while a bounded queue finishes the current session's reviews. Private QR invites are temporary. Dedicated public phone transport does not expose the provider.
- History: default-on local saving, original video/report/accepted notes, rename/search/delete/export, hash-verified reopen without new inference. Browser/profile/origin owns data; phone recordings save on the receiving Mac. No cloud sync.
- Setup: npm run demo prepares pinned assets; npm run doctor diagnoses read-only. Copy-paste AI setup prompts are in docs/AI-SETUP.md.

The [judge packet](../docs/JUDGES-START-HERE.md) starts from the public GitHub repository, a clean folder and `npm run demo`, then optional eligible-account connection. Its roughly 90-second tour starts after installation; it does not promise model downloads or AI latency finish in 90 seconds. Acceptance distinguishes local installation, actual eligible ChatGPT response, controlled fixture streaming, physical phone rehearsal and terminal Wren verdicts. A GitHub link is not a hosted provider service or shared subscription.

## Final review requirements

Stop ends capture, not the review experience. Preserve the completed in-memory recording, historical measurements and accepted coaching until a new Start. Saved History remains independently available across reloads. Clearly distinguish recorded replay from live tracking and approximate live-recording timing from source-exact recorded-video evidence. Keep short coaching cards visible, with full reasons available on demand.

History review should show the recording beside concise notes, offer slow playback and a bounded measurement inspector, retain keyboard focus, and use quiet transitions that respect reduced motion. The jointed movement logo is a brand identity, not a claim that gait or other exercises are supported. The proposed history chat is **on hold** at the user's request.

Detected reps and AI-reviewed reps are different. Three detected reps with one accepted note must remain understandable, with one review count and an honest state for each other detected rep. Older sessions without status records say status unavailable; they do not invent a failure or new coaching. Rolling report-local rep IDs can repeat, so chronological session rep labels must resolve through stable rep keys and view epochs.

Notes describe past evidence. During replay, associate a note with its detected rep interval and keep the full note list available afterwards. Label original analysis time separately from approximate recorded-video time. Use the stored recording offset and playable prefix only; never assume both clocks start at zero, interpolate through a tracking gap, reuse metrics from another view, or draw a frame-exact skeleton over an approximately aligned live recording. Inspect source JPEGs separately. Reopening, playback, seeking and rep selection make no additional AI request.

Queued reviews run one at a time with at least eight seconds between dispatches, up to six per session. Stop allows that queue to finish while the original live page stays open. Starting a new session cancels old unfinished work; closing the page interrupts the queue with no automatic resume. History shows saved progress and accepted updates without resetting playback. A stale/missing heartbeat means progress is unconfirmed, not that saved queued states are still actively processing. Existing notes stay visible while another review loads; deleted sessions cannot be recreated by a late reply.

Graph acceptance is independent of AI availability: readable degree/time axes on laptop and narrow screens, knee/hip/chest estimates, no zeroes substituted for missing measurements, and breaks at view changes. Reference changes describe consistency with the person's own rep, not correctness. The illustrative 110° practice target is not an ideal angle for everyone. Distinguish exact rep-bottom evidence from a nearby archived sample used for a labeled approximate comparison.

## Truth and scope
33 landmarks and estimated world coordinates are not calibrated 3D truth. Recorded metrics use a supported side view. Live front/oblique/orbit support is experimental and gates unsupported measurements. Full-body visibility alone does not establish accuracy. There is no clinical correctness or universal ideal-angle claim. OpenCap import exists; native GPU inference is user-deferred.

AI cards are concise, retained, source-cited and actionable when supported. Delayed inference is asynchronous, not per-frame AI interpretation. Playback sends no new AI request. Unreliable current values clear while accepted historical notes remain labeled.

## Hosted QA boundary
The preview contains approved public fixtures and pinned model assets, with a disconnected provider. No credentials, personal recordings or pairing capabilities are exposed. Wren can test recorded analysis, comparison, history and navigation. Real ChatGPT, physical iPhone/WebRTC, venue networking and independent angle accuracy need separate evidence.

Seldon search_knowledge reads previous findings, not product-document writes. The updated baseline embeds current context into experiments; their reports become searchable evidence. This account rejects persona/usability access, so task-based Wren plus local UX review are the available paths. No persona study has run.
