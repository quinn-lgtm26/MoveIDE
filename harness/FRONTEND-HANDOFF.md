# Workbench amendments

> **Current priority:** follow [AI-AMENDMENTS.md](../AI-AMENDMENTS.md) and [tracker.md](../tracker.md). One Start now orchestrates analysis and coaching automatically. Earlier manual preview/copy/Generate requirements below are historical developer-tool guidance, not the normal product journey. See [current frontend API amendment](../docs/frontend-harness-amendments.md).

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

- The backend being connected does not mean an interpretation exists. Show an explicit **Generate AI analysis** action next to the player, with idle, generating, ready, failed, and canceled states. It sends only the reviewed packet/JPEGs. Local metrics should be visually distinct from generated coaching.
- Use `getCoachingSegments(response, approvedPacket, report)` and `coachingSegmentAt(segments, mediaTimeMs)` to keep a note readable for its corresponding rep. Label it with the actual evidence timestamps so a bottom-frame observation is not presented as a new frame-by-frame inference. Hide the active cue outside the rep or when local tracking is unavailable. Keep all observations, uncertainty, next focus, and evidence-seek buttons available as readable text beside/below the player.
- The prior `coachingMarkerAt` default is only a 150 ms window either side of a cited timestamp. It is suitable for point markers, but alone makes playback text flash too briefly to read. Segment cues extend display duration without changing evidence scope or making additional model requests. Clear them on clip or pair changes and reject results from older request generations.

- The local trace updates during playback. Request ChatGPT once for the explicit approved selection. The optional provider returns an explanation with approved evidence IDs.
- Call `getCoachingTimeline(response, approvedPacket)` once. Use `coachingMarkerAt(timeline, timestampMs)` to surface matching notes while the video plays. Render values from the report and let the user seek to any cited frame. Scope the response and timeline to the clip, pair, and request generation. Hide stale results when a selection changes.
- Deploy the hosted workbench with manual handoff. The local integration can embed `createProviderMiddleware` from `harness/provider/local-server.mjs` on the same HTTP 127.0.0.1 origin. Keep local credentials on the server.

## Release checks

### Current product acceptance probe

Built and tested `main` at `5225a3d70b29f952fa599e638d4554a0a72de8a4` in Chrome 154. The root application reached `Ready · sample-squat.mp4`, but both reps' knee flexion and duration were unavailable. Its own warning reported 23/53 tracked frames with gaps at both candidate bottoms. The root bundle still loaded Full assets from jsDelivr/Google Storage and the old hard-case sample. Root unit tests (25, including the newly merged server tests) and the production build passed; those checks alone do not prove the product demo journey.

This is the outstanding join between the frontend and the verified harness. Apply the shared analyzer, same-origin Heavy assets, clear fixture, and coaching bundle replacements above. Then require two usable rep comparisons, source-linked angles, both JPEGs, and disconnected preview/copy on the built product before dispatching Seldon. [Recorded browser outcome](../qa/product-readiness.json)

After `npm ci`, `npm --prefix harness ci`, and `npm run build`, run `node harness/verify/product-readiness.mjs --write`. It exits nonzero until the built product uses the expected Heavy model and exact clear-fixture bytes, meets labeled bottom timing, exposes usable comparisons, decodes both JPEGs and copies the preview with the provider disconnected. This readiness probe uses the current workbench's accessible controls; update its selectors if those controls change. It is an early gate, with the broader overlay/replacement and final hosted workflows still required.

- Describe the engine as analyzing at up to 15 Hz. The independent ffprobe audit accounts for all 57 clear-demo and all 90 supported-regression source timestamps. Higher-rate uploads can have unanalysed source frames. Stepping controls should say “analyzed sample” unless exact source-frame coverage has been verified for that file. [Audit and scope](results/source-timeline-verification.json)
- Chrome must show a real knee angle on the selected source frame, a letterbox-correct skeleton, and a playback gap when evidence is missing. Check playback, paused stepping, seek, resize and an invalid upload.
- Compare two reps, preview both timestamped JPEGs and copy the approved handoff with the provider disconnected.
- When the integrated workbench build is ready and reachable, run the two existing product Seldon cases against that exact build. Hold the remaining 14 simulations until that point. [Seldon ledger](../qa/seldon-ledger.md)

## Latest two-recording and setup bundle

The root `Compare examples` action now consumes `motion/compare-recordings.mjs` with two independently analyzed, byte-hashed sources. Reuse its `.d.mts` contract rather than joining reports by `rep-1` or a shared timestamp. Values and evidence refs retain source slot, clip ID, selected rep and phase; unavailable/incompatible differences stay null. See [comparison UX amendment](../docs/two-recording-comparison-amendment.md) and [saved fixture example](results/two-recording-comparison.example.json). Saved imported examples remain unverified source associations.

For a new computer, `npm run demo` (or macOS `Start MoveIDE.command`) installs locked dependencies and prepares pinned Heavy/Full models and runtime assets automatically. Only the analysis computer needs pose assets; the iPhone sender streams video. [Quickstart](../docs/quickstart.md) covers phone HTTPS, one-time account connection and recovery. Keep the same shared live controller and provider boundary.

## Local history and recording handoff

Use `history/index.mjs` and its [typed contract](history/index.d.mts), not ad-hoc localStorage. Original video and nonnull analysis reports become immutable under a session ID; reanalysis/new source gets a new session ID. Atomic patches can add accepted coaching, rename a session and preserve existing media. Reopen verifies source hashes and report/coaching structure; validation failures do not display values on mismatched video. Source images live in dedicated bounded asset fields.

Root History restores recorded overlay/trace/rep navigation without a new model call. Live history keeps video and source analysis clocks distinct and approximate; exact retained JPEG evidence remains separately viewable. New computer setup and AI copy-paste prompts are linked from [README](../README.md). Do not add cloud synchronization to this local-only demo without a new user decision.
