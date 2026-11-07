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

## Coaching while replaying

- The local trace updates during playback. Request ChatGPT once for the explicit approved selection. The optional provider returns an explanation with approved evidence IDs.
- Call `getCoachingTimeline(response, approvedPacket)` once. Use `coachingMarkerAt(timeline, timestampMs)` to surface matching notes while the video plays. Render values from the report and let the user seek to any cited frame. Scope the response and timeline to the clip, pair, and request generation. Hide stale results when a selection changes.
- Deploy the hosted workbench with manual handoff. The local integration can embed `createProviderMiddleware` from `harness/provider/local-server.mjs` on the same HTTP 127.0.0.1 origin. Keep local credentials on the server.

## Release checks

- Describe the engine as analyzing at up to 15 Hz. The independent ffprobe audit accounts for all 57 clear-demo and all 90 supported-regression source timestamps. Higher-rate uploads can have unanalysed source frames. Stepping controls should say “analyzed sample” unless exact source-frame coverage has been verified for that file. [Audit and scope](results/source-timeline-verification.json)
- Chrome must show a real knee angle on the selected source frame, a letterbox-correct skeleton, and a playback gap when evidence is missing. Check playback, paused stepping, seek, resize and an invalid upload.
- Compare two reps, preview both timestamped JPEGs and copy the approved handoff with the provider disconnected.
- When the integrated workbench build is ready and reachable, run the two existing product Seldon cases against that exact build. Hold the remaining 14 simulations until that point. [Seldon ledger](../qa/seldon-ledger.md)
