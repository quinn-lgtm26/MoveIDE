export const POSE_MODEL = Object.freeze({ id: 'mediapipe-pose-landmarker-full', version: '1' })
export const POSE_MODEL_SHA256 = '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1'

export const POSE_PRESETS = Object.freeze({
  full: Object.freeze({
    report: POSE_MODEL,
    fileName: 'pose_landmarker_full.task',
    sha256: POSE_MODEL_SHA256,
  }),
  heavy: Object.freeze({
    report: Object.freeze({ id: 'mediapipe-pose-landmarker-heavy', version: '1' }),
    fileName: 'pose_landmarker_heavy.task',
    sha256: '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b',
  }),
})
