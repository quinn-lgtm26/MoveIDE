import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ configFile: false,
  root: fileURLToPath(new URL('../../', import.meta.url)),
  server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' })
let browser
try {
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL ?? 'chrome' })
  const page = await browser.newPage()
  const externalRequests = []
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue()
    externalRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto(`${origin}/harness/verify/runner.html`)
  const result = await page.evaluate(async () => {
    const { importOpenCapResult, sha256, OPENCAP_REVISION, openCapFrameAt } = await import('/harness/opencap/import.mjs')
    const motionText = 'Coordinates\nnRows=2\nnColumns=3\ninDegrees=yes\nendheader\ntime knee_angle_r pelvis_ty\n0 10 0.9\n0.03333333 20 0.8\n'
    const source = new File(['synthetic browser parser fixture'], 'constructed-source.bin')
    const scaledModel = new File(['synthetic browser parser model'], 'constructed-model.bin')
    const manifest = { schemaVersion: 1, engine: 'opencap-monocular', upstreamRevision: OPENCAP_REVISION,
      source: { clipId: 'constructed-browser-parser-fixture', durationMs: 167, sha256: await sha256(source) },
      motionSha256: await sha256(new TextEncoder().encode(motionText)), scaledModelSha256: await sha256(scaledModel),
      alignment: { method: 'explicit-source-frame-map', rows: [
        { sourceTimestampMs: 100, sourceFrameIndex: 3, motionTimeSeconds: 0 },
        { sourceTimestampMs: 167, sourceFrameIndex: 5, motionTimeSeconds: .03333333 },
      ] } }
    const imported = await importOpenCapResult({ motionText, source, scaledModel, manifest })
    let mismatchRejected = false
    try { await importOpenCapResult({ motionText, source: new File(['wrong source'], 'wrong.bin'), scaledModel, manifest }) }
    catch (error) { mismatchRejected = /hash mismatch/.test(error.message) }
    const beyond = structuredClone(manifest)
    beyond.alignment.rows[1].sourceTimestampMs = 168
    let beyondDurationRejected = false
    try { await importOpenCapResult({ motionText, source, scaledModel, manifest: beyond }) }
    catch (error) { beyondDurationRejected = /source row mapping/.test(error.message) }
    return { status: imported.status, frameCount: imported.frames.length, coordinateSystem: imported.coordinateSystem,
      units: imported.coordinates.map(item => item.unit), sourceTimes: imported.frames.map(item => item.timestampMs),
      selectedKnee: openCapFrameAt(imported, 167)?.values.knee_angle_r,
      gapUnavailable: openCapFrameAt(imported, 133) === null, mismatchRejected, beyondDurationRejected }
  })
  assert.deepEqual(result, { status: 'imported-unverified', frameCount: 2,
    coordinateSystem: 'OpenSim model generalized coordinates', units: ['deg', 'm'], sourceTimes: [100, 167],
    selectedKnee: 20, gapUnavailable: true, mismatchRejected: true, beyondDurationRejected: true })
  assert.deepEqual(externalRequests, [])
  const evidence = { scope: 'Constructed parser fixtures and synthetic local file bytes. No actual video analysis, OpenCap inference or model accuracy is verified.',
    browser: browser.version(), passed: true, externalRequests: externalRequests.length, ...result }
  if (process.argv.includes('--write')) await writeFile(new URL('./browser-verification.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(JSON.stringify(evidence, null, 2))
} finally { await browser?.close(); await server.close() }
