import { MAGNA_CARTA_PROMPT, MAGNA_CARTA_VERSION } from "./magna-carta-v1.mjs";

const MAX_REPS = 2;
const MAX_IMAGES = 4;
const MAX_GOAL_LENGTH = 500;
const METRIC_UNITS = new Map([
  ["knee_flexion", "deg"],
  ["rep_duration", "ms"],
  ["torso_lean", "deg"],
]);

export class CoachingValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CoachingValidationError";
    this.code = code;
  }
}

function failPacket(message) {
  throw new CoachingValidationError("invalid_packet", message);
}

function nonemptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function exactFields(value, required, optional = []) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

function distinctStrings(values, maxLength) {
  if (!Array.isArray(values) || values.length > maxLength) return false;
  const unique = new Set(values);
  return unique.size === values.length && [...unique].every(nonemptyText);
}

function timestamp(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function imageReference(timestampMs, measurementIds) {
  const imageName = `frame-${timestampMs}ms.jpg`;
  let id = `frame-${timestampMs}ms`;
  while (measurementIds.has(id)) id += "-source";
  return { id, timestampMs, imageName };
}

export function buildCoachPacket(report, { repIds, userGoal } = {}) {
  if (report?.schemaVersion !== 1 || !nonemptyText(report.protocol?.version) ||
      !Array.isArray(report.reps) || !Array.isArray(report.measurements) ||
      !Array.isArray(report.frames)) {
    failPacket("A local AnalysisReport v1 is required.");
  }

  const selectedIds = repIds ?? report.reps.slice(0, MAX_REPS).map((rep) => rep.id);
  const repsById = new Map(report.reps.map((rep) => [rep.id, rep]));
  if (!distinctStrings(selectedIds, MAX_REPS) || selectedIds.some((id) => !repsById.has(id))) {
    failPacket("Choose up to two distinct reps from this report.");
  }
  if (userGoal !== undefined && (typeof userGoal !== "string" || userGoal.length > MAX_GOAL_LENGTH)) {
    failPacket(`The optional goal must be text with up to ${MAX_GOAL_LENGTH} characters.`);
  }

  const selectedSet = new Set(selectedIds);
  const framesByTimestamp = new Map(report.frames.map((frame) => [frame.timestampMs, frame]));
  const measurements = report.measurements.filter((measurement) =>
    measurement.quality === "usable" &&
    (selectedSet.size ? selectedSet.has(measurement.repId) : measurement.repId === null),
  ).map(({ id, repId, metric, value, unit, evidenceTimestampMs }) => {
    const rep = repsById.get(repId);
    const frame = framesByTimestamp.get(evidenceTimestampMs);
    if (!frame || (metric !== "rep_duration" && frame.quality !== "usable") ||
        (rep && (evidenceTimestampMs < rep.startMs || evidenceTimestampMs > rep.endMs))) {
      failPacket(`Measurement ${id} does not resolve to a usable source frame.`);
    }
    return { id, repId, metric, value, unit, evidenceTimestampMs };
  });

  const measurementIds = new Set(measurements.map((measurement) => measurement.id));
  const measuredTimes = new Set(measurements.map((measurement) => measurement.evidenceTimestampMs));
  const bottomTimes = selectedIds.map((id) => repsById.get(id).bottomMs);
  const evidence = [...new Set([...bottomTimes, ...measuredTimes])]
    .filter((time) => measuredTimes.has(time))
    .slice(0, MAX_IMAGES)
    .sort((a, b) => a - b)
    .map((time) => imageReference(time, measurementIds));

  const selection = selectedIds.length
    ? `${selectedIds.length} complete squat ${selectedIds.length === 1 ? "rep" : "reps"} selected.`
    : "No complete squat reps selected.";
  const counts = measurements.length === 1 ? "1 usable measurement" : `${measurements.length} usable measurements`;
  const summary = `${selection} ${counts}. Knee and torso angles are estimates in the video plane.`;
  const goal = userGoal?.trim();
  return validateCoachPacket({
    schemaVersion: 1,
    protocolVersion: report.protocol.version,
    charterVersion: MAGNA_CARTA_VERSION,
    ...(goal ? { goal } : {}),
    summary,
    repIds: [...selectedIds],
    measurements,
    evidence,
  });
}

export function validateCoachPacket(packet) {
  if (!exactFields(packet, [
    "schemaVersion", "protocolVersion", "charterVersion", "summary", "repIds", "measurements", "evidence",
  ], ["goal"]) || packet.schemaVersion !== 1 ||
      !nonemptyText(packet.protocolVersion) || packet.charterVersion !== MAGNA_CARTA_VERSION ||
      !nonemptyText(packet.summary) ||
      (Object.hasOwn(packet, "goal") && (!nonemptyText(packet.goal) || packet.goal.length > MAX_GOAL_LENGTH)) ||
      !distinctStrings(packet.repIds, MAX_REPS) || !Array.isArray(packet.measurements) ||
      !Array.isArray(packet.evidence) || packet.evidence.length > MAX_IMAGES) {
    failPacket("The coaching packet does not match CoachPacket v1.");
  }

  const repIds = new Set(packet.repIds);
  const evidenceIds = new Set();
  const measuredTimes = new Set();
  for (const measurement of packet.measurements) {
    if (!exactFields(measurement, ["id", "repId", "metric", "value", "unit", "evidenceTimestampMs"]) ||
        !nonemptyText(measurement.id) || evidenceIds.has(measurement.id) ||
        !(repIds.size ? repIds.has(measurement.repId) : measurement.repId === null) ||
        !METRIC_UNITS.has(measurement.metric) || METRIC_UNITS.get(measurement.metric) !== measurement.unit ||
        !Number.isFinite(measurement.value) || measurement.value < 0 ||
        (measurement.unit === "deg" && measurement.value > 180) ||
        (measurement.metric === "rep_duration" && measurement.repId === null) ||
        !timestamp(measurement.evidenceTimestampMs)) {
      failPacket("A coaching measurement is invalid or outside the selected reps.");
    }
    evidenceIds.add(measurement.id);
    measuredTimes.add(measurement.evidenceTimestampMs);
  }

  let previousTime = -1;
  for (const reference of packet.evidence) {
    if (!exactFields(reference, ["id", "timestampMs", "imageName"]) ||
        !nonemptyText(reference.id) || evidenceIds.has(reference.id) ||
        !measuredTimes.has(reference.timestampMs) || reference.timestampMs <= previousTime ||
        reference.imageName !== `frame-${reference.timestampMs}ms.jpg`) {
      failPacket("A source image reference is invalid or does not resolve to a selected measurement.");
    }
    evidenceIds.add(reference.id);
    previousTime = reference.timestampMs;
  }
  return packet;
}

export function validateCoachingImages(packet, images, { requireAll = true } = {}) {
  validateCoachPacket(packet);
  if (!Array.isArray(images)) {
    throw new CoachingValidationError("invalid_images", "Source images must be supplied as an array.");
  }
  const expected = new Map(packet.evidence.map((reference) => [reference.id, reference]));
  for (const image of images) {
    const reference = expected.get(image?.id);
    if (!reference || reference.timestampMs !== image.timestampMs || reference.imageName !== image.imageName) {
      throw new CoachingValidationError("invalid_images", "A source image is duplicated or outside the approved packet.");
    }
    expected.delete(image.id);
  }
  if (requireAll && expected.size > 0) {
    throw new CoachingValidationError("invalid_images", "One or more approved source images are missing.");
  }
  return images;
}

export function formatManualHandoff(packet, images) {
  validateCoachPacket(packet);
  if (images !== undefined) validateCoachingImages(packet, images, { requireAll: false });
  const imageIds = images && new Set(images.map((image) => image.id));
  const available = imageIds ? packet.evidence.filter((ref) => imageIds.has(ref.id)) : packet.evidence;
  const missing = imageIds ? packet.evidence.filter((ref) => !imageIds.has(ref.id)) : [];
  const imageLines = [
    ...available.map(({ imageName, id, timestampMs }) => `- Attach ${imageName} (${id}, ${timestampMs} ms).`),
    ...missing.map(({ imageName, id, timestampMs }) => `- Unavailable: ${imageName} (${id}, ${timestampMs} ms).`),
  ];

  return [
    MAGNA_CARTA_PROMPT,
    imageLines.length > 0 ? ["Source JPEGs", ...imageLines].join("\n") : "No source JPEGs in this handoff.",
    `CoachPacket v1\n${JSON.stringify({ ...packet, evidence: available }, null, 2)}`,
  ].join("\n\n");
}

export function validateCoachingResponse(response, packet) {
  validateCoachPacket(packet);
  const evidenceIds = new Set([
    ...packet.measurements.map((measurement) => measurement.id),
    ...packet.evidence.map((reference) => reference.id),
  ]);
  const validCitedText = (entry) => exactFields(entry, ["text", "evidenceIds"]) &&
    nonemptyText(entry.text) && distinctStrings(entry.evidenceIds, evidenceIds.size) &&
    (evidenceIds.size === 0 || entry.evidenceIds.length > 0) &&
    entry.evidenceIds.every((id) => evidenceIds.has(id));
  if (!exactFields(response, ["observations", "uncertainty", "nextFocus"]) ||
      !Array.isArray(response.observations) ||
      (evidenceIds.size === 0 && response.observations.length !== 0) ||
      !Array.from(response.observations).every(validCitedText) ||
      !nonemptyText(response.uncertainty) || !validCitedText(response.nextFocus)) {
    throw new CoachingValidationError("invalid_response", "Coaching returned a malformed result or cited unapproved evidence.");
  }
  return response;
}
