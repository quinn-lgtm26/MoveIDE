# Live squat analysis API

`startLiveSquat(video, options)` consumes an **already playing, loaded** webcam/WebRTC `HTMLVideoElement`. It never asks for camera permission, starts a connection, uploads anything, or closes caller-owned media tracks. The caller manages those. Default model is the existing SHA-256-pinned **MediaPipe Heavy**. Model/WASM assets must be same-origin and come from `npm run setup:pose`.

```js
import { startLiveSquat } from './motion/index.mjs';
const abort = new AbortController();
const live = await startLiveSquat(receivedVideo, {
  signal: abort.signal,
  // Only enable after displaying the chosen illustrative depth goal to the user.
  targetKneeFlexionDeg: 110, // default null means neutral tracking only
  captureEvidence: true, // optional; defaults false
  onSample(sample) {
    // sample.poseDisplayFrame.landmarks: normalized pose for full-body overlay
    // sample.analysisEligible + metricValidity: side-view metric eligibility
    // sample.metrics: projected knee, hip, torso, shin etc (null when unavailable)
    // sample.trackingConfidence: minimum hip/knee/ankle visibility, not accuracy
    // sample.feedback.state: unknown | tracking | target-met
    // sample.phase: provisional live state; not a final rep diagnosis
    renderLatest(sample);
  },
  onRepComplete(event) {
    // event.key: stable session + start/end key, suitable for deduplication.
    // event.report: rolling AnalysisReport; event.rep is within this report.
    // event.feedback: target-met | attention | unknown for this completed rep.
    // event.evidenceImages: up to 3 exact descent/bottom/ascent JPEGs, or [] without the bottom.
    // event.epoch: the view interval that produced this completed rep.
    // Only send an opted-in small coaching packet matching these image timestamps.
    // Never seek the live stream or substitute its current frame for a past bottom.
    queueCoaching(event);
  },
  onError(error) { showRestartMessage(String(error)); },
});
// On disconnect, new stream, unmount, or user stop:
live.stop(); // also possible: abort.abort(); then stop caller-owned media tracks
```

`getReport()` returns the latest rolling report, `getStats()` returns timing/drop counters, and `getEvidence(timestampMs)` returns a currently retained JPEG or null. Evidence is cleared on stop. `index.d.mts` documents the full public API. Callback functions should not throw.

## Timing, bounded storage, and uncertainty

The engine runs on the received video's `requestVideoFrameCallback`. It accepts at most one bitmap conversion/inference operation at a time, discards callbacks while busy, and never queues frames. `maxHz` defaults to 15 (maximum 60). It records accepted, processed, busy/cadence/nonmonotonic drops, processed Hz, and mean/max bitmap+JPEG+worker latency. This is **local processing latency**, not capture-to-display network latency or model accuracy. A slow machine may miss repetitions; the shared detector rejects large evidence gaps rather than inventing complete motion.

Timestamps are integer milliseconds relative to the first received callback after model startup; `sourceMediaTimeMs` preserves the received video's original media clock. All evidence/rep timestamps use that relative session clock. A backward clock reset stops analysis with a restart error. Source dimension changes invalidate the current view interval and reacquire at the new dimensions; an in-flight result captured at the old dimensions is discarded. The caller must start a new session when replacing a stream. Stop terminates the worker, cancels video callbacks, aborts pending requests, and suppresses late results.

History defaults to 30 seconds and 450 accepted frames, whichever limit is reached first. Configuration limits are 2–60 seconds / 10–900 frames. Reports retain absolute session timestamps within that rolling window. A view-guard epoch change additionally clears that window, JPEG cache, target dwell and unfinished repetitions, so relative baselines never cross the discontinuity. A rep starting before the retained window may no longer be reconstructable. Report rep IDs may change as old reps leave the window; use `event.key` for session events. Completed events wait for two later accepted samples to settle the shared phase smoother, and deduplication storage also expires with the window. They are bounded-window findings, not immutable clinical measurements.

With `captureEvidence:true`, one synchronous canvas draw supplies both the inference bitmap and a <=640px JPEG; the JPEG is never taken after inference from a later frame. JPEG storage shares the frame history bounds and is cleared on stop. This opt-in adds encoding overhead and memory; callers should keep the default window small and retain only the event images needed for approved coaching. No raw video is included. Optional `onPoseFrame` returns normalized/world model output locally; no raw-pose history is retained by this API.

## Overlay and coaching rules

- **Gray / unknown:** unavailable tracking. Hide numerical values and decline assessment.
- **Neutral / tracking:** evidence exists, but no goal is selected or the current movement has not sustained that goal. Valid pose detection alone does not mean good technique.
- **Green / target-met:** the chosen projected knee-flexion target is reached for at least 150 ms. A 5° release margin avoids flicker, and gaps over 250 ms reset the dwell. The label must disclose the chosen target; 110° is an illustrative demo goal, not a universal squat standard.
- **Amber / attention:** only a completed, measurable rep whose bottom is below the selected target. Never label an ordinary descent as bad because it has not reached the bottom yet. This does not diagnose injury risk or unsafe posture.

The pure `completedRepFeedback(report, repId, target)` helper supports recorded-video comparisons too. For live drawing, draw the latest processed pose and make its age visible: if no recent sample arrives, gray/hide it instead of leaving a stale green skeleton over moving video. The browser cannot make delayed inference perfectly aligned with the current live pixels; do not describe it as frame-exact live overlay. AI narration should be asynchronous, rate-limited, evidence-grounded, and attached to completed-rep timestamps. Numeric/phase overlays remain local and should continue even if AI is unavailable.

## Verification

```
node --test harness/live/motion/live.test.mjs
node harness/live/motion/verify-browser.mjs
```

The second command uses installed Chrome, Vite, and the real `clear-squat.mp4` at normal playback speed, routed through `video.captureStream()` into a second received video. It saves observed counters, completed events, image timestamps, and individual updates to `browser-verification.json`. It does not access a real camera or contact an external AI/QA service. A successful desktop smoke test is not proof of iPhone camera quality or real Wi-Fi transport performance; that two-device test must be recorded separately.

Historical pre-guard baseline run (2026-11-07, this Mac, CPU delegate; not a verification of the later guard integration): the real normal-speed stream processed 37 frames, dropped 72 callbacks while busy and 2 for cadence, reconstructed 2 reps, and emitted 1 stabilized completion event. Mean local processing latency was 76.8 ms and max 164.6 ms. The first bottom estimate was 119.3° with a matching 48 KB JPEG. The recording ended before the second rep had two later confirmation samples; its completion event was correctly withheld. In a continuing live feed, keep standing briefly after the rep so confirmation can finish. These measurements vary with machine load and are not angle-accuracy validation.

The synthetic empty-camera run retained exactly the configured maximum of 10 frames, never emitted target-met/tracking for the empty scene, and stopped during an in-flight inference with no late callbacks. Browser and engine errors were empty. See `browser-verification.json` for the complete evidence, including timestamps rather than rounded summary values.

## View continuity and metric validity

The live accumulator now uses the **experimental** `createViewGuard` before admitting frames to the side-view report. It requires a 500 ms geometry-continuity dwell (configurable), followed by three stable capture samples for the existing side-view framing check. Abrupt projected translation, scale, identity/anchor changes, tracking gaps and changed image dimensions start a fresh epoch. Start from standing after reacquisition: partial reps across epochs are deliberately withheld. These image heuristics do not distinguish every camera movement from subject motion, prove a fixed camera, reliably recognize gradual camera orbits, or calibrate 3D angles.

Each `onSample` now includes:

- `viewGuard`: `{state,reason,epoch,declaredView,experimental:true}`. `declaredView` defaults to the existing side-on capture workflow; it is a caller declaration, not a validated camera classifier.
- `analysisEligible`: whether the stable side-view window supports current squat metrics and rep detection.
- `metricValidity`: individual estimated/unavailable status and reason for each projected metric. Relative metrics still require their own valid rep-start evidence.
- `poseDisplayFrame`: confidence-gated image landmarks for drawing independently of side-metric eligibility. A stable front/oblique drawing must not acquire a knee-depth target color or imply that squat metrics are supported.
- `multiView`: the separate experimental adapter's per-metric diagnostics and provenance. Values are withheld while reacquiring. World-coordinate angles remain monocular model estimates, not calibrated accuracy; the app does not promote them into side-view coaching.

`session.setView('side'|'front'|'oblique'|'unknown')` and `session.resetView()` invalidate the current baseline. A new source/session also needs a fresh session. Rendering must inspect `poseDisplayFrame`, `analysisEligible` and `metricValidity` independently. The app hides current numbers/target cues while reacquiring and displays why; historical cards remain.

A completed rep freezes its report and exact source JPEGs. An already-requested AI review remains valid **historical** evidence across a same-session view change and is labeled with the original view and timestamp; it must not become a current measurement or target cue. Stop/new-session cancellation still suppresses late replies. The live app uses `buildLiveCoachBundle` to send at most seven real cached source snapshots across start, descent, exact bottom, ascent and end, plus up to 31 actual knee/hip/chest-angle samples, with explicit warnings that these images do not show the whole movement.

Guard and accumulator regression tests: `node --test harness/live/motion/view-guard.test.mjs harness/live/motion/live-analysis.test.mjs harness/live/motion/phase-evidence.test.mjs`. The app browser test now includes a changing-resolution synthetic camera and delayed prior-view AI response. Use `MOVEIDE_TEST_LOCAL_ONLY=1 node harness/live/app.browser.test.mjs` to avoid binding the dedicated phone service during local QA.


The optional `CoachPacket v1.motionContext` field is an additive extension: older packets remain accepted, and recorded-clip packet construction still defaults to four images. Live review requests allow seven images, each capped at 1 MiB, within the existing HTTP body limit. Context contains one rep's source clip/model IDs, start/bottom/end bounds, and strictly ordered actual sample timestamps with nullable projected angles; no generated frames, 3D claim, interpolation or angle normalization. Snapshots nearest a phase anchor are accepted only inside that phase and within 250 ms; the bottom must match exactly. Sparse/uncached anchors are omitted. Every snapshot still resolves to a real usable measured source frame. The trace is context, not a set of new citation IDs. Accepted frame IDs and measurement IDs remain the response citation authority. The rolling pose/JPEG cache and six-review FIFO remain bounded as before; saved evidence is bounded to 42 images for six seven-image reviews. No full video is sent to the coach.
