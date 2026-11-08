export interface RecordingInfo {
  mimeType: string | null; bytes: number; durationMs: number; stopReason: string; error: string | null;
  alignment: 'approximate'; timingNote: string;
  firstSampleMapping: { analysisTimestampMs: number; sourceMediaTimeMs: number; recordingElapsedMs: number } | null;
}
export function createLiveRecorder(stream: MediaStream, options?: {
  Recorder?: typeof MediaRecorder; now?: () => number; maxBytes?: number; maxDurationMs?: number;
  onStatus?: (status: { state: 'recording' | 'finished' | 'unavailable'; reason?: string; error?: string | null }) => void;
}): {
  stop(reason?: string): Promise<{ videoBlob: Blob | null; recording: RecordingInfo }>;
  markSample(sample: import('../live/motion/index.mjs').LiveSample): void;
};
/** Samples retain bounded view-guard reasons and processing/cadence diagnostics; absent values remain null. */
export function createLiveArchive(options: { source: string; startedAt?: string }): {
  live: { source: string; startedAt: string; samples: unknown[]; reps: unknown[]; notes: unknown[]; evidence: { phase: string; timestampMs: number; blob: Blob; repKey: string; viewEpoch: number }[]; samplesTruncated: boolean; repsTruncated: boolean };
  sample(sample: import('../live/motion/index.mjs').LiveSample): void;
  rep(event: import('../live/motion/index.mjs').LiveRep): void;
  note(event: import('../live/motion/index.mjs').LiveRep, result: { nextFocus: { text: string }; [key: string]: unknown }, packet?: unknown): void;
};
