import { KNEE_INDICES, kneeFlexion, visible } from './geometry.mjs';

// Projected image-space links; these are a pose drawing, not a 3D reconstruction.
const fullBodyLinks = [
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];
const fullBodyJoints = [0, ...Array.from({ length: 22 }, (_, index) => index + 11)];
const visibilityAlpha = (...points) => .3 + .7 * Math.min(1, Math.max(0, (Math.min(...points.map(point => point.visibility)) - .5) / .5));
const skeleton = {
  left: [11, 23, 25, 27, 29, 31],
  right: [12, 24, 26, 28, 30, 32],
};

export function overlayFrameAt(frames, timestampMs) {
  if (!Number.isFinite(timestampMs)) return null;
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (frames[middle].timestampMs < timestampMs) low = middle + 1;
    else high = middle;
  }
  const before = frames[low - 1];
  const after = frames[low];
  const nearest = before && (!after || timestampMs - before.timestampMs <= after.timestampMs - timestampMs)
    ? before
    : after;
  return nearest?.quality === 'usable' && Math.abs(nearest.timestampMs - timestampMs) <= 100 ? nearest : null;
}

export function drawSquatOverlay(context, frame, { side, videoWidth, videoHeight, width, height, fullBody = true, showKneeArc = true }) {
  context.clearRect(0, 0, width, height);
  if (!frame || frame.quality !== 'usable' || !videoWidth || !videoHeight || !width || !height || (!fullBody && !skeleton[side])) return;

  const scale = Math.min(width / videoWidth, height / videoHeight);
  const contentWidth = videoWidth * scale;
  const contentHeight = videoHeight * scale;
  const x = (width - contentWidth) / 2;
  const y = (height - contentHeight) / 2;
  const point = ({ x: u, y: v }) => [x + u * contentWidth, y + v * contentHeight];
  const { landmarks } = frame;
  const chain = skeleton[side] ?? [];
  const links = fullBody ? fullBodyLinks : chain.slice(1).map((index, position) => [chain[position], index]);
  const joints = fullBody ? fullBodyJoints : chain;
  context.save();
  context.beginPath();
  context.rect(x, y, contentWidth, contentHeight);
  context.clip();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const [stroke, lineWidth] of [['rgba(12, 23, 29, .72)', 4], ['#d9fffa', 1.6]]) {
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    for (const [from, to] of links) {
      const before = landmarks[from];
      const current = landmarks[to];
      if (!visible(before) || !visible(current)) continue;
      context.globalAlpha = visibilityAlpha(before, current);
      context.beginPath();
      context.moveTo(...point(before));
      context.lineTo(...point(current));
      context.stroke();
    }
  }

  context.fillStyle = '#d9fffa';
  for (const index of joints) {
    const landmark = landmarks[index];
    if (!visible(landmark)) continue;
    context.globalAlpha = visibilityAlpha(landmark);
    context.beginPath();
    context.arc(...point(landmark), 2.6, 0, 2 * Math.PI);
    context.fill();
  }

  const angle = showKneeArc && KNEE_INDICES[side] ? kneeFlexion(landmarks, side, videoWidth, videoHeight) : null;
  if (angle !== null) {
    const [hip, knee, ankle] = KNEE_INDICES[side].map((index) => point(landmarks[index]));
    const start = Math.atan2(hip[1] - knee[1], hip[0] - knee[0]);
    const end = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]);
    const counterclockwise = (end - start + 2 * Math.PI) % (2 * Math.PI) > Math.PI;
    const radius = Math.min(24, Math.max(10, contentHeight * 0.045));
    context.globalAlpha = visibilityAlpha(...KNEE_INDICES[side].map(index => landmarks[index]));
    context.strokeStyle = '#56edc8';
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(...knee, radius, start, end, counterclockwise);
    context.stroke();
  }
  context.restore();
}
