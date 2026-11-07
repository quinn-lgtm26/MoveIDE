export const OPENCAP_REVISION: '7c5c1dd459835e2482127e55dc45e98d68a1a9f2';
export interface OpenCapManifest {
  schemaVersion: 1;
  engine: 'opencap-monocular';
  upstreamRevision: typeof OPENCAP_REVISION;
  source: { clipId: string; durationMs: number; sha256: string };
  motionSha256: string;
  scaledModelSha256: string;
  alignment: {
    method: 'explicit-source-frame-map';
    rows: { sourceTimestampMs: number; sourceFrameIndex: number; motionTimeSeconds: number }[];
  };
}
export interface OpenCapResult {
  schemaVersion: 1;
  kind: 'opencap-kinematics';
  status: 'imported-unverified';
  source: OpenCapManifest['source'];
  engine: { id: 'opencap-monocular'; revision: typeof OPENCAP_REVISION };
  provenance: { motionSha256: string; scaledModelSha256: string; alignment: 'producer-declared' };
  coordinateSystem: 'OpenSim model generalized coordinates';
  coordinates: { name: string; unit: 'deg' | 'm' }[];
  excludedCoordinates: string[];
  frames: { timestampMs: number; sourceFrameIndex: number; motionTimeSeconds: number; values: Record<string, number> }[];
  limitations: string[];
}
export type LocalBytes = Blob | ArrayBuffer | ArrayBufferView;
export function sha256(value: LocalBytes): Promise<string>;
export function parseOpenSimMotion(text: string): {
  rows: number[][];
  coordinates: { name: string; column: number; unit: 'deg' | 'm'; scale: number }[];
  excludedCoordinates: string[];
};
export function importOpenCapResult(options: {
  motionText: string;
  manifest: OpenCapManifest;
  source: LocalBytes;
  scaledModel: LocalBytes;
}): Promise<OpenCapResult>;
export function openCapFrameAt(result: OpenCapResult, timestampMs: number, maxGapMs?: number): OpenCapResult['frames'][number] | null;
