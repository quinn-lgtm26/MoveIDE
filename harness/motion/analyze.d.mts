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
  /** Optional local-only raw model output. Never included in CoachPacket. */
  onPoseFrame?: (frame: RawPoseFrame) => void
  /** Heavy is the default. Both pinned Heavy and Full assets are staged by setup:pose. */
  model?: 'full' | 'heavy'
  assets?: {
    /** Trusted same-origin directory serving the pinned SDK's WASM assets directly. */
    wasmRoot?: string
    /** Same-origin URL serving the pinned model bytes for the selected preset. */
    modelUrl?: string
  }
}

export interface RawPoseLandmark {
  x: number
  y: number
  z: number
  visibility: number | null
  presence: number | null
}

export interface RawPoseFrame {
  timestampMs: number
  poseModel: { id: string; version: string }
  normalizedLandmarks: (RawPoseLandmark | null)[]
  worldLandmarks: (RawPoseLandmark | null)[]
}

export const RAW_POSE_COORDINATES: Readonly<{ normalized: string; world: string }>

export interface SquatMetrics {
  kneeFlexionDeg: number | null
  torsoLeanDeg: number | null
  hipFlexionDeg: number | null
  shinInclinationDeg: number | null
  ankleClosureChangeDeg: number | null
  hipDescentLegLengths: number | null
  hipAboveKneeLegLengths: number | null
}

export interface MotionTraceSample extends SquatMetrics {
  timestampMs: number
  repId: string | null
  phase: 'descent' | 'bottom' | 'ascent' | null
}

export interface MotionFrameReference {
  id: string
  timestampMs: number
}

export interface SquatRepProfile {
  repId: string
  startMs: number
  bottomMs: number
  endMs: number
  descentMs: number | null
  ascentMs: number | null
  bottom: SquatMetrics
  evidence: {
    start: MotionFrameReference | null
    bottom: MotionFrameReference | null
    end: MotionFrameReference | null
  }
}

export interface SquatProfile {
  schemaVersion: 1
  clipId: string
  side: BodySide | null
  reps: SquatRepProfile[]
}

export function analyzeSquat(source: ClipSource, options?: AnalysisOptions): Promise<AnalysisReport>
export function getMotionTrace(report: AnalysisReport): MotionTraceSample[]
export function getSquatProfile(report: AnalysisReport): SquatProfile
