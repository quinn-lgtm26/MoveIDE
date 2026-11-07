# Side-view squat measurements

MoveIDE keeps all 33 MediaPipe landmark slots at every sampled video timestamp in AnalysisReport v1. `getMotionTrace(report)` derives a local timeline from those samples. `getSquatProfile(report)` collects bottom measurements and phase durations for complete reps and identifies their source frames. Both are derived views of the original report. [MediaPipe landmark definitions](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker#pose-landmarker-model)

All measurements use one selected anatomical side and the display-oriented video plane. The calculations multiply normalized horizontal and vertical coordinates by the corresponding frame dimensions before taking distances or angles. Use a stationary camera from the side with the whole lifter and the near foot in frame. Values are screen-plane estimates, with no reference joint angles in the fixture dataset.

- **Knee flexion in degrees** is 180° minus the hip–knee–ankle angle at the knee. An approximately straight knee is near 0°.
- **Torso lean in degrees** is the unsigned angle of the hip-to-shoulder segment from upward video vertical.
- **Projected hip flexion in degrees** is 180° minus the shoulder–hip–knee angle at the hip. It describes how far the visible torso and thigh fold in the image.
- **Shin inclination in degrees** is the unsigned angle of the ankle-to-knee segment from upward video vertical.
- **Projected ankle closure change in degrees** is the rep-start opening angle minus the current opening angle. Opening is the angle between the ankle-to-knee and heel-to-foot-index vectors. A positive change means the shank-to-foot angle narrowed relative to the start. A negative change means it opened. The proxy needs a visible heel and foot index at both timestamps. A foot axis under 10% of the projected shin length or under one pixel is treated as collapsed.
- **Hip descent in start-leg lengths** is the downward change in the hip's video position divided by the same-side projected hip-to-knee plus knee-to-ankle length at rep start. Positive values indicate descent from the starting position.
- **Hip above knee in start-leg lengths** is the vertical distance from the hip down to the knee, divided by the same start leg length. Positive values put the hip above the knee in the image. Zero is level, and negative values place the hip below the knee in the image.

A horizontal mirror preserves these quantities because they use segment angles, lengths and vertical differences. The chosen anatomical side or visibility can change if a mirrored video is analyzed again. The start-relative metrics have a value only inside a complete rep with usable start evidence. Frames or required landmarks that lack usable evidence yield null values. Samples keep their original timestamps, including gaps. Phase labels follow detected start, bottom and end timestamps. At the rep bottom, the measurements use the original landmarks from that frame.

Each rep profile gives descent and ascent durations as the time from start to bottom and bottom to end. Its source references identify the exact sampled frames by clip-relative timestamp and `frame-<timestamp>ms` ID. Ankle closure and normalized positions also depend on the rep start frame. The positions and angles describe the projected motion under this capture protocol. [AnalysisReport and CoachPacket contract](../../_bmad-output/specs/shared/analysis-report-v1.md)

## Model presets

The harness defaults to the pinned Full float16 v1 task. Both Full and Heavy matched the supported fixture's rep count, and Full matched both timing labels exactly in the local CPU benchmark. To try Heavy, serve the pinned task from the app at `/pose/pose_landmarker_heavy.task` or pass a same-origin `assets.modelUrl`. Select it with `analyzeSquat(source, { model: 'heavy' })`. The worker verifies the selected model's SHA-256 before inference. [Versioned Heavy task](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task) · [Local benchmark results](../results/pose-model-benchmark.json)

From the repository root, run `npm --prefix harness run setup:pose` and then `node harness/verify/pose-benchmark.mjs --write` to repeat the comparison. The benchmark downloads and verifies Heavy before starting its browser, then serves the asset through its own loopback route.
