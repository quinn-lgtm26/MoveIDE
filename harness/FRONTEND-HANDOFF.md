# Workbench amendments

Apply these on top of the merged frontend scaffold and synced overlay. Use the shared harness for pose, segmentation, geometry, coaching and evidence extraction so the product and QA use one implementation.

## Replace the synthetic analysis seam

Keep the workbench's progress and cancellation API. Delegate the body of `src/analyze.ts` to the harness.

```ts
import { analyzeSquat } from '../harness/motion/analyze.mjs';
import type { AnalysisReport } from '../harness/motion/analyze.mjs';

export function analyze(
  source: string,
  { signal, onProgress }: { signal: AbortSignal; onProgress: (value: number) => void },
): Promise<AnalysisReport> {
  return analyzeSquat(source, { signal, onProgress: ({ progress }) => onProgress(progress) });
}
```

Use `fixtures/squat/clear-squat.mp4` for the built-in sample through the same import path. Chrome tracked all 57 frames. Both rep bottoms met the predeclared 150 ms tolerance. Keep the public asset attribution reachable. Stage the pinned runtime with `npm --prefix harness run setup:pose` and serve `harness/public/pose` under the app's Vite base. Use ES-module workers. Run the native smoke separately on HTTP loopback. [Fixtures](../fixtures/squat/README.md)

## Playback and comparison

- Keep one video clock. In `requestVideoFrameCallback`, resolve `metadata.mediaTime` against `overlayFrameAt(report.frames, milliseconds)`. Use the matched sample time for the local metric readout. Repaint on seek and resize. Leave a gap where tracking is unavailable or more than 100 ms away.
- Use `drawSquatOverlay` for a thin letterbox-aware visible-side chain and knee arc, or match its behavior in the workbench canvas. Keep dense values outside the video. Add previous and next controls for analyzed samples, plus a bottom-frame seek per rep. [Reference renderer](motion/overlay.mjs) · [Runnable smoke](smoke/index.html)
- Use `getMotionTrace(report)` for the frame readout and `getSquatProfile(report)` for comparisons. Show knee flexion, hip flexion, torso lean and descent/ascent first. Put shin inclination, ankle closure change and normalized depth proxies in a details panel. Show deltas relative to a selected rep or the lifter's comparable baseline. Use neutral unavailable states and avoid an overall form score. [Definitions](motion/METRICS.md)
- Pass the exact analyzed File or object URL to `prepareCoachingBundle`. Two chosen reps produce the selected metrics, phase timing and source JPEGs. Preview the exact packet and images before offering copy or send. Report export works with coaching disconnected. Abort extraction on clip or pair change. [Coaching API](coaching/index.mjs)

### Pickup notes for the pushed FE-3 branch

Reviewed `claude/fe-3-compare-handoff-797b94` at `2c57d9bf89fe4a53fd849b3dd99d1ec4a27dc449`. Its comparison layout can consume the merged harness. Before integrating that branch:

- Replace `src/analyze.ts` with the shared `analyzeSquat` adapter above. Its current loop writes the requested seek time into the report; the harness records decoded presentation time and handles cancellation and decoder timeouts.
- In `src/Compare.tsx`, replace the private `captureFrames` helper with `prepareCoachingBundle(report, clipSrc, { repIds: pair, userGoal: goal, signal })`. Use its `packet`, `images`, and `unavailableImages` together, scoped to that request generation. Create and revoke UI object URLs for the returned image blobs.
- Replace `src/coach.ts`'s `buildPacket`, inline Charter, and `packetText` with `buildCoachPacket`, `MAGNA_CARTA_PROMPT`, and `formatManualHandoff` as appropriate. Preview and copy the exact bundle packet. The branch currently creates `frame-${t}` evidence IDs and a `magna-carta-1` version; the shared harness owns those values and validates them at the provider boundary.
- Keep the comparison rows driven by the actual report. Include torso lean and the separate phase/profile details. Remove `withSyntheticReps` from the normal demo path. The clear clip's real segmentation already supplies two complete reps.
- Verify replacement while decoding or capturing, a pair change while preview is open, an unavailable image, and two identical rep selections. The existing public harness APIs accept a selected set and validate its measurements; the UI should require two distinct reps for a two-rep comparison.

These are integration amendments for the frontend owner. PR #8 has now merged the inspected comparison layout, and PRs #4/#7 merged its earlier motion path. The shared Heavy harness pickup and final combined browser checks remain required.

## Heavy and OpenCap product amendment

The user has selected **MediaPipe Heavy** as the new default. The harness change passes the seven-fixture and built-browser checks, including both labeled clips within the original 150 ms tolerance. Keep a visible model label and allow an explicit Full preset for faster analysis. Use the report's `poseModel` for the displayed model and provenance. Do not relabel existing Full reports or assume Heavy improves every metric. The earlier Full-versus-Heavy benchmark remains historical evidence.

Design the single-clip review around one source video and one playback clock. The first pane is MediaPipe's projected 2D trace and squat phases. The second, optional pane is OpenCap's imported 3D kinematics, with explicit coordinate names, units, provenance, and runtime status. Display a model's unavailable state without hiding the other result. Do not subtract a MediaPipe projected angle from an OpenSim joint coordinate or call their difference an accuracy score.

OpenCap native inference is not available on the current Darwin arm64 machine. Upstream's tested runtime uses NVIDIA GPU tooling and separately obtained model assets. Until that runtime is available and validated, the frontend offers an **Import OpenCap result** path, with a distinct **Inference unavailable on this device** status. Import must verify the source-video hash and an explicit original-video timestamp per kinematics row. A cropped OpenCap time column alone is insufficient when its tracker filters frames.

The implemented optional API is `importOpenCapResult({ motionText, manifest, source: originalVideoFile, scaledModel: scaledModelFile })` from `harness/opencap/import.mjs`. Its result is `status: 'imported-unverified'`, with coordinate names and `deg`/`m` units, per-row original-video `timestampMs`, source hashes, and explicit limitations. `openCapFrameAt(result, mediaTimeMs)` gives a row or null across gaps. The manifest, TypeScript declarations, producer commands, and verification limits are documented in [OpenCap integration](opencap/README.md). These parser and browser tests use constructed fixtures; no real OpenCap inference has run on the squat sample.

For full MediaPipe output, optionally pass `onPoseFrame(frame)` to `analyzeSquat`. Each callback contains the source `timestampMs`, model provenance, and 33-slot `normalizedLandmarks` and `worldLandmarks` arrays. Points preserve x/y/z plus visibility and optional presence; absent values stay null. Use `RAW_POSE_COORDINATES` for the coordinate descriptions. This output stays local and is separate from AnalysisReport v1 and the bounded coaching packet. The harness review exposes a **Full pose data** download. MediaPipe's hip-centered world coordinates are model estimates, not calibrated OpenSim coordinates.

For coaching, keep the full video and local traces playable while the explicitly approved request runs. After validation, bind the response to the clip, model, selected reps, and request generation. Use the existing evidence timeline to display and seek cues. The current model explanation covers the submitted measurements and JPEGs; it does not claim to have watched unsubmitted frames. The richer local trace remains available throughout playback. A model or clip change clears stale cues and pending requests.

The release view should show actual tracking coverage, rep counts, timing error only where labeled references exist, and angle accuracy as unvalidated until independent reference annotations are available. Further movement protocols remain unsupported until their capture rules, metrics, segmentation, and reference fixtures have been implemented and verified.

## Coaching while replaying

- The local trace updates during playback. Request ChatGPT once for the explicit approved selection. The optional provider returns an explanation with approved evidence IDs.
- Call `getCoachingTimeline(response, approvedPacket)` once. Use `coachingMarkerAt(timeline, timestampMs)` to surface matching notes while the video plays. Render values from the report and let the user seek to any cited frame. Scope the response and timeline to the clip, pair, and request generation. Hide stale results when a selection changes.
- Deploy the hosted workbench with manual handoff. The local integration can embed `createProviderMiddleware` from `harness/provider/local-server.mjs` on the same HTTP 127.0.0.1 origin. Keep local credentials on the server.

## Release checks

- Describe the engine as analyzing at up to 15 Hz. The independent ffprobe audit accounts for all 57 clear-demo and all 90 supported-regression source timestamps. Higher-rate uploads can have unanalysed source frames. Stepping controls should say “analyzed sample” unless exact source-frame coverage has been verified for that file. [Audit and scope](results/source-timeline-verification.json)
- Chrome must show a real knee angle on the selected source frame, a letterbox-correct skeleton, and a playback gap when evidence is missing. Check playback, paused stepping, seek, resize and an invalid upload.
- Compare two reps, preview both timestamped JPEGs and copy the approved handoff with the provider disconnected.
- When the integrated workbench build is ready and reachable, run the two existing product Seldon cases against that exact build. Hold the remaining 14 simulations until that point. [Seldon ledger](../qa/seldon-ledger.md)
