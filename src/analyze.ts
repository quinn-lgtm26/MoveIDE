// Frontend ↔ BE-1 seam. Decodes the clip locally, runs each frame through pose.worker.ts,
// and assembles an AnalysisReport v1. Nothing leaves the browser.
import type { AnalysisReport, EvidenceRef, Frame } from './contract.ts';
import type { WorkerOut } from './engine/pose.worker.ts';
import { buildReport } from './engine/report.ts';

export type AnalyzeOptions = { signal: AbortSignal; onProgress: (fraction: number) => void };

// ponytail: fixed 15 fps sampling (the fixtures' native rate). Faster clips are subsampled;
// read the real frame rate via requestVideoFrameCallback if 30/60 fps detail matters.
const STEP_MS = 1000 / 15;

/** Resolve on the target's next `event`; reject on `errorEvent` or abort. */
function once<T = Event>(target: EventTarget, event: string, signal: AbortSignal, errorEvent?: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const done = () => { target.removeEventListener(event, ok); if (errorEvent) target.removeEventListener(errorEvent, fail); signal.removeEventListener('abort', abort); };
    const ok = (e: Event) => { done(); resolve(e as T); };
    const fail = (e: Event) => { done(); reject(new Error((e as ErrorEvent).message || `${errorEvent} while waiting for ${event}`)); };
    const abort = () => { done(); reject(signal.reason); };
    target.addEventListener(event, ok);
    if (errorEvent) target.addEventListener(errorEvent, fail);
    signal.addEventListener('abort', abort);
  });
}

export async function analyze(src: string, { signal, onProgress }: AnalyzeOptions): Promise<AnalysisReport> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const meta = once(video, 'loadedmetadata', signal, 'error');
  video.src = src;
  await meta;

  const durationMs = Math.round(video.duration * 1000);
  const worker = new Worker(new URL('./engine/pose.worker.ts', import.meta.url), { type: 'module' });
  const next = async () => {
    const msg = (await once<MessageEvent<WorkerOut>>(worker, 'message', signal, 'error')).data;
    if (msg.type === 'error') throw new Error(msg.message);
    return msg;
  };

  try {
    await next(); // 'ready': wasm + model loaded
    const frames: Frame[] = [];
    for (let i = 0, t = 0; t < durationMs; t = Math.round(++i * STEP_MS)) {
      signal.throwIfAborted();
      const seeked = once(video, 'seeked', signal, 'error');
      video.currentTime = t / 1000; // same seek the workbench uses to open evidence, so the frames match
      await seeked;
      const bitmap = await createImageBitmap(video);
      worker.postMessage({ type: 'frame', bitmap, timestampMs: t }, [bitmap]);
      const msg = await next();
      const lms = msg.type === 'pose' ? msg.landmarks : null;
      frames.push({
        timestampMs: t,
        landmarks: lms ? lms.map((l) => ({ ...l, visibility: Math.min(1, Math.max(0, l.visibility)) })) : Array(33).fill(null),
        quality: lms ? 'usable' : 'unavailable',
      });
      onProgress(t / durationMs);
    }
    onProgress(1);
    return buildReport(
      { id: src.split('/').pop() || 'clip', widthPx: video.videoWidth, heightPx: video.videoHeight, durationMs },
      frames,
    );
  } finally {
    worker.terminate();
    video.removeAttribute('src');
    video.load();
  }
}

/** Unannotated JPEGs of the packet's evidence frames, seeked the same way analyze() sampled them. */
export async function captureFrames(src: string, evidence: EvidenceRef[], signal: AbortSignal): Promise<{ ref: EvidenceRef; blob: Blob }[]> {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  const meta = once(video, 'loadeddata', signal, 'error');
  video.src = src;
  try {
    await meta;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    const out: { ref: EvidenceRef; blob: Blob }[] = [];
    for (const ref of evidence) {
      const seeked = once(video, 'seeked', signal, 'error');
      video.currentTime = ref.timestampMs / 1000;
      await seeked;
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error(`Could not encode ${ref.imageName}`);
      out.push({ ref, blob });
    }
    return out;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
