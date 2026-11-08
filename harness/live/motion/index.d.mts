import type { MultiView, MultiViewDiagnostics, MultiViewMetric, MultiViewMetricName, MultiViewReason } from '../../motion/multiview.mjs';
import type { ViewGuardOptions, ViewGuardResult } from './view-guard.mjs';
import type { AnalysisReport, AnalysisOptions, MotionTraceSample, PoseFrame, RawPoseFrame, Rep } from '../../motion/analyze.mjs';
export interface LiveStats {
  discardedDimensionResults: number; analysisEpoch: number;
  presentedFrames: number; acceptedFrames: number; processedFrames: number;
  droppedBusy: number; droppedCadence: number; droppedNonMonotonic: number;
  inFlight: boolean; stopped: boolean; lastAcceptedTimestampMs: number | null;
  elapsedMs: number; analyzedHz: number;
  meanProcessingLatencyMs: number | null; maxProcessingLatencyMs: number | null;
  retainedFrames: number; retainedEvidenceImages: number;
}
export interface DepthFeedback {
  state: 'unknown' | 'tracking' | 'target-met'; label: string; evidenceTimestampMs: number | null;
}
export interface CompletedRepFeedback {
  state: 'unknown' | 'target-met' | 'attention'; label: string;
  targetKneeFlexionDeg: number | null; measuredKneeFlexionDeg: number | null; evidenceTimestampMs: number | null;
}
export interface LiveSample {
  timestampMs: number; sourceMediaTimeMs: number; report: AnalysisReport; frame: PoseFrame;
  /** Drawing remains independent of side-view metric eligibility. */
  poseDisplayFrame: PoseFrame;
  metrics: MotionTraceSample;
  metricValidity: Record<keyof Omit<MotionTraceSample, 'timestampMs' | 'repId' | 'phase'>, { status: 'estimated' | 'unavailable'; reason: string }>;
  /** Experimental diagnostics only; unavailable while the view guard is reacquiring. */
  multiView: Omit<MultiViewDiagnostics, 'metrics'> & { metrics: Record<MultiViewMetricName, Omit<MultiViewMetric, 'reason'> & { reason: MultiViewReason | 'tracking_unavailable' | 'view_reacquiring' }> };
  viewGuard: ViewGuardResult & { declaredView: MultiView; experimental: true };
  analysisEligible: boolean;
  phase: 'unknown' | 'standing' | 'moving' | 'descent' | 'ascent' | 'near-bottom';
  /** Minimum selected hip/knee/ankle visibility, not calibrated accuracy. */
  trackingConfidence: number | null; phaseIsProvisional: true; feedback: DepthFeedback;
  windowStartMs: number; processingLatencyMs: number; stats: LiveStats;
}
export interface LiveRep {
  /** Stable session + start/end key; report rep IDs are local to the rolling window. */
  key: string; epoch: number; rep: Rep; report: AnalysisReport; feedback: CompletedRepFeedback;
  /** Up to 3 exact accepted descent/bottom/ascent frames. Empty if the measured bottom is unavailable. */
  evidenceImages: { phase: 'start' | 'descent' | 'bottom' | 'ascent' | 'end'; timestampMs: number; blob: Blob }[];
}
export interface LiveSquatOptions {
  /** Declared capture workflow, not a validated camera classification. Default side. */
  declaredView?: MultiView; viewGuardOptions?: ViewGuardOptions;
  model?: 'heavy' | 'full'; targetKneeFlexionDeg?: number | null;
  maxHz?: number; historyMs?: number; maxFrames?: number; captureEvidence?: boolean;
  clipId?: string; assets?: AnalysisOptions['assets']; signal?: AbortSignal;
  onSample?: (sample: LiveSample) => void; onRepComplete?: (rep: LiveRep) => void;
  onError?: (error: unknown) => void; onPoseFrame?: (frame: RawPoseFrame) => void;
}
export interface LiveSquatSession {
  /** Changing the declared view invalidates history and relative baselines. */
  setView(view: MultiView): boolean; resetView(): ViewGuardResult;
  stop(): void; getStats(): LiveStats; getReport(): AnalysisReport | null;
  getEvidence(timestampMs: number): Blob | null;
}
export function startLiveSquat(video: HTMLVideoElement, options?: LiveSquatOptions): Promise<LiveSquatSession>;
export function completedRepFeedback(report: AnalysisReport, repId: string, targetKneeFlexionDeg?: number | null): CompletedRepFeedback;
export function createDepthFeedback(options?: { targetKneeFlexionDeg?: number | null; dwellMs?: number; releaseMarginDeg?: number; maxGapMs?: number }): {
  update(sample: { timestampMs: number; kneeFlexionDeg: number | null; quality: string }): DepthFeedback;
};
