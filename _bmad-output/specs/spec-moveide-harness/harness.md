# Backend implementation companion

The backend track owns local pose inference, squat analysis, CoachPacket construction, and the optional ChatGPT connector. Browser workers count as backend ownership for the work split. Use the shared report contract as the handoff.

## Motion engine and fixture

Use MediaPipe Pose Landmarker Full v1 first, with a pinned Web SDK and the official worker pattern. Decode and analyze the clip locally using video timestamps. Derive one usable knee value before implementing rep segmentation. Require usable same-side hip, knee, and ankle. Use an initial visibility cutoff of 0.5, verify on both fixtures, and disclose any tuning. Then count complete reps and attach measurements at each bottom. Use a 150 ms provisional bottom tolerance declared before inference and mark unreliable data rather than filling a missing point with a fabricated estimate.

Use the bundled CC BY 4.0 side-view sample for the first real report. Its two reps and bottom frames were visually labeled before running inference. The fixture folder contains three more side views and one front-view challenge. Keep dataset attribution with public QA builds and use the challenge clip to inspect capture guidance and unavailable values. Use the sample in both Seldon cases. [Fixture source and labels](../../../fixtures/squat/README.md)

MediaPipe is the first choice for a local side-view overlay and estimated screen-plane angles. OpenCap Monocular is the stronger reference for research-validated 3D kinematics and dynamics. It has squat validation and a different, approximately 45-degree capture protocol. Benchmark it later if 3D measurements become necessary. Neither source establishes which model is more accurate on our exact clip. MoveNet is the browser fallback to test on identical fixtures if MediaPipe tracking or runtime falls short.

[MediaPipe worker](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/pose-landmarker.worker.ts) · [Full v1 license clarification](https://github.com/google-ai-edge/mediapipe/issues/6306) · [OpenCap Monocular](https://utahmobl.github.io/OpenCap-monocular-project-page/) · [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet)

## ChatGPT and the Magna Carta

Timebox native sign-in to the first hour of implementation. Use a same-origin loopback Node service and the documented local OAuth flow. Verify OAuth state, nonce, PKCE, and granted plan scope. Protect and redact tokens and expose only connection state to the UI. Check the selected model's image capability. Build the connector from the protocol docs for the open-source repo. The OpenAI DevKit has a noncommercial license and can serve as a reference.

Use direct Responses inference. ChatGPT plan usage accepts images with compatible models and has no full-video input. Submit source frames with timestamps, measurements, a text summary, and the user goal. The user sees the exact evidence being shared. A full-video provider is a separate follow-on decision.

Keep the **MoveIDE Magna Carta** as a versioned prompt. Explain evidence, distinguish observations from interpretation, flag uncertainty, and suggest one coaching focus grounded in submitted evidence. Clinical diagnosis, treatment, and autonomous actions are outside this protocol. Validate responses by shape and evidence references.

Use a small provider interface with connection state, capabilities, and interpret(packet, images). The first request can include the complete bounded evidence set. If the demo has time and the provider supports it, add read-only tools scoped to the active request for measurement lookup, rep comparison, or approved frame lookup. A tool may access only already-approved evidence. The provider interface is the initial plugin boundary.

[OpenAI local plan use](https://developers.openai.com/siwc/token-sharing-open-source) · [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations) · [DevKit license](https://github.com/openai/sign-in-with-chatgpt-devkit)
