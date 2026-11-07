# Frontend implementation companion

Use one React and TypeScript workbench in Vite. Own the import, report view, and coaching controls. Use the backend's AnalysisReport v1 and start from the shared synthetic example.

- **Open and process.** Use a browser object URL for the selected file. Support the reference H.264 MP4 in Chrome on the demo laptop. Show progress and an actionable error. Switching clips invalidates the old report, cancels or ignores pending results, and releases old video resources.
- **Overlay.** Put Canvas 2D above the video. MediaPipe DrawingUtils can render landmarks and connectors. Draw the knee arc from the same side and data used to compute the visible value. Sync with presented media time via requestVideoFrameCallback and update on seek and resize. Plot only valid points and connectors. Keyboard-accessible controls must support import, scrub, rep selection, and evidence navigation.
- **Review and compare.** Display the selected rep IDs, knee flexion in degrees, rep duration, and quality state. Clicking a value opens the exact referenced timestamp. Use an unavailable state for missing results. Keep report export local.
- **Coach.** Show the selected measurements, short summary, and unannotated source-frame thumbnails before submission. Show what will leave the device. Present Connect, Disconnect, Interpret, Copy packet, and download images only when available. Surface unavailable auth or image capability while preserving measurement and export.
- **Build check.** Show one real clip with a skeleton and one evidence-linked knee angle before expanding the workbench. Preserve the two Wren journeys in the final submission build.

References · [MediaPipe drawing helpers](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.drawingutils) · [Video frame callback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
