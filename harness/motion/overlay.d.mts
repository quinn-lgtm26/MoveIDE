import type { BodySide, PoseFrame } from './analyze.mjs';

export function overlayFrameAt(frames: readonly PoseFrame[], timestampMs: number): PoseFrame | null;

export function drawSquatOverlay(
  context: CanvasRenderingContext2D,
  frame: PoseFrame | null,
  options: {
    /** Selected analysis side for the optional knee arc; the drawing does not change metric eligibility. */
    side: BodySide | null;
    /** Draw both arms, torso, legs, hands, feet and a nose marker. Default true. */
    fullBody?: boolean;
    /** Draw the selected analysis side's projected knee arc. Default true. */
    showKneeArc?: boolean;
    videoWidth: number;
    videoHeight: number;
    width: number;
    height: number;
  },
): void;
