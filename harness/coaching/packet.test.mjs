import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoachPacket,
  formatManualHandoff,
  prepareCoachingBundle,
  validateCoachPacket,
  validateCoachingImages,
  validateCoachingResponse,
} from "./index.mjs";

const reps = [0, 1000, 2000].map((startMs, index) => ({
  id: `rep-${index + 1}`,
  startMs,
  bottomMs: startMs + 500,
  endMs: startMs + 900,
}));

const report = {
  schemaVersion: 1,
  protocol: { id: "squat-side", version: "1.0.0" },
  reps,
  frames: reps.map(({ bottomMs }) => ({ timestampMs: bottomMs, quality: "usable" })),
  measurements: reps.flatMap(({ id, bottomMs }) => [
    { id: `${id}-knee`, repId: id, metric: "knee_flexion", value: 100, unit: "deg", quality: "usable", evidenceTimestampMs: bottomMs },
    { id: `${id}-duration`, repId: id, metric: "rep_duration", value: 900, unit: "ms", quality: "usable", evidenceTimestampMs: bottomMs },
    { id: `${id}-torso`, repId: id, metric: "torso_lean", value: null, unit: "deg", quality: "unavailable", evidenceTimestampMs: null },
  ]),
};

test("CoachPacket contains only usable measures for the selected reps and one ref per frame", () => {
  const packet = buildCoachPacket(report, { repIds: ["rep-2", "rep-3"], userGoal: "  Compare depth  " });
  assert.deepEqual(packet.repIds, ["rep-2", "rep-3"]);
  assert.deepEqual(packet.measurements.map(({ id }) => id), [
    "rep-2-knee", "rep-2-duration", "rep-3-knee", "rep-3-duration",
  ]);
  assert.deepEqual(packet.evidence.map(({ timestampMs }) => timestampMs), [1500, 2500]);
  assert.equal(packet.goal, "Compare depth");
  assert.deepEqual(buildCoachPacket(report).repIds, ["rep-1", "rep-2"]);
  assert.throws(() => buildCoachPacket(report, { repIds: ["unknown-rep"] }), { code: "invalid_packet" });
  assert.throws(() => validateCoachPacket({ ...packet, frames: [] }), { code: "invalid_packet" });
  const badImage = { ...packet.evidence[0], timestampMs: 0, imageName: "frame-0ms.jpg" };
  assert.throws(() => validateCoachPacket({ ...packet, evidence: [badImage] }), { code: "invalid_packet" });
});

test("the four-image budget preserves both rep bottoms and includes only measured timestamps", () => {
  const extraTimes = [0, 100, 200, 300];
  const expanded = {
    ...report,
    frames: [...extraTimes.map((timestampMs) => ({ timestampMs, quality: "usable" })), ...report.frames],
    measurements: [...extraTimes.map((evidenceTimestampMs) => ({
      ...report.measurements[0],
      id: `early-${evidenceTimestampMs}`,
      evidenceTimestampMs,
    })), ...report.measurements],
  };
  const packet = buildCoachPacket(expanded);
  assert.deepEqual(packet.evidence.map(({ timestampMs }) => timestampMs), [0, 100, 500, 1500]);
});

test("single-frame reports can prepare a packet before rep segmentation", () => {
  const standalone = {
    ...report,
    reps: [],
    measurements: [{ ...report.measurements[0], repId: null }],
  };
  const packet = buildCoachPacket(standalone);
  assert.deepEqual(packet.repIds, []);
  assert.equal(packet.measurements[0].repId, null);
  assert.equal(packet.evidence[0].timestampMs, 500);
});

test("missing JPEGs preserve the local packet, and the manual prompt identifies missing refs", async () => {
  const { packet, images, unavailableImages } = await prepareCoachingBundle(report);
  assert.equal(packet.measurements.length, 4);
  assert.deepEqual(images, []);
  assert.deepEqual(unavailableImages.map(({ id }) => id), ["frame-500ms", "frame-1500ms"]);
  const oneImage = [packet.evidence[0]];
  const text = formatManualHandoff(packet, oneImage);
  assert.match(text, /MoveIDE Magna Carta v1\.0\.0/);
  assert.match(text, /Attach frame-500ms\.jpg/);
  assert.match(text, /Unavailable: frame-1500ms\.jpg/);
  assert.deepEqual(JSON.parse(text.split("CoachPacket v1\n").at(-1)).evidence, oneImage);
  assert.throws(() => validateCoachingImages(packet, oneImage), { code: "invalid_images" });
  assert.throws(() => validateCoachingImages(packet, [oneImage[0], oneImage[0]]), { code: "invalid_images" });
  assert.equal(validateCoachingImages(packet, packet.evidence), packet.evidence);
});

test("observations and the coaching focus must cite approved IDs", () => {
  const packet = buildCoachPacket(report);
  const observation = { text: "Rep one reached an estimated 100 degrees.", evidenceIds: ["rep-1-knee"] };
  const response = {
    observations: [observation],
    uncertainty: "These are side-view estimates.",
    nextFocus: { text: "Check consistency at the bottom.", evidenceIds: ["frame-500ms"] },
  };
  assert.equal(validateCoachingResponse(response, packet), response);
  assert.throws(() => validateCoachingResponse({
    ...response, observations: [{ ...observation, evidenceIds: ["rep-3-knee"] }],
  }, packet), { code: "invalid_response" });
  assert.throws(() => validateCoachingResponse({
    ...response, nextFocus: { ...response.nextFocus, evidenceIds: [] },
  }, packet), { code: "invalid_response" });
});

test("aborting a stale request prevents an image-free result from replacing it", async () => {
  await assert.rejects(prepareCoachingBundle(report, undefined, { signal: AbortSignal.abort() }), {
    name: "AbortError",
  });
});
