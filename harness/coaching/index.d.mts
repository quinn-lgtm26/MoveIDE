import type { AnalysisReport, ClipSource } from "../motion/analyze.mjs";

export interface EvidenceRef {
  id: string;
  timestampMs: number;
  imageName: string;
}

export interface CoachingMeasurement {
  id: string;
  repId: string | null;
  metric: AnalysisReport["measurements"][number]["metric"];
  value: number;
  unit: "deg" | "ms";
  evidenceTimestampMs: number;
}

export interface ImageSamplingCoverage {
  mode: 'every-other-analyzed' | 'uniform-capped'; analyzedFrameCount: number; eligibleFrameCount: number;
  plannedImageCount: number; availableImageCount: number; selectedImageCount: number; missingCachedImageCount: number;
  omittedByCapCount: number; maxImages: 32; byteCapped: boolean; maxSelectedGapMs: number | null; meanSelectedIntervalMs: number | null;
}
export interface CoachPacket {
  schemaVersion: 1;
  protocolVersion: string;
  charterVersion: string;
  goal?: string;
  summary: string;
  repIds: string[];
  measurements: CoachingMeasurement[];
  evidence: EvidenceRef[];
  motionContext?: { repId: string; clipId: string; modelId: string; coordinateSpace: 'projected-video'; sampling: 'observed-samples-no-interpolation'; startMs: number; bottomMs: number; endMs: number;
    imageSampling?: ImageSamplingCoverage;
    samples: {timestampMs: number; kneeFlexionDeg: number | null; hipFlexionDeg: number | null; torsoLeanDeg: number | null}[] };
}

export interface CoachingImage extends EvidenceRef {
  blob: Blob;
}

export interface UnavailableImage extends EvidenceRef {
  message: string;
}

export interface CoachingBundle {
  packet: CoachPacket;
  images: CoachingImage[];
  unavailableImages: UnavailableImage[];
}

export interface CoachingOptions {
  repIds?: readonly string[];
  userGoal?: string;
  maxImages?: number;
  motionContext?: CoachPacket["motionContext"];
}

export interface CitedText {
  text: string;
  evidenceIds: string[];
}

export interface CoachingResponse {
  observations: CitedText[];
  uncertainty: string;
  nextFocus: CitedText;
}

export class CoachingValidationError extends Error {
  constructor(code: "invalid_packet" | "invalid_images" | "invalid_response", message: string);
  code: "invalid_packet" | "invalid_images" | "invalid_response";
}

export const MAGNA_CARTA_VERSION: "1.0.0";
export const MAGNA_CARTA_PROMPT: string;
export const COACHING_RESPONSE_SCHEMA: Record<string, unknown>;

export function buildCoachPacket(report: AnalysisReport, options?: CoachingOptions): CoachPacket;

/** For an imported report, supply its original clip when the source is known. */
export function prepareCoachingBundle(
  report: AnalysisReport,
  source?: ClipSource | null,
  options?: CoachingOptions & { signal?: AbortSignal },
): Promise<CoachingBundle>;

export function validateCoachPacket(packet: unknown): CoachPacket;

export function validateCoachingImages<T extends readonly EvidenceRef[]>(
  packet: CoachPacket,
  images: T,
  options?: { requireAll?: boolean },
): T;

export function formatManualHandoff(packet: CoachPacket, images?: readonly EvidenceRef[]): string;

export function validateCoachingResponse(response: unknown, packet: CoachPacket): CoachingResponse;

export interface CoachingTimelineMarker {
  timestampMs: number;
  observationIndices: number[];
  hasNextFocus: boolean;
}

export function getCoachingTimeline(response: CoachingResponse, packet: CoachPacket): CoachingTimelineMarker[];
export function coachingMarkerAt(
  timeline: readonly CoachingTimelineMarker[],
  timestampMs: number,
  windowMs?: number,
): CoachingTimelineMarker | null;

export interface CoachingSegment {
  repId: string;
  startMs: number;
  endMs: number;
  evidenceTimestampsMs: number[];
  observationIndices: number[];
  hasNextFocus: boolean;
}
export function getCoachingSegments(response: CoachingResponse, packet: CoachPacket, report: AnalysisReport): CoachingSegment[];
export function coachingSegmentAt(segments: readonly CoachingSegment[], timestampMs: number): CoachingSegment | null;
