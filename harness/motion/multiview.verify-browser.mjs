import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const baseline = process.argv.includes('--baseline');
const output = new URL('./multiview-browser-evidence.json', import.meta.url);
const server = await createServer({ configFile: new URL('../vite.config.mjs', import.meta.url).pathname, logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: false } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const externalRequests = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    externalRequests.push(route.request().url()); return route.abort();
  });
  await page.goto(`${origin}/harness/verify/runner.html`);
  const observed = await page.evaluate(async () => {
    const { analyzeSquat } = await import('/harness/motion/analyze.mjs');
    const { analyzeMultiViewFrame } = await import('/harness/motion/multiview.mjs');
    const video = document.createElement('video'); video.src = '/fixtures/squat/clear-squat.mp4';
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    const width = video.videoWidth, height = video.videoHeight;
    const counts = { rawFrames: 0, normalized: { points: 0, visibility: 0, presence: 0 }, world: { points: 0, visibility: 0, presence: 0 } };
    const metrics = {};
    const report = await analyzeSquat('/fixtures/squat/clear-squat.mp4', { model: 'heavy', clipId: 'clear-squat-confidence-verification', onPoseFrame(raw) {
      counts.rawFrames++;
      for (const [kind, points] of [['normalized', raw.normalizedLandmarks], ['world', raw.worldLandmarks]]) for (const point of points) {
        if (!point) continue;
        counts[kind].points++;
        for (const key of ['visibility', 'presence']) if (Number.isFinite(point[key])) counts[kind][key]++;
      }
      const diagnostic = analyzeMultiViewFrame(raw, { width, height, view: 'side' });
      for (const [key, value] of Object.entries(diagnostic.metrics)) {
        metrics[key] ??= { estimated: 0, unavailable: 0, reasons: {} };
        metrics[key][value.status]++;
        metrics[key].reasons[value.reason] = (metrics[key].reasons[value.reason] ?? 0) + 1;
      }
    } });
    return { fixture: 'clear-squat.mp4', declaredView: 'side', width, height, model: report.poseModel, counts, metrics };
  });
  observed.browser = browser.version(); observed.runAt = new Date().toISOString();
  observed.externalRequestCount = externalRequests.length;
  observed.scope = 'Actual pinned Heavy SDK outputs; formula availability only, not joint-angle accuracy or front/oblique validation. No raw landmarks retained.';
  let evidence = {};
  try { evidence = JSON.parse(await readFile(output, 'utf8')); } catch {}
  evidence[baseline ? 'beforeConfidenceFix' : 'afterConfidenceFix'] = observed;
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
  assert.ok(observed.counts.rawFrames >= 10);
  assert.equal(externalRequests.length, 0);
  if (!baseline) assert.ok(observed.metrics.leftKneeFlexion3d.estimated + observed.metrics.rightKneeFlexion3d.estimated > 0, 'Actual Heavy must expose usable 3D knee diagnostics on some supported fixture frames');
  console.log(JSON.stringify(observed));
} finally { await browser?.close(); await server.close(); }
