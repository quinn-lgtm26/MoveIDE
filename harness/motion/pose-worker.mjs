import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { POSE_MODEL_SHA256 } from './pose-model.mjs'

let landmarker

async function loadModel(modelUrl) {
  const response = await fetch(modelUrl, { mode: 'same-origin', redirect: 'error' })
  if (!response.ok) throw new Error(`Could not load the pose model (HTTP ${response.status}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')
  if (sha256 !== POSE_MODEL_SHA256) throw new Error('Expected the pinned MediaPipe Pose Landmarker Full v1 model.')
  return bytes
}

self.onmessage = async ({ data }) => {
  const { type, bitmap } = data
  try {
    if (type === 'init') {
      const fileset = await FilesetResolver.forVisionTasks(data.wasmRoot, true)
      const modelAssetBuffer = await loadModel(data.modelUrl)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
      self.postMessage({})
    } else if (type === 'frame') {
      const result = landmarker.detectForVideo(bitmap, data.timestampMs)
      self.postMessage({ landmarks: result.landmarks[0] ?? [] })
    }
  } catch (error) {
    self.postMessage({ error: error.message || String(error) })
  } finally {
    bitmap?.close()
  }
}
