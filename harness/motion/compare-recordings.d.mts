import type { AnalysisReport, ClipSource, ClipMetadata } from './analyze.mjs';

export interface RecordingComparisonInput {
  report: AnalysisReport;
  /** The same Blob/URL used to analyze this report; imports require caller association. */
  source: ClipSource;
  /** Defaults to the first complete rep in source-time order. */
  repId?: string;
  /** Caller-computed SHA-256 of the analyzed source bytes, never a filename hash. */
  sourceSha256?: string;
}
export type RecordingMetricKey = 'kneeFlexionDeg' | 'hipFlexionDeg' | 'torsoLeanDeg' | 'shinInclinationDeg'
  | 'ankleClosureChangeDeg' | 'hipDescentLegLengths' | 'hipAboveKneeLegLengths' | 'descentMs' | 'ascentMs' | 'repDurationMs';
export interface RecordingEvidenceRef {
  sourceSlot: 'a' | 'b'; clipId: string; repId: string;
  /** Exact report sample timestamp; decoder fallback may approximate actual frame presentation. */
  frameId: string; timestampMs: number; phase: 'start' | 'bottom' | 'end';
}
export type RecordingComparisonReason = 'no_complete_rep' | 'rep_not_found' | 'source_mismatch' | 'source_missing'
  | 'unsupported_protocol' | 'tracking_unavailable' | 'measurement_missing' | 'measurement_unavailable'
  | 'invalid_measurement' | 'same_report' | 'duplicate_source' | 'protocol_mismatch' | 'model_mismatch' | 'no_comparable_metrics';
export interface RecordingMetricValue {
  value: number | null; status: 'available' | 'unavailable'; reason: RecordingComparisonReason | null;
  evidenceTimestampMs: number | null; evidenceRefs: RecordingEvidenceRef[];
}
export interface RecordingComparisonSource {
  slot: 'a' | 'b'; clipId: string; repId: string | null;
  startMs: number | null; bottomMs: number | null; endMs: number | null;
  anchors: Record<'start' | 'bottom' | 'end', RecordingEvidenceRef | null>;
  protocol: AnalysisReport['protocol']; poseModel: AnalysisReport['poseModel'];
  sourceBinding: 'live-bound' | 'unverified-import' | 'invalid-binding' | 'mismatch' | 'missing-source';
  sourceSha256: string | null; selectionReason: 'no_complete_rep' | 'rep_not_found' | null;
  clip: ClipMetadata; warnings: AnalysisReport['warnings'];
}
export interface RecordingComparison {
  schemaVersion: 1; metricDefinitionVersion: 'squat-side-profile-1'; deltaDirection: 'b_minus_a';
  sources: [RecordingComparisonSource, RecordingComparisonSource];
  eligibility: {
    comparable: boolean; reason: RecordingComparisonReason | null; sameProtocol: boolean; sameModel: boolean; distinctSources: boolean;
    identityEvidence: 'same_source_reference' | 'same_supplied_sha256' | 'different_supplied_sha256' | 'different_references_bytes_unchecked';
  };
  metrics: { key: RecordingMetricKey; label: string; unit: 'deg' | 'ms' | 'leg_lengths'; a: RecordingMetricValue; b: RecordingMetricValue; delta: number | null; reason: RecordingComparisonReason | null }[];
  cautions: string[];
}
/** Synchronous metadata/metric comparison. Does not fetch, decode, infer or alter reports. */
export function compareRecordings(a: RecordingComparisonInput, b: RecordingComparisonInput): RecordingComparison;
