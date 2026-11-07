import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

let landmarker

self.onmessage = async ({ data }) => {
  const { type, bitmap } = data
  try {
    if (type === 'init') {
      const fileset = await FilesetResolver.forVisionTasks(data.wasmRoot, true)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: data.modelUrl, delegate: 'CPU' },
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
