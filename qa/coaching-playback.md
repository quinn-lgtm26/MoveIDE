# Readable coaching playback

The previous harness UI rendered a cue only within 150 ms of a cited timestamp and put the interpretation behind raw JSON below the player. Connection status alone also did not explain that an explicit generation request was required. The production React workbench still needs the provider and playback integration described in the frontend handoff.

The local harness now exposes Generate AI analysis next to the player, with idle/generating/ready/error/canceled states. After a validated response, rep segments keep observations readable throughout the relevant rep. Every active note labels its original evidence timestamps; it is not a claim of a new inference on the current frame. Readable notes, uncertainty, next focus and evidence-seek buttons remain available outside playback. Model changes and reanalysis clear stale results.

Verification: 44 harness unit tests pass. The built browser regression uses the real Heavy clip analysis and a controlled interpretation response. It verifies explicit generation, notes at descent/ascent points more than 150 ms from the bottom, rep transitions, gaps outside reps, exact evidence navigation, no requests from playback, model-change reset and reanalysis reset. The disconnected build smoke also passes. No new live-provider or Seldon request was made by these regressions.

Run `npm --prefix harness test`, `npm --prefix harness run build`, `npm --prefix harness run verify:build`, and `npm --prefix harness run verify:coaching-playback`. The separate recorded live ChatGPT result proves the provider path with its explicitly documented fixture/model; this regression establishes the new UI behavior, rather than claiming another live inference run.
