import type { AnalysisReport, Rep } from '../../motion/analyze.mjs';
import type { CoachPacket, CoachingImage } from '../../coaching/index.mjs';
export interface PhaseEvidence {
  phase: 'start' | 'descent' | 'bottom' | 'ascent' | 'end'; timestampMs: number; blob: Blob;
}
export function selectPhaseEvidence(report: AnalysisReport, rep: Rep, images: Map<number, Blob>): PhaseEvidence[];
export function buildLiveCoachBundle(report: AnalysisReport, repId: string, evidenceImages: { timestampMs: number; blob: Blob }[], options?: { targetKneeFlexionDeg?: number | null }): {
  packet: CoachPacket; images: CoachingImage[]; phases: Omit<PhaseEvidence, 'blob'>[]; report: AnalysisReport;
};
