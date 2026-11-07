import type { BodySide, PoseFrame } from './analyze.mjs';

export function overlayFrameAt(frames: readonly PoseFrame[], timestampMs: number): PoseFrame | null;

export function drawSquatOverlay(
  context: CanvasRenderingContext2D,
  frame: PoseFrame | null,
  options: {
    side: BodySide | null;
    videoWidth: number;
    videoHeight: number;
    width: number;
    height: number;
  },
): void;
