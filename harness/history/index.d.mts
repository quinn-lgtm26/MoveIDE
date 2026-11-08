import type { AnalysisReport } from '../motion/analyze.mjs';
import type { CoachPacket, CoachingResponse, CoachingSegment } from '../coaching/index.mjs';
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface HistoryCoaching { packet: CoachPacket; response: CoachingResponse; segments: CoachingSegment[] }
export interface HistoryLive {
  samples: JsonValue[]; notes: JsonValue[]; timing: { [key: string]: JsonValue };
  reps?: JsonValue[]; recording?: { [key: string]: JsonValue };
  repReviews?: JsonValue[]; queueHeartbeatAt?: number;
}
export interface HistoryEvidenceImage {
  timestampMs: number; phase: string; repKey: string; viewEpoch: number; blob: Blob;
  imageSha256?: string;
}
export interface SessionSummary {
  id: string; kind: 'recorded' | 'live'; title: string; createdAt: number; updatedAt: number; revision: number;
  /** Changes to any content except queue heartbeat. Legacy rows fall back to revision. */
  contentRevision: number; queueHeartbeatAt: number | null;
  hasVideo: boolean; videoBytes: number; videoSha256: string | null; evidenceImageCount: number;
  repCount: number; hasCoaching: boolean;
  durationMs: number | null; model: string | null;
}
export interface Session extends SessionSummary {
  schemaVersion: 1; video: Blob | null; evidenceImages: HistoryEvidenceImage[];
  report: AnalysisReport | null; coaching: HistoryCoaching | null; live: HistoryLive | null;
  metadata: { [key: string]: JsonValue };
}
export interface SaveSessionInput {
  id: string; kind?: 'recorded' | 'live'; title?: string; createdAt?: number;
  video?: Blob | null; evidenceImages?: HistoryEvidenceImage[];
  report?: AnalysisReport | null; coaching?: HistoryCoaching | null; live?: HistoryLive | null;
  metadata?: { [key: string]: JsonValue };
  /** Optional optimistic lock. Omit for atomic field patches serialized by IndexedDB. */
  expectedRevision?: number;
}
export class HistoryError extends Error { code: string }
export const HISTORY_LIMITS: Readonly<{ videoBytes: number; appBytes: number; metadataBytes: number; evidenceImages: number; evidenceImageBytes: number; liveSamples: number; liveNotes: number; liveReps: number; liveRepReviews: number }>;
export function createSessionId(): string;
/** Omitted fields preserve values. Saved nonnull video and report are immutable; use a new ID for another source or analysis. Null clears coaching/live. No silent eviction. */
export function saveSession(input: SaveSessionInput): Promise<Session>;
/** Update an existing session atomically; never recreates deleted data. Omitted fields preserve video, title and other metadata. */
export function patchSession(input: SaveSessionInput): Promise<Session>;
/** Verifies source-video and evidence-image hashes before returning blobs for replay. */
export function getSession(id: string): Promise<Session | null>;
/** Newest updated first; metadata-only query never reads asset blobs. */
export function listSessions(): Promise<SessionSummary[]>;
export function deleteSession(id: string): Promise<boolean>;
export function storageStatus(): Promise<{ available: boolean; persisted: boolean | null; usageBytes: number | null; quotaBytes: number | null; appBytes: number; maxAppBytes: number; maxVideoBytes: number; localOnly: true; error?: { code: string; message: string } }>;
export function exportSessionData(session: Session): Omit<Session, 'video' | 'evidenceImages'> & {
  video: { bytes: number; mimeType: string; sha256: string | null; storedSeparately: true } | null;
  evidenceImages: (Omit<HistoryEvidenceImage, 'blob'> & { bytes: number; mimeType: string; storedSeparately: true })[];
};
