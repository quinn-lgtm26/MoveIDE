import { getMotionTrace } from '../../motion/squat-profile.mjs';
import { buildCoachPacket, validateCoachPacket, validateCoachingImages } from '../../coaching/packet.mjs';

const MAX_REVIEW_IMAGES = 32;
const MAX_REVIEW_IMAGE_BYTES = 8 * 1024 * 1024;

function thinPreservingBounds(images, count, bottomMs) {
  if (images.length <= count) return images;
  const anchors = new Set([0, images.length - 1, images.findIndex(image => image.timestampMs === bottomMs)]);
  const remaining = images.map((_,i)=>i).filter(i=>!anchors.has(i));
  const slots = count - anchors.size;
  for(let i=0;i<slots;i++) anchors.add(remaining[Math.round(i*(remaining.length-1)/Math.max(1,slots-1))]);
  return [...anchors].sort((a,b)=>a-b).map(i=>images[i]);
}

/** Every other eligible analyzed sample, never every other camera frame. No invented pixels. */
export function selectRepEvidence(report, rep, cache) {
  if (!rep) return { images: [], coverage: null };
  const analyzed = report.frames.filter(frame=>frame.timestampMs>=rep.startMs&&frame.timestampMs<=rep.endMs);
  const eligible = analyzed.filter(frame=>frame.quality==='usable');
  const planned = eligible.filter((frame,i)=>i%2===0 || [rep.startMs,rep.bottomMs,rep.endMs].includes(frame.timestampMs));
  const available = planned.filter(frame=>cache.has(frame.timestampMs)).map(frame=>({
    phase: frame.timestampMs===rep.bottomMs?'bottom':frame.timestampMs===rep.startMs?'start':frame.timestampMs===rep.endMs?'end':frame.timestampMs<rep.bottomMs?'descent':'ascent',
    timestampMs:frame.timestampMs,blob:cache.get(frame.timestampMs),
  }));
  if(!available.some(image=>image.timestampMs===rep.bottomMs)) return {images:[],coverage:null};
  let selected=thinPreservingBounds(available,MAX_REVIEW_IMAGES,rep.bottomMs);
  let byteCapped=false;
  while(selected.reduce((sum,image)=>sum+(image.blob?.size??0),0)>MAX_REVIEW_IMAGE_BYTES && selected.length>3) {
    byteCapped=true;selected=thinPreservingBounds(available,selected.length-1,rep.bottomMs);
  }
  const intervals=selected.slice(1).map((image,i)=>image.timestampMs-selected[i].timestampMs);
  return { images:selected,coverage:{ mode:available.length>MAX_REVIEW_IMAGES||byteCapped?'uniform-capped':'every-other-analyzed',
    analyzedFrameCount:analyzed.length,eligibleFrameCount:eligible.length,plannedImageCount:planned.length,
    availableImageCount:available.length,selectedImageCount:selected.length,missingCachedImageCount:planned.length-available.length,
    omittedByCapCount:available.length-selected.length,maxImages:MAX_REVIEW_IMAGES,byteCapped,
    maxSelectedGapMs:intervals.length?Math.max(...intervals):null,
    meanSelectedIntervalMs:intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):null } };
}
export function selectPhaseEvidence(report, rep, images) { return selectRepEvidence(report,rep,images).images; }

/** Add measured phase samples within the existing v1 contract; original report is unchanged. */
export function buildLiveCoachBundle(report, repId, evidenceImages, { targetKneeFlexionDeg = null, imageSampling = null } = {}) {
  if (targetKneeFlexionDeg !== null && (!Number.isFinite(targetKneeFlexionDeg) || targetKneeFlexionDeg < 30 || targetKneeFlexionDeg > 150)) throw new RangeError('Choose a projected knee-flexion target between 30 and 150 degrees, or null.');
  const rep = report.reps.find(item => item.id === repId);
  if (!rep) throw new Error('Choose a completed rep from this live report.');
  const cache = new Map();
  for (const image of evidenceImages) {
    if (cache.has(image.timestampMs)) throw new Error('Duplicate live evidence timestamp.');
    if (image.blob instanceof Blob && image.blob.type === 'image/jpeg' && image.blob.size > 0 && image.blob.size <= 1024 * 1024) cache.set(image.timestampMs, image.blob);
  }
  const selection = selectRepEvidence(report, rep, cache);
  const selected = selection.images;
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
  const repTrace = [...trace.values()].filter(sample => sample.timestampMs >= rep.startMs && sample.timestampMs <= rep.endMs);
  const indices = new Set(Array.from({length: Math.min(31, repTrace.length)}, (_, i) => Math.round(i * (repTrace.length - 1) / Math.max(1, Math.min(31, repTrace.length) - 1))));
  const motionContext = { repId, clipId: report.clip.id, modelId: report.poseModel.id, coordinateSpace: 'projected-video',
    sampling: 'observed-samples-no-interpolation', startMs: rep.startMs, bottomMs: rep.bottomMs, endMs: rep.endMs,
    imageSampling: imageSampling ?? selection.coverage,
    samples: [...indices].map(index => { const sample = repTrace[index]; return { timestampMs: sample.timestampMs,
      ...Object.fromEntries(['kneeFlexionDeg','hipFlexionDeg','torsoLeanDeg'].map(key => [key, Number.isFinite(sample[key]) ? Math.round(sample[key] * 10) / 10 : null])) }; }) };
  const packet = buildCoachPacket(enrichedReport, { repIds: [repId], maxImages: 32, motionContext, ...(targetKneeFlexionDeg === null ? {} : { userGoal: `Illustrative display reference: ${targetKneeFlexionDeg} degrees of projected knee flexion at the rep bottom. This is not a personalized prescription or a universal definition of good form. Do not infer that the user selected it or prescribe a depth change from this reference alone.` }) });
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
  packet.summary = `Estimated video-plane angles. Rep start/bottom/end: ${rep.startMs}/${rep.bottomMs}/${rep.endMs} ms. ${phases.length} real cached images, every other analyzed sample (32-image/8MiB cap); sparse images do not show the entire motion. Trace is sampled, not interpolated. Missing phases are unknown. Do not infer unseen control, pressure, core activation or spinal curvature.${caveats ? ` ${caveats}` : ''}`;

  validateCoachPacket(packet);
  validateCoachingImages(packet, images);
  return { packet, images, phases, report: enrichedReport };
}
