import { getMotionTrace } from '../../motion/squat-profile.mjs';
import { buildCoachPacket, validateCoachPacket, validateCoachingImages } from '../../coaching/packet.mjs';

/** Select real cached samples, never substitute another frame for the measured bottom. */
export function selectPhaseEvidence(report, rep, images) {
  if (!rep || !images.has(rep.bottomMs)) return [];
  const frames = report.frames.filter(frame => frame.quality === 'usable' && images.has(frame.timestampMs));
  if (!frames.some(frame => frame.timestampMs === rep.bottomMs)) return [];
  const used = new Set([rep.bottomMs]);
  const pick = (target, start, end, phase) => {
    const frame = frames.filter(frame => frame.timestampMs >= start && frame.timestampMs <= end && !used.has(frame.timestampMs))
      .sort((a, b) => Math.abs(a.timestampMs - target) - Math.abs(b.timestampMs - target) || a.timestampMs - b.timestampMs)[0];
    if (!frame || Math.abs(frame.timestampMs - target) > 250) return null;
    used.add(frame.timestampMs);
    return { phase, timestampMs: frame.timestampMs, blob: images.get(frame.timestampMs) };
  };
  const down = rep.bottomMs - rep.startMs, up = rep.endMs - rep.bottomMs;
  return [pick(rep.startMs, rep.startMs, rep.bottomMs, 'start'),
    pick(rep.startMs + down / 3, rep.startMs, rep.bottomMs, 'descent'),
    pick(rep.startMs + 2 * down / 3, rep.startMs, rep.bottomMs, 'descent'),
    { phase: 'bottom', timestampMs: rep.bottomMs, blob: images.get(rep.bottomMs) },
    pick(rep.bottomMs + up / 3, rep.bottomMs, rep.endMs, 'ascent'),
    pick(rep.bottomMs + 2 * up / 3, rep.bottomMs, rep.endMs, 'ascent'),
    pick(rep.endMs, rep.bottomMs, rep.endMs, 'end')].filter(Boolean).sort((a,b) => a.timestampMs-b.timestampMs);
}

/** Add measured phase samples within the existing v1 contract; original report is unchanged. */
export function buildLiveCoachBundle(report, repId, evidenceImages, { targetKneeFlexionDeg = null } = {}) {
  if (targetKneeFlexionDeg !== null && (!Number.isFinite(targetKneeFlexionDeg) || targetKneeFlexionDeg < 30 || targetKneeFlexionDeg > 150)) throw new RangeError('Choose a projected knee-flexion target between 30 and 150 degrees, or null.');
  const rep = report.reps.find(item => item.id === repId);
  if (!rep) throw new Error('Choose a completed rep from this live report.');
  const cache = new Map();
  for (const image of evidenceImages) {
    if (cache.has(image.timestampMs)) throw new Error('Duplicate live evidence timestamp.');
    if (image.blob instanceof Blob && image.blob.type === 'image/jpeg' && image.blob.size > 0 && image.blob.size <= 1024 * 1024) cache.set(image.timestampMs, image.blob);
  }
  const selected = selectPhaseEvidence(report, rep, cache);
  if (!selected.some(item => item.phase === 'bottom')) throw new Error('The exact bottom image is no longer available.');
  const trace = new Map(getMotionTrace(report).map(sample => [sample.timestampMs, sample]));
  const measurements = report.measurements.filter(item => item.repId === repId);
  const usedIds = new Set(report.measurements.map(item => item.id));
  for (const image of selected.filter(item => item.phase !== 'bottom')) {
    for (const [metric, field] of [['knee_flexion', 'kneeFlexionDeg']]) {
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
  const packet = buildCoachPacket(enrichedReport, { repIds: [repId], maxImages: 7, ...(targetKneeFlexionDeg === null ? {} : { userGoal: `Illustrative display reference: ${targetKneeFlexionDeg} degrees of projected knee flexion at the rep bottom. This is not a personalized prescription or a universal definition of good form. Do not infer that the user selected it or prescribe a depth change from this reference alone.` }) });
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
  packet.summary = `Estimated video-plane angles. Rep start/bottom/end: ${rep.startMs}/${rep.bottomMs}/${rep.endMs} ms. ${phases.length}/7 real cached images; sparse images do not show the entire motion. Trace contains actual sampled timestamps, no interpolation. Missing phases are not evidence of good or bad form. Do not infer unseen control, foot pressure, core activation or spinal curvature.${caveats ? ` ${caveats}` : ''}`;
  const repTrace = [...trace.values()].filter(sample => sample.timestampMs >= rep.startMs && sample.timestampMs <= rep.endMs);
  const indices = new Set(Array.from({length: Math.min(31, repTrace.length)}, (_, i) => Math.round(i * (repTrace.length - 1) / Math.max(1, Math.min(31, repTrace.length) - 1))));
  packet.motionContext = { repId, clipId: report.clip.id, modelId: report.poseModel.id, coordinateSpace: 'projected-video',
    sampling: 'observed-samples-no-interpolation', startMs: rep.startMs, bottomMs: rep.bottomMs, endMs: rep.endMs,
    samples: [...indices].map(index => { const sample = repTrace[index]; return { timestampMs: sample.timestampMs,
      ...Object.fromEntries(['kneeFlexionDeg','hipFlexionDeg','torsoLeanDeg'].map(key => [key, Number.isFinite(sample[key]) ? Math.round(sample[key] * 10) / 10 : null])) }; }) };
  validateCoachPacket(packet);
  validateCoachingImages(packet, images);
  return { packet, images, phases, report: enrichedReport };
}
