import type { LiveRep } from './index.mjs';
import type { Rep } from '../../motion/analyze.mjs';
export interface PhaseAlignedPoint { phasePercent: number; timestampMs: number; kneeFlexionDeg: number | null; segmentId: number | null }
export interface RepReference { key: string; epoch: number; provenance: string; startMs: number; bottomMs: number; endMs: number; points: PhaseAlignedPoint[] }
/** Exactly61 phase points; null gaps stay null. Preserves degree amplitude. */
export function normalizeRepSamples(samples: { timestampMs: number; kneeFlexionDeg: number | null }[], rep: Pick<Rep, 'startMs'|'bottomMs'|'endMs'>): PhaseAlignedPoint[] | null;
export function createRepReference(event: LiveRep): RepReference | null;
