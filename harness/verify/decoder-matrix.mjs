import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { auditSourceTimeline } from './source-timeline.mjs'

// Synthetic decoder checks only: these images do not validate pose accuracy.
// Pixel tolerance is fixed before execution, on the 0–255 RGB scale.
const PIXEL_MAE_LIMIT = 3
const run = (command, args) => execFileSync(command, args, { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 })
const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args])
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const directory = await mkdtemp(join(tmpdir(), 'moveide-decoder-'))
const files = new Map()
let server
let browser
try {
  const encode = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart']
  for (const [name, rate] of [['30hz', 30], ['7hz', 7]]) {
    const path = join(directory, `${name}.mp4`)
    ffmpeg(['-f', 'lavfi', '-i', `testsrc2=size=96x64:rate=${rate}:duration=2,format=gray`, ...encode, path])
    files.set(name, path)
  }
  const variable = join(directory, 'variable.mp4')
  ffmpeg(['-i', files.get('30hz'), '-vf', "select='if(lt(n,30),not(mod(n,2)),not(mod(n,5)))'",
    '-fps_mode', 'vfr', ...encode, '-bf', '0', variable])
  files.set('variable', variable)
  const rotated = join(directory, 'rotated.mp4')
  ffmpeg(['-display_rotation', '90', '-i', files.get('30hz'), '-c', 'copy', rotated])
  files.set('rotated', rotated)
  const truncated = join(directory, 'truncated.mp4')
  await writeFile(truncated, (await readFile(files.get('30hz'))).subarray(0, 24))
  files.set('truncated', truncated)

  server = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
    server: { host: '127.0.0.1', port: 0, watch: null }, logLevel: 'silent',
    plugins: [{ name: 'synthetic-decoder-fixtures', configureServer(instance) {
      instance.middlewares.use(async (request, response, next) => {
        const name = /^\/decoder-matrix\/([a-z0-9]+)\.mp4$/.exec(request.url)?.[1]
        if (!files.has(name)) return next()
        try {
          const bytes = await readFile(files.get(name))
          response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }).end(bytes)
        } catch { response.writeHead(500).end() }
      })
    } }],
  })
  await server.listen(0)
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const outsideRequests = []
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue()
    outsideRequests.push(route.request().url())
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(`${origin}/harness/verify/runner.html`)
  await page.waitForFunction(() => typeof window.analyzeSquat === 'function')
  const cases = []
  for (const name of ['30hz', '7hz', 'variable', 'rotated']) {
    const path = files.get(name)
    const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=start_time,duration,width,height:stream_side_data=rotation:frame=best_effort_timestamp_time', '-of', 'json', path]))
    assert(Number(probe.streams[0].duration) > Number(probe.frames.at(-1).best_effort_timestamp_time), `${name}: source PTS must be inside declared duration`)
    const report = await page.evaluate(name => window.analyzeSquat(`/decoder-matrix/${name}.mp4`, { clipId: name, model: 'full' }), name)
    const rotation = Number(probe.streams[0].side_data_list?.find(item => item.rotation !== undefined)?.rotation ?? 0)
    const expectedDimensions = rotation === 90 ? [64, 96] : [96, 64]
    assert.deepEqual([report.clip.widthPx, report.clip.heightPx], expectedDimensions, `${name}: display dimensions`)
    // Rotation is checked explicitly above and through FFmpeg's autorotated pixels below.
    // Normalize only the dimensions for the shared timestamp-only audit.
    const timelineProbe = structuredClone(probe)
    if (name === 'rotated') {
      assert.equal(rotation, 90)
      Object.assign(timelineProbe.streams[0], { width: 64, height: 96, side_data_list: [] })
    }
    const audit = auditSourceTimeline(report, timelineProbe)
    assert(audit.passed, `${name}: unmatched analysis timestamps`)
    if (name === '30hz' || name === 'rotated') {
      assert.equal(audit.sourceFrameCount, 60)
      assert.equal(audit.analyzedFrameCount, 30)
      assert.equal(audit.everySourceTimestampRepresented, false)
    }
    if (name === '7hz') {
      assert.equal(audit.sourceFrameCount, 14)
      assert.equal(audit.everySourceTimestampRepresented, true)
    }
    if (name === 'variable') assert(audit.sourceIntervals.maxMs - audit.sourceIntervals.minMs > 90)
    const selected = [...new Set([0, Math.floor(audit.matches.length / 2), audit.matches.length - 1])].map(index => audit.matches[index])
    const pixels = []
    for (const { timestampMs, sourceFrameIndex } of selected) {
      const actual = await page.evaluate(async ({ name, timestampMs }) => {
        const { openVideo, seekVideoFrame } = await import('/harness/motion/video.mjs')
        const { video, close } = await openVideo(`/decoder-matrix/${name}.mp4`)
        try {
          const time = await seekVideoFrame(video, Math.min(timestampMs / 1000 + .001, video.duration * .999999))
          const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight)
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0)
          const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          return { time, rgb: Array.from(rgba).filter((_value, index) => index % 4 !== 3) }
        } finally { close() }
      }, { name, timestampMs })
      assert.equal(actual.time, timestampMs)
      const reference = ffmpeg(['-i', path, '-vf', `select=eq(n\\,${sourceFrameIndex})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
      assert.equal(actual.rgb.length, reference.length)
      const mae = actual.rgb.reduce((sum, value, index) => sum + Math.abs(value - reference[index]), 0) / reference.length
      assert(mae <= PIXEL_MAE_LIMIT, `${name} ${timestampMs} ms: RGB mean absolute error ${mae} > ${PIXEL_MAE_LIMIT}`)
      pixels.push({ timestampMs, sourceFrameIndex, rgbMeanAbsoluteError: mae })
    }
    const { matches, ...summary } = audit
    cases.push({ name, sha256: hash(await readFile(path)), codedDimensions: [96, 64], displayDimensions: expectedDimensions,
      rotationDegrees: rotation, ...summary, pixelChecks: pixels })
    console.log(`${name}: ${audit.analyzedFrameCount}/${audit.sourceFrameCount} source frames represented, ${pixels.length} pixel checks passed`)
  }

  const errors = await page.evaluate(async () => {
    const malformed = await window.analyzeSquat('/decoder-matrix/truncated.mp4', { model: 'full' }).then(() => null, error => error.message)
    const controller = new AbortController()
    let canceledAt
    let processedFrameCount = 0
    const canceled = await window.analyzeSquat('/decoder-matrix/30hz.mp4', {
      model: 'full', signal: controller.signal,
      onProgress(update) {
        if (update.frameCount === 1) {
          processedFrameCount = update.frameCount
          canceledAt = performance.now()
          controller.abort()
        }
      },
    }).then(() => ({ name: null }), error => ({ name: error.name, settlementMs: performance.now() - canceledAt }))
    return { malformed, canceled, processedFrameCount }
  })
  assert.match(errors.malformed, /could not be decoded/)
  assert.equal(errors.canceled.name, 'AbortError')
  assert.equal(errors.processedFrameCount, 1)
  assert(errors.canceled.settlementMs < 1000)
  assert.deepEqual(outsideRequests, [])
  const result = {
    schemaVersion: 1, browser: browser.version(),
    ffmpeg: run('ffmpeg', ['-version']).toString().split('\n')[0],
    scope: 'Synthetic H.264 decoder QA through the actual Full model analysis path. Checks timestamp accounting, 90-degree display orientation, three source-frame pixel comparisons per variant, malformed input and cancellation. No pose or angle accuracy claim; no exact/full-rate decoder is implemented.',
    generation: '96x64 grayscale testsrc2 to isolate frame and orientation identity from chroma-upscaling differences, two seconds, H.264 yuv420p CRF 18. 30 and 7 Hz CFR; VFR selects every second 30 Hz frame before frame 30 and every fifth thereafter, preserving PTS, with B-frames disabled to keep the declared MP4 duration consistent with final PTS. Rotation copies the 30 Hz track with 90-degree display metadata. Truncated input is the first 24 bytes.',
    pixelTolerance: { metric: 'RGB mean absolute error against FFmpeg autorotated rgb24 decode', scale: '0-255', maximum: PIXEL_MAE_LIMIT },
    cases, failureRecovery: errors, thirdPartyRequestCount: outsideRequests.length,
  }
  if (process.argv.includes('--write')) await writeFile(new URL('../results/decoder-matrix.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
  console.log('Malformed input and cancellation during processing passed; no third-party requests.')
} finally {
  await browser?.close()
  await server?.close()
  await rm(directory, { recursive: true, force: true })
}
