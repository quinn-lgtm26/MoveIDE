import { buildAnalysisReport } from '../../motion/squat.mjs';
import { getMotionTrace } from '../../motion/squat-profile.mjs';
import { rawPoseFrame } from '../../motion/raw-pose.mjs';
import { analyzeMultiViewFrame } from '../../motion/multiview.mjs';
import { createViewGuard } from './view-guard.mjs';
import { completedRepFeedback, createDepthFeedback } from './feedback.mjs';
import { selectRepEvidence } from './phase-evidence.mjs';

const METRICS = ['kneeFlexionDeg', 'torsoLeanDeg', 'hipFlexionDeg', 'shinInclinationDeg', 'ankleClosureChangeDeg', 'hipDescentLegLengths', 'hipAboveKneeLegLengths'];
const VIEWS = ['side', 'front', 'oblique', 'unknown'];
const blankMetrics = timestampMs => ({ timestampMs, repId: null, phase: null, ...Object.fromEntries(METRICS.map(key => [key, null])) });

/** Pure bounded live accumulator. Only one continuous, stable, eligible side-view epoch feeds reps. */
export function createLiveAnalysis({ clipId, poseModel, targetKneeFlexionDeg = null, historyMs = 30_000,
  maxFrames = 450, declaredView = 'side', viewGuardOptions } = {}) {
  if (!VIEWS.includes(declaredView)) throw new RangeError('Declare side, front, oblique or unknown view.');
  const guard = createViewGuard(viewGuardOptions);
  const samples = [], captureWindow = [], images = new Map(), completed = new Map();
  let epoch = 0, previousAngle = null, report = null, selectedSide = null, wasEligible = false;
  let depth = createDepthFeedback({ targetKneeFlexionDeg });
  const clear = () => {
    samples.length = 0; captureWindow.length = 0; images.clear(); completed.clear();
    previousAngle = null; selectedSide = null; wasEligible = false; report = null;
    depth = createDepthFeedback({ targetKneeFlexionDeg });
  };
  const reset = () => { const state = guard.reset(); epoch = state.epoch; clear(); return state; };
  return {
    setView(view) {
      if (!VIEWS.includes(view)) throw new RangeError('Declare side, front, oblique or unknown view.');
      if (view === declaredView) return false;
      declaredView = view; reset(); return true;
    },
    reset,
    clearEvidence() { images.clear(); },
    getReport: () => report,
    getEvidence: time => images.get(time) ?? null,
    getStats: () => ({ retainedFrames: samples.length, retainedEvidenceImages: images.size, analysisEpoch: epoch }),
    process({ timestampMs, result, jpeg = null, widthPx, heightPx }) {
      const clip = { id: clipId, widthPx, heightPx, durationMs: Math.max(1, timestampMs + 1) };
      const raw = rawPoseFrame(timestampMs, result, poseModel);
      let viewGuard = guard.update({ timestampMs, landmarks: result.landmarks, widthPx, heightPx });
      if (viewGuard.epoch !== epoch) { epoch = viewGuard.epoch; clear(); }
      const candidate = { timestampMs, landmarks: result.landmarks };
      let captureReport = null;
      if (viewGuard.state === 'stable') {
        captureWindow.push(candidate);
        while (captureWindow.length > 5) captureWindow.shift();
        captureReport = buildAnalysisReport(clip, captureWindow, poseModel);
      }
      let analysisEligible = viewGuard.state === 'stable' && declaredView === 'side' && captureWindow.length >= 3 &&
        captureReport.protocol.side !== null && captureReport.frames.at(-1)?.quality === 'usable';
      // A newly unsupported framing/analysis-side change must not keep a former rep baseline alive.
      if (wasEligible && (!analysisEligible || selectedSide !== captureReport?.protocol.side)) {
        viewGuard = reset(); analysisEligible = false;
      }
      wasEligible = analysisEligible;
      if (analysisEligible) {
        selectedSide = captureReport.protocol.side;
        samples.push(candidate);
        if (jpeg) images.set(timestampMs, jpeg);
        while (samples.length > maxFrames || (samples.length > 1 && timestampMs - samples[0].timestampMs > historyMs)) images.delete(samples.shift().timestampMs);
      }
      report = buildAnalysisReport(clip, analysisEligible ? samples : [], poseModel);
      const frame = analysisEligible ? report.frames.at(-1) : { timestampMs, landmarks: Array.from({ length: 33 }, () => null), quality: 'unavailable' };
      const poseDisplayFrame = { timestampMs, landmarks: raw.normalizedLandmarks.map(point => point && ({ x: point.x, y: point.y, visibility: point.visibility ?? 0 })), quality: viewGuard.state === 'stable' ? 'usable' : 'unavailable' };
      const metrics = analysisEligible ? getMotionTrace(report).at(-1) : blankMetrics(timestampMs);
      const reason = viewGuard.state === 'unavailable' ? 'tracking_unavailable' : viewGuard.state !== 'stable' ? 'view_reacquiring'
        : declaredView !== 'side' ? 'side_view_required' : captureWindow.length < 3 ? 'framing_unconfirmed' : !analysisEligible ? 'side_view_unavailable' : null;
      const metricValidity = Object.fromEntries(METRICS.map(key => [key, {
        status: Number.isFinite(metrics[key]) ? 'estimated' : 'unavailable',
        reason: Number.isFinite(metrics[key]) ? 'projected_side_estimate' : reason ?? 'metric_evidence_unavailable',
      }]));
      let multiView = analyzeMultiViewFrame(raw, { width: widthPx, height: heightPx, view: declaredView });
      if (viewGuard.state !== 'stable') multiView = { ...multiView, metrics: Object.fromEntries(Object.entries(multiView.metrics).map(([key, metric]) =>
        [key, { ...metric, value: null, status: 'unavailable', reason: viewGuard.state === 'unavailable' ? 'tracking_unavailable' : 'view_reacquiring' }])) };
      const angle = metrics.kneeFlexionDeg;
      const sideIndices = report.protocol.side === 'left' ? [23, 25, 27] : [24, 26, 28];
      const trackingConfidence = frame.quality === 'usable' ? Math.min(...sideIndices.map(index => frame.landmarks[index].visibility)) : null;
      const continuous = previousAngle && timestampMs - previousAngle.timestampMs <= 250;
      const change = continuous && angle !== null ? angle - previousAngle.value : null;
      const phase = angle === null ? 'unknown' : angle <= 30 ? 'standing' : change === null ? 'moving'
        : change > 2 ? 'descent' : change < -2 ? 'ascent' : angle >= 60 ? 'near-bottom' : 'moving';
      previousAngle = angle === null ? null : { timestampMs, value: angle };
      const feedback = depth.update({ timestampMs, kneeFlexionDeg: angle, quality: frame.quality });
      if (!analysisEligible) feedback.label = viewGuard.state !== 'stable'
        ? 'Pause comparisons while the view settles. Hold a clear side view and begin again from standing.'
        : 'Side-view squat measurements are unavailable in this view. Return to a clear side view.';
      const events = [], finalizedUntil = samples.at(-3)?.timestampMs ?? -1;
      if (analysisEligible) for (const rep of report.reps) {
        const key = `${clipId}:${epoch}:${rep.startMs}:${rep.endMs}`;
        if (rep.endMs > finalizedUntil || completed.has(key)) continue;
        completed.set(key, rep.endMs);
        const evidence = selectRepEvidence(report, rep, images);
        events.push({ key, epoch, rep, report, feedback: completedRepFeedback(report, rep.id, targetKneeFlexionDeg),
          evidenceImages: evidence.images, imageSampling: evidence.coverage });
      }
      for (const [key, endMs] of completed) if (endMs < (samples[0]?.timestampMs ?? timestampMs)) completed.delete(key);
      return { timestampMs, report, frame, poseDisplayFrame, metrics, metricValidity, multiView,
        viewGuard: { ...viewGuard, declaredView, experimental: true }, analysisEligible,
        phase, phaseIsProvisional: true, trackingConfidence, feedback,
        windowStartMs: samples[0]?.timestampMs ?? timestampMs, events, raw };
    },
  };
}
