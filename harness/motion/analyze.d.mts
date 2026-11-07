export type ClipSource = Blob | URL | string
export type BodySide = 'left' | 'right'
export type Quality = 'usable' | 'unavailable'

export interface ClipMetadata {
  id: string
  widthPx: number
  heightPx: number
  durationMs: number
}

export interface Landmark {
  x: number
  y: number
  visibility: number
}

export interface PoseFrame {
  timestampMs: number
  landmarks: (Landmark | null)[]
  quality: Quality
}

export interface Rep {
  id: string
  startMs: number
  bottomMs: number
  endMs: number
}

export type Metric = 'knee_flexion' | 'rep_duration' | 'torso_lean'

export type Measurement = {
  id: string
  repId: string | null
  metric: Metric
  unit: 'deg' | 'ms'
} & (
  | { quality: 'usable'; value: number; evidenceTimestampMs: number }
  | { quality: 'unavailable'; value: null; evidenceTimestampMs: null }
)

export interface AnalysisReport {
  schemaVersion: 1
  clip: ClipMetadata
  protocol: { id: 'squat-side'; version: string; side: BodySide | null }
  poseModel: { id: string; version: string }
  frames: PoseFrame[]
  reps: Rep[]
  measurements: Measurement[]
  warnings: { code: string; message: string }[]
}

export interface AnalysisProgress {
  stage: 'loading-model' | 'analyzing' | 'complete'
  progress: number
  frameCount: number
}

export interface AnalysisOptions {
  clipId?: string
  signal?: AbortSignal
  onProgress?: (progress: AnalysisProgress) => void
  assets?: { wasmRoot?: string; modelUrl?: string }
}

export function analyzeSquat(source: ClipSource, options?: AnalysisOptions): Promise<AnalysisReport>
