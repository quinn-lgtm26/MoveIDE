import type { Frame, Landmark } from './contract.ts';
import { LM } from './contract.ts';
import { VISIBILITY_CUTOFF, kneeFlexion } from './engine/angles.ts';

export const MAX_GAP_MS = 100; // contract: no overlay when the nearest usable sample is further away

export type Rect = { x: number; y: number; w: number; h: number };

/** Displayed video content inside an object-fit: contain box (letterboxing aware). */
export function contentRect(videoW: number, videoH: number, boxW: number, boxH: number): Rect {
  const scale = Math.min(boxW / videoW, boxH / videoH);
  const w = videoW * scale, h = videoH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

/** Nearest usable frame to tMs within MAX_GAP_MS, else null. Frames are sorted by timestamp. */
export function frameAt(frames: Frame[], tMs: number): Frame | null {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timestampMs < tMs) lo = mid + 1; else hi = mid;
  }
  // ponytail: an unusable nearest frame is a gap; we don't fall back to a further usable one.
  const best = [frames[lo - 1], frames[lo]]
    .filter((f): f is Frame => !!f)
    .sort((a, b) => Math.abs(a.timestampMs - tMs) - Math.abs(b.timestampMs - tMs))[0];
  return best && best.quality === 'usable' && Math.abs(best.timestampMs - tMs) <= MAX_GAP_MS ? best : null;
}

// Body-only subset of MediaPipe POSE_CONNECTIONS (face omitted).
const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

const ok = (l: Landmark | null | undefined): l is Landmark => !!l && l.visibility >= VISIBILITY_CUTOFF;

export function drawFrame(
  ctx: CanvasRenderingContext2D, frame: Frame, r: Rect, side: 'left' | 'right' | null, clipW: number, clipH: number,
) {
  const p = (l: Landmark) => [r.x + l.x * r.w, r.y + l.y * r.h] as const;
  const lm = frame.landmarks;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  for (const [a, b] of CONNECTIONS) {
    if (!ok(lm[a]) || !ok(lm[b])) continue;
    ctx.beginPath(); ctx.moveTo(...p(lm[a]!)); ctx.lineTo(...p(lm[b]!)); ctx.stroke();
  }
  ctx.fillStyle = '#4ade80';
  lm.forEach((l) => { if (ok(l)) { ctx.beginPath(); ctx.arc(...p(l), 4, 0, Math.PI * 2); ctx.fill(); } });

  if (!side) return;
  // Knee arc: same side and landmarks the knee flexion value is computed from.
  const { hip, knee, ankle } = LM[side];
  const deg = kneeFlexion(lm[hip], lm[knee], lm[ankle], clipW, clipH);
  if (deg === null) return;
  const [kx, ky] = p(lm[knee]!), [hx, hy] = p(lm[hip]!), [ax, ay] = p(lm[ankle]!);
  const a1 = Math.atan2(hy - ky, hx - kx), a2 = Math.atan2(ay - ky, ax - kx);
  const ccw = ((a2 - a1 + 2 * Math.PI) % (2 * Math.PI)) > Math.PI; // take the interior (<180°) arc
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(kx, ky, 28, a1, a2, ccw); ctx.stroke();
  ctx.font = '600 16px system-ui'; ctx.fillStyle = '#facc15';
  ctx.fillText(`${deg.toFixed(1)}°`, kx + 34, ky + 6);
}
