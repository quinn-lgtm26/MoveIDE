import { openVideo, seekVideo } from "../motion/video.mjs";
import { buildCoachPacket } from "./packet.mjs";

const MAX_IMAGE_EDGE = 1600;
const JPEG_TYPE = "image/jpeg";

function encodeJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.type === JPEG_TYPE && blob.size > 0) {
        resolve(blob);
      } else {
        reject(new Error("The browser could not encode this frame as a JPEG."));
      }
    }, JPEG_TYPE, 0.88);
  });
}

export async function prepareCoachingBundle(report, source, { repIds, userGoal, signal } = {}) {
  signal?.throwIfAborted();
  const packet = buildCoachPacket(report, { repIds, userGoal });
  const images = [];
  const unavailableImages = [];
  const bundle = { packet, images, unavailableImages };
  if (packet.evidence.length === 0) return bundle;

  const markAllUnavailable = (message) => {
    unavailableImages.push(...packet.evidence.map((reference) => ({ ...reference, message })));
    return bundle;
  };
  if (source == null) return markAllUnavailable("Open the analyzed clip to attach its source frames.");

  let decoder;
  try {
    decoder = await openVideo(source, { signal });
  } catch {
    signal?.throwIfAborted();
    return markAllUnavailable("Could not open the analyzed clip to extract source frames.");
  }

  try {
    const { video } = decoder;
    const { widthPx, heightPx, durationMs } = report.clip;
    if (video.videoWidth !== widthPx || video.videoHeight !== heightPx ||
        Math.abs(video.duration * 1000 - durationMs) > 1) {
      return markAllUnavailable("This video does not match the analyzed clip dimensions or duration.");
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(widthPx, heightPx));
    canvas.width = Math.max(1, Math.round(widthPx * scale));
    canvas.height = Math.max(1, Math.round(heightPx * scale));
    const context = canvas.getContext("2d");
    if (!context) return markAllUnavailable("Could not create a canvas for source-frame capture.");

    for (const reference of packet.evidence) {
      signal?.throwIfAborted();
      try {
        if (reference.timestampMs > durationMs) throw new RangeError("Source frame is outside the clip.");
        // The report rounds presentation timestamps to milliseconds. Seek just inside the frame.
        const seconds = Math.min((reference.timestampMs + 0.501) / 1000, video.duration - 0.000001);
        await seekVideo(video, seconds, signal);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await encodeJpeg(canvas);
        signal?.throwIfAborted();
        images.push({ ...reference, blob });
      } catch {
        signal?.throwIfAborted();
        unavailableImages.push({ ...reference, message: "Could not decode or encode this source frame." });
      }
    }
    return bundle;
  } finally {
    decoder.close();
  }
}
