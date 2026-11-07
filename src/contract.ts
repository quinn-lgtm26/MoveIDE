// AnalysisReport v1 / CoachPacket v1 types.
// Source of truth: _bmad-output/specs/shared/analysis-report-v1.{md,schema.json}
// ponytail: hand-mirrored from the schema; generate from it if the contract starts churning.

export type Quality = 'usable' | 'unavailable';
export type Metric = 'knee_flexion' | 'rep_duration' | 'torso_lean';

export interface Landmark { x: number; y: number; visibility: number }

export interface Frame {
  timestampMs: number;
  landmarks: (Landmark | null)[]; // 33 slots, MediaPipe index order
  quality: Quality;
}

export interface Rep { id: string; startMs: number; bottomMs: number; endMs: number }

export interface Measurement {
  id: string;
  repId: string | null;
  metric: Metric;
  value: number | null;
  unit: 'deg' | 'ms';
  quality: Quality;
  evidenceTimestampMs: number | null;
}

export interface AnalysisReport {
  schemaVersion: 1;
  clip: { id: string; widthPx: number; heightPx: number; durationMs: number };
  protocol: { id: 'squat-side'; version: string; side: 'left' | 'right' | null };
  poseModel: { id: string; version: string };
  frames: Frame[];
  reps: Rep[];
  measurements: Measurement[];
  warnings: { code: string; message: string }[];
}

export interface EvidenceRef { id: string; timestampMs: number; imageName: string }

export interface CoachPacket {
  schemaVersion: 1;
  protocolVersion: string;
  charterVersion: string;
  goal?: string;
  summary: string;
  repIds: string[];
  measurements: Pick<Measurement, 'id' | 'repId' | 'metric' | 'value' | 'unit' | 'evidenceTimestampMs'>[];
  evidence: EvidenceRef[];
}

// MediaPipe Pose landmark indices used by the squat protocol.
export const LM = {
  left: { shoulder: 11, hip: 23, knee: 25, ankle: 27 },
  right: { shoulder: 12, hip: 24, knee: 26, ankle: 28 },
} as const;
