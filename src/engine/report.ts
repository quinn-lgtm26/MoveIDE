// BE-1/BE-2: assemble AnalysisReport v1 from per-frame pose results. Pure, so node:test can cover it.
import type { AnalysisReport, Frame, Measurement, Rep } from '../contract.ts';
import { LM } from '../contract.ts';
import { VISIBILITY_CUTOFF, kneeFlexion } from './angles.ts';

export const POSE_MODEL = { id: 'mediapipe-pose-landmarker-full', version: '1-float16 (tasks-vision 1.2.2)' };
export const PROTOCOL_VERSION = '1.1.0';

type Side = 'left' | 'right';
type Sample = { t: number; deg: number };

// Rep thresholds on knee flexion (deg). Hysteresis: a rep starts at the last frame below UP before the trace
// rises past DOWN, and ends at the first frame back below UP.
// ponytail: absolute thresholds miss very shallow squats (< 60°). Make DOWN relative to the clip's peak if that matters.
const UP_DEG = 30;
const DOWN_DEG = 60;
// A sample that differs from every tracked neighbour frame by more than this is a one-frame spike.
// Fixture side views move ≤ 27° per 15 fps frame. side-mirror spikes 100→16→141→102→155.
const SPIKE_DEG = 30;
// Declared bottom tolerance (fixtures/squat/README.md). A tracking gap longer than this inside a rep means the
// true bottom could sit in the gap, so that rep's values are unavailable instead of guessed.
export const BOTTOM_TOLERANCE_MS = 150;

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

/** Per-frame knee flexion with one-frame spikes dropped. An isolated sample (no tracked neighbour) is kept. */
export function kneeTrace(frames: Frame[], side: Side, w: number, h: number): Sample[] {
  const { hip, knee, ankle } = LM[side];
  const raw = frames.map((f) => kneeFlexion(f.landmarks[hip], f.landmarks[knee], f.landmarks[ankle], w, h));
  return raw.flatMap((deg, i) => {
    if (deg === null) return [];
    const near = [raw[i - 1], raw[i + 1]].filter((n) => n != null) as number[];
    return near.length && near.every((n) => Math.abs(n - deg) > SPIKE_DEG) ? [] : [{ t: frames[i].timestampMs, deg }];
  });
}

/** Complete reps (up → down → up) with the deepest sample as the bottom and the largest tracking gap inside. */
export function segmentReps(trace: Sample[]): { rep: Rep; bottom: Sample; maxGapMs: number }[] {
  const out: { rep: Rep; bottom: Sample; maxGapMs: number }[] = [];
  let start = -1, down = false;
  trace.forEach((s, i) => {
    if (s.deg < UP_DEG) {
      if (down && start >= 0) {
        const span = trace.slice(start, i + 1);
        const bottom = span.reduce((a, b) => (b.deg > a.deg ? b : a));
        const maxGapMs = Math.max(...span.slice(1).map((x, j) => x.t - span[j].t));
        const id = `rep-${out.length + 1}`;
        out.push({ rep: { id, startMs: trace[start].t, bottomMs: bottom.t, endMs: s.t }, bottom, maxGapMs });
      }
      start = i; down = false;
    } else if (s.deg > DOWN_DEG) down = true;
  });
  return out;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const unavailable = (id: string, repId: string | null, metric: Measurement['metric']): Measurement =>
  ({ id, repId, metric, value: null, unit: metric === 'rep_duration' ? 'ms' : 'deg', quality: 'unavailable', evidenceTimestampMs: null });

export function buildReport(clip: AnalysisReport['clip'], frames: Frame[]): AnalysisReport {
  const warnings: AnalysisReport['warnings'] = [];
  const side = pickSide(frames);
  const trace = side ? kneeTrace(frames, side, clip.widthPx, clip.heightPx) : [];
  const frontView = trace.length > 0 && hipSpread(frames, clip) > FRONT_VIEW_SPREAD;
  const segs = segmentReps(trace);

  const measurements: Measurement[] = [];
  const untracked: string[] = [];
  for (const [i, { rep, bottom, maxGapMs }] of segs.entries()) {
    const n = i + 1;
    if (maxGapMs > BOTTOM_TOLERANCE_MS) {
      untracked.push(`${rep.id} (${maxGapMs} ms)`);
      measurements.push(unavailable(`m-knee-${n}`, rep.id, 'knee_flexion'), unavailable(`m-duration-${n}`, rep.id, 'rep_duration'));
      continue;
    }
    measurements.push(
      frontView
        ? unavailable(`m-knee-${n}`, rep.id, 'knee_flexion')
        : { id: `m-knee-${n}`, repId: rep.id, metric: 'knee_flexion', value: round2(bottom.deg), unit: 'deg', quality: 'usable', evidenceTimestampMs: bottom.t },
      { id: `m-duration-${n}`, repId: rep.id, metric: 'rep_duration', value: rep.endMs - rep.startMs, unit: 'ms', quality: 'usable', evidenceTimestampMs: rep.bottomMs },
    );
  }

  // No complete rep: fall back to BE-1's single clip-level value at the deepest (spike-filtered) frame.
  const deepest = trace.length ? trace.reduce((a, b) => (b.deg > a.deg ? b : a)) : null;
  if (!segs.length) {
    measurements.push(
      deepest && !frontView
        ? { id: 'm-knee-1', repId: null, metric: 'knee_flexion', value: round2(deepest.deg), unit: 'deg', quality: 'usable', evidenceTimestampMs: deepest.t }
        : unavailable('m-knee-1', null, 'knee_flexion'),
    );
  }

  if (!frames.some((f) => f.quality === 'usable')) {
    warnings.push({ code: 'no_pose', message: 'No person was detected in this clip.' });
  } else if (!trace.length) {
    warnings.push({ code: 'knee_unavailable', message: 'Hip, knee, and ankle on one side were never clearly visible. Film from the side with the whole body in frame.' });
  }
  if (trace.length && trace.length < frames.length / 2) {
    warnings.push({ code: 'low_tracking', message: `The ${side} leg was tracked in ${trace.length} of ${frames.length} frames, so values may miss the true bottom. Use brighter light and keep the whole body in frame.` });
  }
  if (frontView) {
    warnings.push({ code: 'not_side_view', message: 'This looks like a front view. Knee flexion is measured from the side, so it’s unavailable here. Rep timing still counts. Film side-on.' });
  }
  if (untracked.length) {
    warnings.push({ code: 'rep_untracked', message: `Tracking dropped out for longer than the ${BOTTOM_TOLERANCE_MS} ms bottom tolerance in ${untracked.join(', ')}. The bottom could be in the gap, so knee flexion and duration are unavailable for those reps.` });
  }
  if (trace.length && !segs.length) {
    warnings.push({ code: 'no_complete_reps', message: 'No complete rep (stand → squat → stand) was found. Knee flexion is the deepest tracked point in the clip.' });
  }

  return {
    schemaVersion: 1,
    clip,
    protocol: { id: 'squat-side', version: PROTOCOL_VERSION, side },
    poseModel: POSE_MODEL,
    frames,
    reps: segs.map((s) => s.rep),
    measurements,
    warnings,
  };
}
