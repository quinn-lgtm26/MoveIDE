import type { Landmark } from '../contract.ts';

export const VISIBILITY_CUTOFF = 0.5; // harness.md: initial cutoff, disclose any tuning

type Pt = { x: number; y: number };

/** Normalized landmark → pixel space. Angles must be computed in pixels, not normalized units. */
export const toPx = (l: Landmark, w: number, h: number): Pt => ({ x: l.x * w, y: l.y * h });

/** Interior angle at vertex b (degrees). */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const v1 = Math.atan2(a.y - b.y, a.x - b.x);
  const v2 = Math.atan2(c.y - b.y, c.x - b.x);
  let deg = Math.abs((v1 - v2) * (180 / Math.PI));
  return deg > 180 ? 360 - deg : deg;
}

/** Knee flexion = 180° − hip–knee–ankle angle. null when any joint is missing or low-visibility. */
export function kneeFlexion(
  hip: Landmark | null, knee: Landmark | null, ankle: Landmark | null, w: number, h: number,
): number | null {
  if (![hip, knee, ankle].every((l) => l && l.visibility >= VISIBILITY_CUTOFF)) return null;
  return 180 - angleAt(toPx(hip!, w, h), toPx(knee!, w, h), toPx(ankle!, w, h));
}

/** Torso lean from vertical between hip and shoulder, in pixels. */
export function torsoLean(hip: Landmark, shoulder: Landmark, w: number, h: number): number {
  const a = toPx(hip, w, h), b = toPx(shoulder, w, h);
  return Math.abs(Math.atan2(b.x - a.x, a.y - b.y) * (180 / Math.PI));
}
