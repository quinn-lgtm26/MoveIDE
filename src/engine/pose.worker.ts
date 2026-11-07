/// <reference lib="webworker" />
// Pose inference worker (BE-1). Main thread posts decoded frames; nothing leaves the laptop.
// Pattern: https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/pose-landmarker.worker.ts
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const SDK_VERSION = '1.2.2'; // keep in sync with package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${SDK_VERSION}/wasm`;
// Full v1 bundle (Apache-2.0, see mediapipe#6306).
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

export type WorkerIn = { type: 'frame'; bitmap: ImageBitmap; timestampMs: number };
export type WorkerOut =
  | { type: 'ready' }
  | { type: 'pose'; timestampMs: number; landmarks: { x: number; y: number; visibility: number }[] | null }
  | { type: 'error'; message: string };

const post = (m: WorkerOut) => self.postMessage(m);

const landmarker = (async () => {
  // useModule: Vite workers are ES modules, where the classic importScripts loader fails.
  const fileset = await FilesetResolver.forVisionTasks(WASM, true);
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
})();

landmarker.then(() => post({ type: 'ready' }), (e) => post({ type: 'error', message: String(e) }));

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { bitmap, timestampMs } = e.data;
  try {
    const result = (await landmarker).detectForVideo(bitmap, timestampMs);
    const pose = result.landmarks[0];
    post({
      type: 'pose',
      timestampMs,
      landmarks: pose?.map((l) => ({ x: l.x, y: l.y, visibility: l.visibility ?? 0 })) ?? null,
    });
  } catch (err) {
    post({ type: 'error', message: String(err) });
  } finally {
    bitmap.close();
  }
};
