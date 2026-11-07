import { getMotionTrace } from '../../motion/squat-profile.mjs';
import { buildCoachPacket, validateCoachPacket, validateCoachingImages } from '../../coaching/packet.mjs';

/** Select real cached samples, never substitute another frame for the measured bottom. */
export function selectPhaseEvidence(report, rep, images) {
  if (!rep || !images.has(rep.bottomMs)) return [];
  const frames = report.frames.filter(frame => frame.quality === 'usable' && images.has(frame.timestampMs));
  if (!frames.some(frame => frame.timestampMs === rep.bottomMs)) return [];
  const pick = (start, end, phase) => {
    const target = (start + end) / 2;
    const frame = frames.filter(frame => frame.timestampMs > start && frame.timestampMs < end)
      .sort((a, b) => Math.abs(a.timestampMs - target) - Math.abs(b.timestampMs - target) || a.timestampMs - b.timestampMs)[0];
    return frame && Math.abs(frame.timestampMs - target) <= 250
      ? { phase, timestampMs: frame.timestampMs, blob: images.get(frame.timestampMs) } : null;
  };
  return [pick(rep.startMs, rep.bottomMs, 'descent'),
    { phase: 'bottom', timestampMs: rep.bottomMs, blob: images.get(rep.bottomMs) },
    pick(rep.bottomMs, rep.endMs, 'ascent')].filter(Boolean);
}

/** Add measured phase samples within the existing v1 contract; original report is unchanged. */
export function buildLiveCoachBundle(report, repId, evidenceImages) {
  const rep = report.reps.find(item => item.id === repId);
  if (!rep) throw new Error('Choose a completed rep from this live report.');
  const cache = new Map();
  for (const image of evidenceImages) {
    if (cache.has(image.timestampMs)) throw new Error('Duplicate live evidence timestamp.');
    if (image.blob instanceof Blob && image.blob.type === 'image/jpeg' && image.blob.size > 0) cache.set(image.timestampMs, image.blob);
  }
  const selected = selectPhaseEvidence(report, rep, cache);
  if (!selected.some(item => item.phase === 'bottom')) throw new Error('The exact bottom image is no longer available.');
  const trace = new Map(getMotionTrace(report).map(sample => [sample.timestampMs, sample]));
  const measurements = report.measurements.filter(item => item.repId === repId);
  const usedIds = new Set(report.measurements.map(item => item.id));
  for (const image of selected.filter(item => item.phase !== 'bottom')) {
    for (const [metric, field] of [['knee_flexion', 'kneeFlexionDeg'], ['torso_lean', 'torsoLeanDeg']]) {
      const value = trace.get(image.timestampMs)?.[field];
      if (!Number.isFinite(value) || value < 0 || value > 180) continue;
      const base = `phase-${image.timestampMs}-${metric}`;
      let id = base, suffix = 0;
      while (usedIds.has(id)) id = `${base}-${++suffix}`;
      usedIds.add(id);
      measurements.push({ id, repId, metric, value, unit: 'deg', quality: 'usable', evidenceTimestampMs: image.timestampMs });
    }
  }
  const enrichedReport = { ...report, measurements };
  const packet = buildCoachPacket(enrichedReport, { repIds: [repId] });
  const byTime = new Map(selected.map(image => [image.timestampMs, image]));
  const images = packet.evidence.map(reference => ({ ...reference, blob: byTime.get(reference.timestampMs)?.blob }));
  if (images.some(image => !image.blob)) throw new Error('A required live source image is unavailable.');
  const phases = selected.filter(image => packet.evidence.some(ref => ref.timestampMs === image.timestampMs))
    .map(({ phase, timestampMs }) => ({ phase, timestampMs }));
  const warnings = new Set(report.warnings?.map(item => item.code));
  const caveats = [
    warnings.has('unsupported_framing') && 'Side framing unconfirmed.',
    warnings.has('pose_unavailable') && 'Pose unavailable.',
    warnings.has('intermittent_pose') && 'Tracking intermittent.',
    measurements.some(item => item.quality !== 'usable') && 'Some measurements unavailable.',
  ].filter(Boolean).join(' ');
  packet.summary = `Estimated video-plane angles. Rep start/bottom/end: ${rep.startMs}/${rep.bottomMs}/${rep.endMs} ms. Sampled phases: ${phases.map(item => `${item.phase} ${item.timestampMs} ms`).join(', ')}. These sparse images do not show the entire motion; do not infer unseen control, foot contact, core activation or spinal curvature.${caveats ? ` ${caveats}` : ''}`;
  validateCoachPacket(packet);
  validateCoachingImages(packet, images);
  return { packet, images, phases, report: enrichedReport };
}
