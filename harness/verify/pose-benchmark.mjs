import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { arch, cpus } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { POSE_PRESETS } from '../motion/pose-model.mjs'

const heavyUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task'
const heavyRoute = '/harness/verify/pose_landmarker_heavy.task'
const response = await fetch(heavyUrl, { signal: AbortSignal.timeout(60_000) })
if (!response.ok) throw new Error(`Heavy model download failed (HTTP ${response.status})`)
const heavy = Buffer.from(await response.arrayBuffer())
assert.equal(createHash('sha256').update(heavy).digest('hex'), POSE_PRESETS.heavy.sha256)
const full = await readFile(new URL(`../public/pose/${POSE_PRESETS.full.fileName}`, import.meta.url))
assert.equal(createHash('sha256').update(full).digest('hex'), POSE_PRESETS.full.sha256)

const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'silent',
  plugins: [{
    name: 'moveide-pose-benchmark',
    configureServer(server) {
      server.middlewares.use(heavyRoute, (_request, response) => {
        response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': heavy.length })
        response.end(heavy)
      })
    },
  }],
})
let browser
try {
  await server.listen(0)
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const externalRequests = []
  await context.route('**/*', route => {
    const requestOrigin = new URL(route.request().url()).origin
    if (requestOrigin === origin) return route.continue()
    externalRequests.push(requestOrigin)
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(`${origin}/harness/verify/runner.html`)
  await page.waitForFunction(() => typeof window.analyzeSquat === 'function')

  const cases = []
  for (const [name, order] of [
    ['supported-squat', ['full', 'heavy']],
    ['sample-squat', ['heavy', 'full']],
  ]) {
    const labels = JSON.parse(await readFile(new URL(`../../fixtures/squat/${name}.labels.json`, import.meta.url), 'utf8'))
    for (const model of order) {
      const { report, elapsedMs } = await page.evaluate(async ({ name, model, heavyRoute }) => {
        const response = await fetch(`/fixtures/squat/${name}.mp4`)
        if (!response.ok) throw new Error('Could not load the benchmark clip.')
        const file = new File([await response.blob()], `${name}.mp4`, { type: 'video/mp4' })
        const start = performance.now()
        const report = await window.analyzeSquat(file, {
          model,
          clipId: name,
          assets: model === 'heavy' ? { modelUrl: heavyRoute } : {},
        })
        return { report, elapsedMs: Math.round(performance.now() - start) }
      }, { name, model, heavyRoute })
      assert.deepEqual(report.poseModel, POSE_PRESETS[model].report)
      const bottomTimestampsMs = report.reps.map(rep => rep.bottomMs)
      const absoluteBottomErrorsMs = labels.bottomTimestampsMs.map((expected, index) =>
        bottomTimestampsMs[index] === undefined ? null : Math.abs(bottomTimestampsMs[index] - expected))
      const usableFrameCount = report.frames.filter(frame => frame.quality === 'usable').length
      const result = {
        clip: labels.clip,
        preset: model,
        poseModel: report.poseModel,
        elapsedMs,
        side: report.protocol.side,
        sampledFrameCount: report.frames.length,
        usableFrameCount,
        usableFramePercent: Number((100 * usableFrameCount / report.frames.length).toFixed(1)),
        completeReps: report.reps.length,
        bottomTimestampsMs,
        expectedCompleteReps: labels.expectedCompleteReps,
        expectedBottomMs: labels.bottomTimestampsMs,
        toleranceMs: labels.bottomToleranceMs,
        absoluteBottomErrorsMs,
        passedManualLabels: report.reps.length === labels.expectedCompleteReps &&
          absoluteBottomErrorsMs.every(error => error !== null && error <= labels.bottomToleranceMs),
        warnings: report.warnings.map(({ code }) => code),
      }
      cases.push(result)
      console.log(`${name} ${model}: ${usableFrameCount}/${report.frames.length} usable, ${report.reps.length} reps, bottoms [${bottomTimestampsMs.join(', ')}] ms, ${elapsedMs} ms elapsed`)
    }
  }
  assert.deepEqual(externalRequests, [], 'Browser benchmark must not make third-party requests')
  if (process.argv.includes('--write')) {
    const summary = {
      sdk: '@mediapipe/tasks-vision@1.2.2',
      browser: `Chromium ${browser.version()}`,
      delegate: 'CPU',
      hardware: `${cpus()[0].model} (${arch()})`,
      scope: 'One local cold-worker timing per model and clip. Elapsed time includes worker setup, model request and checksum, decoding, and inference. The fixtures label rep timing and do not provide reference joint angles.',
      assets: {
        full: { bytes: full.length, sha256: POSE_PRESETS.full.sha256 },
        heavy: { bytes: heavy.length, sha256: POSE_PRESETS.heavy.sha256, url: heavyUrl },
      },
      cases,
      thirdPartyBrowserRequests: externalRequests.length,
    }
    await writeFile(new URL('../results/pose-model-benchmark.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`)
  }
} finally {
  await browser?.close()
  await server.close()
}
