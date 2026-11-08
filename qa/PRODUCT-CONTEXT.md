# MoveIDE QA product knowledge

Updated 2026-11-07. This and the Seldon baseline describe the current product. Earlier manual handoff experiments are historical.

MoveIDE is local squat video review and live coaching. One action coordinates video, MediaPipe Heavy measurements, source evidence and optional connected ChatGPT coaching. A normal user never copies a packet. Recorded review uses Try a sample squat or upload; live uses Start coached squat. Two examples demonstrate independent recordings, not validated good/bad labels.

## Current journeys
- Recorded: analyze, play/step with overlay, review reps, select evidence and compare phases. Disconnected ChatGPT does not block measurements.
- Comparison: two sources, independently chosen reps, equivalent phase navigation and identical metric definitions.
- Live: camera or iPhone sender, local Heavy, short retained coaching cards, Stop and save. Private QR invites are temporary. Dedicated public phone transport does not expose the provider.
- History: default-on local saving, original video/report/accepted notes, rename/search/delete/export, hash-verified reopen without new inference. Browser/profile/origin owns data; phone recordings save on the receiving Mac. No cloud sync.
- Setup: npm run demo prepares pinned assets; npm run doctor diagnoses read-only. Copy-paste AI setup prompts are in docs/AI-SETUP.md.

## Final review requirements

Stop ends capture, not the review experience. Preserve the completed in-memory recording, historical measurements and accepted coaching until a new Start. Saved History remains independently available across reloads. Clearly distinguish recorded replay from live tracking and approximate live-recording timing from source-exact recorded-video evidence. Keep short coaching cards visible, with full reasons available on demand.

History review should show the recording beside concise notes, offer slow playback and a bounded measurement inspector, retain keyboard focus, and use quiet transitions that respect reduced motion. The jointed movement logo is a brand identity, not a claim that gait or other exercises are supported. The proposed history chat is **on hold** at the user's request.

## Truth and scope
33 landmarks and estimated world coordinates are not calibrated 3D truth. Recorded metrics use a supported side view. Live front/oblique/orbit support is experimental and gates unsupported measurements. Full-body visibility alone does not establish accuracy. There is no clinical correctness or universal ideal-angle claim. OpenCap import exists; native GPU inference is user-deferred.

AI cards are concise, retained, source-cited and actionable when supported. Delayed inference is asynchronous, not per-frame AI interpretation. Playback sends no new AI request. Unreliable current values clear while accepted historical notes remain labeled.

## Hosted QA boundary
The preview contains approved public fixtures and pinned model assets, with a disconnected provider. No credentials, personal recordings or pairing capabilities are exposed. Wren can test recorded analysis, comparison, history and navigation. Real ChatGPT, physical iPhone/WebRTC, venue networking and independent angle accuracy need separate evidence.

Seldon search_knowledge reads previous findings, not product-document writes. The updated baseline embeds current context into experiments; their reports become searchable evidence. This account rejects persona/usability access, so task-based Wren plus local UX review are the available paths. No persona study has run.
