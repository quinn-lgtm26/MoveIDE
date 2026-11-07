import assert from "node:assert/strict";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MAGNA_CARTA_PROMPT, validateCoachPacket, validateCoachingImages } from "./index.mjs";

export async function verifyCoachingFixture(page, report, resultsDirectory, fixtureName) {
  assert.match(fixtureName, /^[a-z0-9-]+\.mp4$/);
  const fixtureStem = fixtureName.slice(0, -4);
  const repIds = report.reps.map(({ id }) => id);
  assert.equal(repIds.length, 2, "The coaching fixture expects a completed comparison.");
  const { packet, images, unavailableImages, handoff } = await page.evaluate(async ({ report, repIds, fixtureName }) => {
    const { formatManualHandoff, prepareCoachingBundle } = await import("/harness/coaching/index.mjs");
    const { openVideo, seekVideoFrame } = await import("/harness/motion/video.mjs");
    const response = await fetch(`/fixtures/squat/${fixtureName}`);
    if (!response.ok) throw new Error("Could not load the bundled squat clip.");
    const source = new File([await response.blob()], fixtureName, { type: "video/mp4" });
    const bundle = await prepareCoachingBundle(report, source, { repIds });
    const { video, close } = await openVideo(source);
    const images = [];
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const pixels = (image) => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    function rgbError(actual, expected) {
      let difference = 0;
      for (let offset = 0; offset < actual.length; offset += 4) {
        difference += Math.abs(actual[offset] - expected[offset])
          + Math.abs(actual[offset + 1] - expected[offset + 1])
          + Math.abs(actual[offset + 2] - expected[offset + 2]);
      }
      return difference / (actual.length * 0.75);
    }
    async function seekPixels(timestampMs) {
      // Use a separate decoder and confirm the requested source timestamp was actually presented.
      const seconds = Math.min((timestampMs + 0.501) / 1000, video.duration - 0.000001);
      const presented = await seekVideoFrame(video, seconds);
      if (presented !== timestampMs) {
        throw new Error(`Independently decoded ${presented} ms for ${timestampMs} ms evidence.`);
      }
      return pixels(video);
    }
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const firstPixels = pixels(video);
      for (const { blob, ...reference } of bundle.images) {
        const bitmap = await createImageBitmap(blob);
        try {
          const capturedPixels = pixels(bitmap);
          const sourcePixels = await seekPixels(reference.timestampMs);
          const adjacent = report.frames.find(({ timestampMs }) => timestampMs > reference.timestampMs);
          images.push({
            ...reference,
            type: blob.type,
            width: bitmap.width,
            height: bitmap.height,
            bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
            sourceError: rgbError(capturedPixels, sourcePixels),
            firstFrameError: rgbError(capturedPixels, firstPixels),
            adjacentError: adjacent ? rgbError(capturedPixels, await seekPixels(adjacent.timestampMs)) : null,
          });
        } finally {
          bitmap.close();
        }
      }
    } finally {
      close();
    }
    return {
      packet: bundle.packet,
      images,
      unavailableImages: bundle.unavailableImages,
      handoff: formatManualHandoff(bundle.packet, bundle.images),
    };
  }, { report, repIds, fixtureName });

  assert.deepEqual(unavailableImages, []);
  assert.deepEqual(packet.repIds, repIds);
  assert.deepEqual(images.map(({ timestampMs }) => timestampMs), report.reps.map(({ bottomMs }) => bottomMs));
  assert.deepEqual(packet.measurements.map(({ id }) => id), report.measurements
    .filter(({ repId, quality }) => repIds.includes(repId) && quality === "usable")
    .map(({ id }) => id));
  for (const repId of repIds) {
    for (const metric of ["knee_flexion", "rep_duration"]) {
      assert(packet.measurements.some((measurement) => measurement.repId === repId && measurement.metric === metric));
    }
  }
  validateCoachPacket(packet);
  validateCoachingImages(packet, images);
  assert(handoff.startsWith(MAGNA_CARTA_PROMPT));
  assert(handoff.endsWith(JSON.stringify(packet, null, 2)));
  for (const { type, width, height, bytes, imageName, timestampMs, sourceError, firstFrameError, adjacentError } of images) {
    assert.equal(type, "image/jpeg");
    assert.equal(width, report.clip.widthPx);
    assert.equal(height, report.clip.heightPx);
    assert.deepEqual(bytes.slice(0, 2), [0xff, 0xd8]);
    assert.deepEqual(bytes.slice(-2), [0xff, 0xd9]);
    assert(sourceError <= 4, `${imageName}: RGB mean absolute error ${sourceError} exceeds JPEG allowance`);
    if (timestampMs > 0) {
      assert(sourceError < firstFrameError, `${imageName}: captured pixels are closer to the first frame`);
    }
    if (adjacentError !== null) {
      assert(sourceError < adjacentError, `${imageName}: captured pixels are closer to the next frame`);
    }
  }

  const resultsPath = resultsDirectory instanceof URL ? fileURLToPath(resultsDirectory) : resultsDirectory;
  const imageDirectory = join(resultsPath, `${fixtureStem}-evidence`);
  await mkdir(imageDirectory, { recursive: true });
  const currentNames = new Set(images.map(({ imageName }) => imageName));
  for (const { imageName, bytes } of images) {
    await writeFile(join(imageDirectory, imageName), Buffer.from(bytes));
  }
  await writeFile(join(resultsPath, `${fixtureStem}.coach-packet.v1.json`), `${JSON.stringify(packet, null, 2)}\n`);
  for (const name of await readdir(imageDirectory)) {
    if (/^frame-\d+ms\.jpg$/.test(name) && !currentNames.has(name)) {
      await rm(join(imageDirectory, name));
    }
  }
  return packet;
}
