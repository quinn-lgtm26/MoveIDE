import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { verifyCoachingFixture } from '../coaching/verify-fixture.mjs'
import { getMotionTrace } from '../motion/analyze.mjs'
import { kneeFlexion, VISIBILITY_THRESHOLD } from '../motion/squat.mjs'

const supported = 'supported-squat'
const original = 'sample-squat'
const front = 'front-view-challenge'
const fixtureNames = [supported, original, 'side-gym', 'side-mirror', 'side-busy-background', front]
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const reportSchema = await readJson('../../_bmad-output/specs/shared/analysis-report-v1.schema.json')
const validate = new Ajv2020().compile(reportSchema)

function expectedTorsoLean(frame, report) {
  const side = report.protocol.side
  if (!side || frame.quality !== 'usable') return null
  const [shoulderIndex, hipIndex] = side === 'left' ? [11, 23] : [12, 24]
  const shoulder = frame.landmarks[shoulderIndex]
  const hip = frame.landmarks[hipIndex]
  if (![shoulder, hip].every(point => point && point.visibility >= VISIBILITY_THRESHOLD &&
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)) return null
  const x = (hip.x - shoulder.x) * report.clip.widthPx
  const y = (hip.y - shoulder.y) * report.clip.heightPx
  const length = Math.hypot(x, y)
  if (length < 1) return null
  return Math.acos(Math.min(1, Math.max(-1, y / length))) * 180 / Math.PI
}

function assertAngle(actual, expected) {
  if (expected === null) assert.equal(actual, null)
  else assert(actual !== null && Math.abs(actual - expected) < 1e-6)
}

function assertReport(report, name) {
  assert(validate(report), `${name}: ${JSON.stringify(validate.errors)}`)
  assert.equal(report.clip.id, name)
  assert(report.frames.length > 0, `${name}: no sampled frames`)
  const framesByTime = new Map()
  let previousTime = -1
  for (const frame of report.frames) {
    assert(frame.timestampMs > previousTime && frame.timestampMs <= report.clip.durationMs)
    framesByTime.set(frame.timestampMs, frame)
    previousTime = frame.timestampMs
  }
  const repsById = new Map()
  let lastRepEnd = 0
  for (const rep of report.reps) {
    assert(rep.startMs >= lastRepEnd && rep.startMs <= rep.bottomMs && rep.bottomMs < rep.endMs)
    assert(rep.endMs <= report.clip.durationMs)
    for (const time of [rep.startMs, rep.bottomMs, rep.endMs]) {
      assert.equal(framesByTime.get(time)?.quality, 'usable')
    }
    assert(!repsById.has(rep.id))
    repsById.set(rep.id, rep)
    lastRepEnd = rep.endMs
  }
  const measurementIds = new Set()
  for (const measure of report.measurements) {
    assert(!measurementIds.has(measure.id))
    measurementIds.add(measure.id)
    const rep = repsById.get(measure.repId)
    assert(measure.repId === null || rep)
    if (measure.metric === 'torso_lean') {
      assert(rep, 'Torso lean measurements use a rep bottom')
      assertAngle(measure.value, expectedTorsoLean(framesByTime.get(rep.bottomMs), report))
    }
    if (measure.quality === 'unavailable') continue
    const frame = framesByTime.get(measure.evidenceTimestampMs)
    assert.equal(frame?.quality, 'usable')
    if (rep) assert.equal(measure.evidenceTimestampMs, rep.bottomMs)
    if (measure.metric === 'knee_flexion') {
      assert(report.protocol.side)
      const { widthPx, heightPx } = report.clip
      const expected = kneeFlexion(frame.landmarks, report.protocol.side, widthPx, heightPx)
      assert.notEqual(expected, null)
      assert(Math.abs(measure.value - expected) < 1e-9)
    } else if (measure.metric === 'rep_duration') {
      assert.equal(measure.value, rep.endMs - rep.startMs)
    }
  }
  const trace = getMotionTrace(report)
  assert.equal(trace.length, report.frames.length)
  trace.forEach((sample, index) => {
    const frame = report.frames[index]
    assert.equal(sample.timestampMs, frame.timestampMs)
    const rep = report.reps.find(({ startMs, endMs }) => startMs <= sample.timestampMs && sample.timestampMs <= endMs)
    assert.equal(sample.repId, rep?.id ?? null)
    if (rep) {
      const phase = sample.timestampMs < rep.bottomMs ? 'descent' : sample.timestampMs === rep.bottomMs ? 'bottom' : 'ascent'
      assert.equal(sample.phase, phase)
    } else {
      assert.equal(sample.phase, null)
    }
    if (frame.quality !== 'usable') assert.equal(sample.kneeFlexionDeg, null)
    assertAngle(sample.torsoLeanDeg, expectedTorsoLean(frame, report))
  })
}

function compareLabels(report, labels) {
  const observedBottomMs = report.reps.map(rep => rep.bottomMs)
  const deltasMs = labels.bottomTimestampsMs.map((expected, index) =>
    observedBottomMs[index] === undefined ? null : Math.abs(observedBottomMs[index] - expected))
  return {
    expectedCompleteReps: labels.expectedCompleteReps,
    expectedBottomMs: labels.bottomTimestampsMs,
    toleranceMs: labels.bottomToleranceMs,
    absoluteBottomErrorsMs: deltasMs,
    passed: report.reps.length === labels.expectedCompleteReps &&
      deltasMs.every(delta => delta !== null && delta <= labels.bottomToleranceMs),
  }
}

async function analyzeFixture(page, name) {
  return page.evaluate(async ({ name, useFile }) => {
    const path = `/fixtures/squat/${name}.mp4`
    let source = path
    if (useFile) {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Could not load ${path}`)
      source = new File([await response.blob()], `${name}.mp4`, { type: 'video/mp4' })
    }
    return window.analyzeSquat(source, { clipId: name })
  }, { name, useFile: name === supported })
}

async function assertRecoverableBrowserErrors(page) {
  const redirectPath = '/harness/verify/redirect-clip.mp4'
  await page.route(`**${redirectPath}`, route => route.fulfill({
    status: 302,
    headers: { location: 'https://outside.moveide.invalid/clip.mp4' },
  }))
  const results = await page.evaluate(async redirectPath => {
    const abort = new AbortController()
    const source = '/fixtures/squat/supported-squat.mp4'
    const canceled = window.analyzeSquat(source, {
      signal: abort.signal,
      onProgress(update) {
        if (update.stage === 'analyzing') abort.abort()
      },
    }).catch(error => error.name)
    const invalid = window.analyzeSquat(new File(['invalid'], 'bad.mp4', { type: 'video/mp4' }))
      .catch(error => error.message)
    const wrongModel = window.analyzeSquat(source, { assets: { modelUrl: source } }).catch(error => error.message)
    const redirected = window.analyzeSquat(redirectPath).catch(error => error.message)
    const { openVideo } = await import('/harness/motion/video.mjs')
    const objectUrl = URL.createObjectURL(await (await fetch(source)).blob())
    let objectUrlPreserved
    try {
      const decoder = await openVideo(objectUrl)
      decoder.close()
      objectUrlPreserved = (await fetch(objectUrl)).ok
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
    return { canceled: await canceled, invalid: await invalid, wrongModel: await wrongModel,
      redirected: await redirected, objectUrlPreserved }
  }, redirectPath)
  assert.equal(results.canceled, 'AbortError')
  assert.match(results.invalid, /could not be decoded/)
  assert.match(results.wrongModel, /Expected the pinned MediaPipe Pose Landmarker Full v1 model/)
  assert.match(results.redirected, /same-origin URL without redirects/)
  assert.equal(results.objectUrlPreserved, true)
}

const writeResults = process.argv.includes('--write')
const outputDir = writeResults
  ? fileURLToPath(new URL('../results/', import.meta.url))
  : await mkdtemp(join(tmpdir(), 'moveide-fixtures-'))
const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
  server: { port: 0, host: '127.0.0.1' },
  logLevel: 'silent',
})
let browser
try {
  await server.listen(0)
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL ?? 'chrome' })
  const context = await browser.newContext({ serviceWorkers: 'block' })
  const externalRequests = []
  await context.route('**/*', route => {
    const requestUrl = new URL(route.request().url())
    if (requestUrl.origin === origin) return route.continue()
    externalRequests.push(requestUrl.origin)
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(`${origin}/harness/verify/runner.html`)
  await page.waitForFunction(() => typeof window.analyzeSquat === 'function')

  const cases = []
  let supportedReport
  for (const name of fixtureNames) {
    const report = await analyzeFixture(page, name)
    assertReport(report, name)
    const caseResult = {
      clip: `${name}.mp4`,
      frameCount: report.frames.length,
      usableFrameCount: report.frames.filter(frame => frame.quality === 'usable').length,
      side: report.protocol.side,
      completeReps: report.reps.length,
      bottomTimestampsMs: report.reps.map(rep => rep.bottomMs),
      kneeMeasurements: report.measurements.filter(measure => measure.metric === 'knee_flexion'),
      torsoMeasurements: report.measurements.filter(measure => measure.metric === 'torso_lean'),
      warnings: report.warnings.map(warning => warning.code),
    }
    if (name === supported || name === original) {
      const labels = await readJson(`../../fixtures/squat/${name}.labels.json`)
      caseResult.manualLabelCheck = compareLabels(report, labels)
    }
    if (name === supported) {
      assert(caseResult.manualLabelCheck.passed, JSON.stringify(caseResult.manualLabelCheck))
      assert.equal(caseResult.torsoMeasurements.length, caseResult.completeReps)
      assert(caseResult.torsoMeasurements.every(({ quality }) => quality === 'usable'))
      supportedReport = report
    } else if (name === original && !caseResult.manualLabelCheck.passed) {
      assert(caseResult.warnings.includes('intermittent_pose') || caseResult.warnings.includes('pose_unavailable'))
    } else if (name === front) {
      assert(caseResult.warnings.includes('unsupported_framing'))
      assert.equal(caseResult.side, null)
      assert.equal(caseResult.usableFrameCount, 0)
      assert.equal(caseResult.completeReps, 0)
      assert(report.measurements.every(measure => measure.quality === 'unavailable'))
    }
    cases.push(caseResult)
    console.log(`${name}: ${caseResult.usableFrameCount}/${caseResult.frameCount} usable, ${caseResult.completeReps} complete reps, bottoms [${caseResult.bottomTimestampsMs.join(', ')}] ms`)
  }

  await assertRecoverableBrowserErrors(page)
  await mkdir(outputDir, { recursive: true })
  const packet = await verifyCoachingFixture(page, supportedReport, outputDir, `${supported}.mp4`)
  assert.deepEqual(externalRequests, [], 'Local fixture verification must not make third-party requests')

  if (writeResults) {
    const summary = {
      engine: {
        sdk: '@mediapipe/tasks-vision@1.2.2',
        poseModel: supportedReport.poseModel,
        delegate: 'CPU',
        browser: `Chromium ${browser.version()}`,
        visibilityThreshold: VISIBILITY_THRESHOLD,
      },
      verification: {
        analysisReportSchema: 'passed',
        reportEvidenceAndGeometry: 'passed',
        motionTraceAndTorsoGeometry: 'passed',
        supportedClipManualLabelCheck: 'passed',
        frontViewCaptureGuidance: 'passed',
        abortAndInvalidClip: 'passed',
        rejectsMismatchedModel: 'passed',
        rejectsClipRedirectAndAcceptsObjectUrl: 'passed',
        coachingPacketAndJpegs: 'passed',
        coachingEvidenceFrames: packet.evidence.length,
        thirdPartyRequests: externalRequests.length,
      },
      scope: 'Manual labels verify rep count and bottom timing on two fixtures. There are no reference joint angles. The three other side views are exploratory.',
      cases,
    }
    await writeFile(join(outputDir, `${supported}.analysis-report.v1.json`), `${JSON.stringify(supportedReport)}\n`)
    await writeFile(join(outputDir, `${supported}.motion-trace.v1.json`), `${JSON.stringify(getMotionTrace(supportedReport), null, 2)}\n`)
    await writeFile(join(outputDir, 'fixture-verification.json'), `${JSON.stringify(summary, null, 2)}\n`)
  }
  console.log('Report, evidence geometry, coaching bundle, cancellation, and capture guidance verified.')
} finally {
  await browser?.close()
  await server.close()
  if (!writeResults) await rm(outputDir, { force: true, recursive: true })
}
