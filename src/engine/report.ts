// BE-1: assemble AnalysisReport v1 from per-frame pose results. Pure, so node:test can cover it.
import type { AnalysisReport, Frame, Measurement } from '../contract.ts';
import { LM } from '../contract.ts';
import { VISIBILITY_CUTOFF, kneeFlexion } from './angles.ts';

export const POSE_MODEL = { id: 'mediapipe-pose-landmarker-full', version: '1-float16 (tasks-vision 1.2.2)' };
export const PROTOCOL_VERSION = '1.0.0';

type Side = 'left' | 'right';

/** Side whose hip/knee/ankle are most reliably visible: sum of the weakest joint's visibility per usable frame. */
export function pickSide(frames: Frame[]): Side | null {
  const score = (s: Side) =>
    frames.reduce((sum, f) => {
      const v = [LM[s].hip, LM[s].knee, LM[s].ankle].map((i) => f.landmarks[i]?.visibility ?? 0);
      const weakest = Math.min(...v);
      return weakest >= VISIBILITY_CUTOFF ? sum + weakest : sum;
    }, 0);
  const l = score('left'), r = score('right');
  return l === 0 && r === 0 ? null : l > r ? 'left' : 'right';
}

// Median hip-to-hip distance over hip-to-ankle length. Side views measured 0.07–0.22 on the fixtures, the front view 0.39.
const FRONT_VIEW_SPREAD = 0.3;
export function hipSpread(frames: Frame[], { widthPx: w, heightPx: h }: AnalysisReport['clip']): number {
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
  const r = frames.flatMap(({ landmarks: L }) => {
    const [lh, rh, la] = [L[LM.left.hip], L[LM.right.hip], L[LM.left.ankle]];
    return lh && rh && la && d(lh, la) > 0 ? [d(lh, rh) / d(lh, la)] : [];
  }).sort((a, b) => a - b);
  return r.length ? r[r.length >> 1] : 0;
}

export function buildReport(clip: AnalysisReport['clip'], frames: Frame[]): AnalysisReport {
  const warnings: AnalysisReport['warnings'] = [];
  const side = pickSide(frames);

  // ponytail: one clip-level value (deepest frame) until BE-2 segments reps and measures each bottom.
  // ponytail: no outlier rejection, a single-frame spike can win. BE-2 measures per-rep bottoms instead.
  let best: { t: number; deg: number } | null = null;
  let measurable = 0;
  if (side) {
    const { hip, knee, ankle } = LM[side];
    for (const f of frames) {
      const deg = kneeFlexion(f.landmarks[hip], f.landmarks[knee], f.landmarks[ankle], clip.widthPx, clip.heightPx);
      if (deg === null) continue;
      measurable++;
      if (!best || deg > best.deg) best = { t: f.timestampMs, deg };
    }
  }

  const knee: Measurement = best
    ? { id: 'm-knee-1', repId: null, metric: 'knee_flexion', value: Math.round(best.deg * 100) / 100, unit: 'deg', quality: 'usable', evidenceTimestampMs: best.t }
    : { id: 'm-knee-1', repId: null, metric: 'knee_flexion', value: null, unit: 'deg', quality: 'unavailable', evidenceTimestampMs: null };

  if (!frames.some((f) => f.quality === 'usable')) {
    warnings.push({ code: 'no_pose', message: 'No person was detected in this clip.' });
  } else if (!best) {
    warnings.push({ code: 'knee_unavailable', message: 'Hip, knee, and ankle on one side were never clearly visible. Film from the side with the whole body in frame.' });
  }
  if (best && measurable < frames.length / 2) {
    warnings.push({ code: 'low_tracking', message: `The ${side} leg was tracked in ${measurable} of ${frames.length} frames, so this value may miss the true bottom. Use brighter light and keep the whole body in frame.` });
  }
  if (best && hipSpread(frames, clip) > FRONT_VIEW_SPREAD) {
    warnings.push({ code: 'not_side_view', message: 'This looks like a front view. Knee flexion is measured from the side, so film side-on.' });
  }
  warnings.push({ code: 'no_complete_reps', message: 'Rep counting isn’t available yet. Knee flexion is the deepest point in the clip.' });

  return {
    schemaVersion: 1,
    clip,
    protocol: { id: 'squat-side', version: PROTOCOL_VERSION, side },
    poseModel: POSE_MODEL,
    frames,
    reps: [],
    measurements: [knee],
    warnings,
  };
}
