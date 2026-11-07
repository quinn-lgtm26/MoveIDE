import { getSquatProfile } from './squat-profile.mjs';
import { SQUAT_PROTOCOL } from './squat.mjs';
import { reportSourceMatches, sourceBindingStatus } from './source-identity.mjs';

const DEFINITIONS = [
  ['kneeFlexionDeg', 'Knee flexion at bottom', 'deg', 'knee_flexion', ['bottom']],
  ['hipFlexionDeg', 'Hip flexion at bottom', 'deg', null, ['bottom']],
  ['torsoLeanDeg', 'Torso lean at bottom', 'deg', 'torso_lean', ['bottom']],
  ['shinInclinationDeg', 'Shin inclination at bottom', 'deg', null, ['bottom']],
  ['ankleClosureChangeDeg', 'Ankle closure change', 'deg', null, ['start', 'bottom']],
  ['hipDescentLegLengths', 'Hip descent from start', 'leg_lengths', null, ['start', 'bottom']],
  ['hipAboveKneeLegLengths', 'Hip above knee at bottom', 'leg_lengths', null, ['start', 'bottom']],
  ['descentMs', 'Descent duration', 'ms', null, ['start', 'bottom']],
  ['ascentMs', 'Ascent duration', 'ms', null, ['bottom', 'end']],
  ['repDurationMs', 'Complete rep duration', 'ms', 'rep_duration', ['start', 'bottom', 'end']],
];
const finite = Number.isFinite;
const text = value => typeof value === 'string' && value.length > 0;
function canonicalSource(source) {
  if (source instanceof Blob) return source;
  if (typeof source !== 'string' && !(source instanceof URL)) return null;
  try { const url = new URL(source, globalThis.location?.href); url.hash = ''; return url.href; }
  catch { return null; }
}
function assertReport(report) {
  if (report?.schemaVersion !== 1 || !text(report.clip?.id) ||
      ![report.clip.widthPx, report.clip.heightPx].every(value => finite(value) && value > 0) ||
      !finite(report.clip.durationMs) || report.clip.durationMs < 0 ||
      !text(report.protocol?.id) || !text(report.protocol?.version) ||
      !['left', 'right', null].includes(report.protocol.side) ||
      !text(report.poseModel?.id) || !text(report.poseModel?.version) ||
      !Array.isArray(report.frames) || !Array.isArray(report.reps) || !Array.isArray(report.measurements)) throw new Error('A valid AnalysisReport v1 is required for each recording.');
  let last = -1;
  for (const frame of report.frames) {
    if (!Number.isSafeInteger(frame.timestampMs) || frame.timestampMs < 0 || frame.timestampMs <= last || frame.timestampMs > report.clip.durationMs || !Array.isArray(frame.landmarks)) throw new Error('Report frames must have distinct ordered source timestamps and landmarks.');
    last = frame.timestampMs;
  }
  const ids = new Set();
  for (const rep of report.reps) {
    if (!text(rep.id) || ids.has(rep.id) || ![rep.startMs, rep.bottomMs, rep.endMs].every(Number.isSafeInteger) ||
        rep.startMs < 0 || rep.startMs >= rep.bottomMs || rep.bottomMs >= rep.endMs || rep.endMs > report.clip.durationMs) throw new Error('Report reps need unique IDs and ordered start/bottom/end timestamps.');
    ids.add(rep.id);
  }
}

function describe(input, slot) {
  const { report, source, repId, sourceSha256 } = input;
  assertReport(report);
  if (sourceSha256 !== undefined && (typeof sourceSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sourceSha256))) throw new Error('sourceSha256 must be a SHA-256 hex digest of the analyzed source bytes.');
  const identity = canonicalSource(source);
  const bound = sourceBindingStatus(report);
  const sourceBinding = identity === null ? 'missing-source' : !reportSourceMatches(report, source) ? 'mismatch' : bound;
  const rep = repId === undefined ? [...report.reps].sort((a, b) => a.startMs - b.startMs)[0] : report.reps.find(rep => rep.id === repId);
  const supported = report.protocol.id === SQUAT_PROTOCOL.id && report.protocol.version === SQUAT_PROTOCOL.version;
  const selectionReason = !rep ? (repId === undefined ? 'no_complete_rep' : 'rep_not_found') : null;
  const sourceReason = ['mismatch', 'invalid-binding'].includes(sourceBinding) ? 'source_mismatch' : sourceBinding === 'missing-source' ? 'source_missing' : null;
  const trackingReason = report.protocol.side === null ? 'tracking_unavailable' : null;
  const profile = supported && rep && !sourceReason ? getSquatProfile(report).reps.find(item => item.repId === rep.id) : null;
  const frames = new Map(report.frames.map(frame => [frame.timestampMs, frame]));
  const anchors = Object.fromEntries(['start', 'bottom', 'end'].map(phase => {
    const timestampMs = rep?.[`${phase}Ms`];
    return [phase, !sourceReason && timestampMs !== undefined && frames.get(timestampMs)?.quality === 'usable'
      ? { sourceSlot: slot, clipId: report.clip.id, repId: rep.id, frameId: `frame-${timestampMs}ms`, timestampMs, phase } : null];
  }));
  const metadata = {
    slot, clipId: report.clip.id, repId: rep?.id ?? null, startMs: rep?.startMs ?? null, bottomMs: rep?.bottomMs ?? null, endMs: rep?.endMs ?? null,
    anchors, protocol: { ...report.protocol }, poseModel: { ...report.poseModel }, sourceBinding,
    sourceSha256: sourceSha256?.toLowerCase() ?? null, selectionReason,
    clip: { ...report.clip }, warnings: (report.warnings ?? []).map(item => ({ ...item })),
  };
  const values = Object.fromEntries(DEFINITIONS.map(([key, , unit, reportMetric, phases]) => {
    let reason = sourceReason ?? (!supported ? 'unsupported_protocol' : selectionReason ?? trackingReason);
    let value = null;
    if (!reason && phases.some(phase => !anchors[phase])) reason = 'tracking_unavailable';
    if (!reason) {
      if (reportMetric) {
        const measurements = report.measurements.filter(item => item.repId === rep.id && item.metric === reportMetric);
        const measure = measurements[0];
        if (!measure) reason = 'measurement_missing';
        else if (measure.quality !== 'usable' || measure.value === null) reason = 'measurement_unavailable';
        else if (measurements.length !== 1 || !finite(measure.value) || measure.unit !== unit || measure.evidenceTimestampMs !== rep.bottomMs ||
          (unit === 'deg' && (measure.value < 0 || measure.value > 180)) ||
          (reportMetric === 'rep_duration' && measure.value !== rep.endMs - rep.startMs)) reason = 'invalid_measurement';
        else if (reportMetric !== 'rep_duration' && !finite(profile?.bottom[key])) reason = 'tracking_unavailable';
        else value = measure.value;
      } else value = key.endsWith('Ms') ? profile?.[key] : profile?.bottom[key];
      if (!reason && !finite(value)) reason = 'tracking_unavailable';
    }
    const refs = reason ? [] : phases.map(phase => anchors[phase]);
    return [key, { value: reason ? null : value, status: reason ? 'unavailable' : 'available', reason,
      evidenceTimestampMs: reason ? null : rep.bottomMs, evidenceRefs: refs }];
  }));
  return { identity, metadata, values, supported, reason: sourceReason ?? selectionReason ?? trackingReason };
}

/** Compare independent recordings, not two rep IDs in one recording. Never runs inference or fetches media. */
export function compareRecordings(a, b) {
  const left = describe(a, 'a'), right = describe(b, 'b');
  const sameProtocol = left.metadata.protocol.id === right.metadata.protocol.id && left.metadata.protocol.version === right.metadata.protocol.version;
  const sameModel = left.metadata.poseModel.id === right.metadata.poseModel.id && left.metadata.poseModel.version === right.metadata.poseModel.version;
  const hashesPresent = left.metadata.sourceSha256 !== null && right.metadata.sourceSha256 !== null;
  const duplicateReference = left.identity !== null && left.identity === right.identity;
  const duplicateHash = hashesPresent && left.metadata.sourceSha256 === right.metadata.sourceSha256;
  const distinctSources = left.identity !== null && right.identity !== null && !duplicateReference && !duplicateHash;
  const identityEvidence = duplicateReference ? 'same_source_reference' : duplicateHash ? 'same_supplied_sha256'
    : hashesPresent ? 'different_supplied_sha256' : 'different_references_bytes_unchecked';
  const reason = left.reason ?? right.reason ?? (a.report === b.report ? 'same_report' : !distinctSources ? 'duplicate_source' : !sameProtocol ? 'protocol_mismatch'
    : !left.supported || !right.supported ? 'unsupported_protocol' : !sameModel ? 'model_mismatch' : null);
  const metrics = DEFINITIONS.map(([key, label, unit]) => {
    const av = left.values[key], bv = right.values[key];
    const rowReason = reason ?? (av.value === null || bv.value === null ? 'measurement_unavailable' : null);
    return { key, label, unit, a: av, b: bv, delta: rowReason ? null : bv.value - av.value, reason: rowReason };
  });
  const comparable = !reason && metrics.some(metric => metric.delta !== null);
  return {
    schemaVersion: 1, metricDefinitionVersion: 'squat-side-profile-1', deltaDirection: 'b_minus_a',
    sources: [left.metadata, right.metadata],
    eligibility: { comparable, reason: reason ?? (comparable ? null : 'no_comparable_metrics'), sameProtocol, sameModel, distinctSources, identityEvidence },
    metrics,
    cautions: [
      'Descriptive differences between recordings, not good/bad form scores or reference-angle accuracy.',
      'Projected angles and normalized distances depend on camera view, anatomy and capture conditions.',
      'Evidence preserves exact report sample timestamps; decoder compatibility fallbacks may approximate the actual source-frame presentation time.',
      ...(left.metadata.sourceBinding === 'unverified-import' || right.metadata.sourceBinding === 'unverified-import' ? ['Imported report/video associations are caller-supplied and unverified; JSON does not retain live source bindings.'] : []),
      ...(!hashesPresent ? ['Distinct source references do not prove distinct video bytes; provide SHA-256 digests computed from each analyzed source for byte-duplicate detection.'] : ['SHA-256 digests are supplied by the caller and must be computed from the corresponding analyzed source bytes.']),
      ...(left.metadata.protocol.side !== right.metadata.protocol.side ? ['The recordings track different anatomical sides.'] : []),
    ],
  };
}
