// Decoder shared by pose analysis and source-image capture.
function checkSignal(signal) {
  signal?.throwIfAborted()
}

function waitForVideo(video, event, signal) {
  checkSignal(signal)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Timed out decoding the clip.')), 15_000)
    const finish = (error) => {
      clearTimeout(timeout)
      video.removeEventListener(event, ready)
      video.removeEventListener('error', failed)
      signal?.removeEventListener('abort', aborted)
      error ? reject(error) : resolve()
    }
    const ready = () => finish()
    const failed = () => finish(new Error('This video could not be decoded. Try an MP4 with H.264 video.'))
    const aborted = () => finish(signal.reason)
    video.addEventListener(event, ready, { once: true })
    video.addEventListener('error', failed, { once: true })
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

export async function openVideo(source, { signal } = {}) {
  checkSignal(signal)
  const video = document.createElement('video')
  const sourceUrl = source instanceof Blob ? null : new URL(source, location.href)
  if (sourceUrl && sourceUrl.origin !== location.origin) {
    throw new Error('Choose a local clip or use a same-origin sample.')
  }
  let ownedObjectUrl
  if (!sourceUrl) {
    ownedObjectUrl = URL.createObjectURL(source)
  } else if (sourceUrl.protocol !== 'blob:') {
    // Decode the same-origin response through a local URL. A media element
    // loading an HTTP URL directly can follow redirects outside this app.
    try {
      const timeout = AbortSignal.timeout(15_000)
      const downloadSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
      const response = await fetch(sourceUrl, { mode: 'same-origin', redirect: 'error', signal: downloadSignal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      ownedObjectUrl = URL.createObjectURL(await response.blob())
    } catch (error) {
      signal?.throwIfAborted()
      throw new Error('Could not open the clip. Use a local file or a same-origin URL without redirects.', { cause: error })
    }
  }
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  function close() {
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()
    if (ownedObjectUrl) URL.revokeObjectURL(ownedObjectUrl)
  }

  try {
    const loaded = waitForVideo(video, 'loadeddata', signal)
    video.src = ownedObjectUrl ?? sourceUrl.href
    await loaded
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error('This clip has no usable video track or duration.')
    }
    return { video, close, sourceUrl: sourceUrl?.href }
  } catch (error) {
    close()
    throw error
  }
}

export async function seekVideo(video, seconds, signal) {
  checkSignal(signal)
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= video.duration) {
    throw new RangeError('Evidence time is outside the clip.')
  }
  if (!video.seeking && video.currentTime === seconds && video.readyState >= 2) return
  const seeked = waitForVideo(video, 'seeked', signal)
  video.currentTime = seconds
  await seeked
}

// Register before seeking so the callback timestamps the decoded frame,
// which can precede the requested time when it lies between source frames.
export async function seekVideoFrame(video, seconds, signal) {
  signal?.throwIfAborted()
  let token
  let timer
  let abort
  const displayed = new Promise((resolve, reject) => {
    token = video.requestVideoFrameCallback((_now, metadata) => resolve(Math.round(metadata.mediaTime * 1000)))
    timer = setTimeout(() => reject(new Error('The browser did not present the requested video frame.')), 3_000)
    abort = () => reject(signal.reason)
    signal?.addEventListener('abort', abort, { once: true })
  })
  try {
    const [, timestampMs] = await Promise.all([seekVideo(video, seconds, signal), displayed])
    return timestampMs
  } finally {
    clearTimeout(timer)
    video.cancelVideoFrameCallback(token)
    signal?.removeEventListener('abort', abort)
  }
}
