import type { RawPoseFrame } from './analyze.mjs';

export type MultiView = 'side' | 'front' | 'oblique' | 'unknown';
export type MultiViewMetricName =
  | 'leftKneeFlexion3d' | 'rightKneeFlexion3d' | 'leftHipFlexion3d' | 'rightHipFlexion3d'
  | 'leftKneeMedialOffsetLegLengths' | 'rightKneeMedialOffsetLegLengths'
  | 'leftKneeMedialOffsetHipSpans' | 'rightKneeMedialOffsetHipSpans';
export type MultiViewReason =
  | 'monocular_world_estimate' | 'projected_front_proxy' | 'unknown_view'
  | 'missing_image_landmark' | 'landmark_out_of_frame' | 'missing_world_landmark'
  | 'missing_confidence' | 'low_confidence' | 'degenerate_world_segment'
  | 'oblique_uncalibrated' | 'front_view_required' | 'invalid_frame_dimensions'
  | 'degenerate_projected_leg' | 'collapsed_projected_hip_span' | 'ambiguous_medial_direction';
export interface MultiViewProvenance {
  adapterVersion: 'experimental-multiview-1';
  poseModel: { id: string | null; version: string | null };
  worldCoordinates: string;
  confidenceBasis: string;
}
export interface MultiViewMetric {
  value: number | null;
  unit: 'deg' | 'projected_leg_lengths' | 'projected_hip_spans';
  status: 'estimated' | 'unavailable';
  reason: MultiViewReason;
  /** Minimum available visibility/presence; each required landmark needs observed visibility. Not calibrated accuracy. */
  confidence: number | null;
  provenance: MultiViewProvenance;
}
export interface MultiViewDiagnostics {
  schemaVersion: 1;
  experimental: true;
  timestampMs: number | null;
  view: MultiView;
  provenance: MultiViewProvenance;
  metrics: Record<MultiViewMetricName, MultiViewMetric>;
}
/** Independent experimental diagnostics; never modifies AnalysisReport v1. */
export function analyzeMultiViewFrame(raw: RawPoseFrame, options: {
  width: number; height: number; view: MultiView;
}): MultiViewDiagnostics;
