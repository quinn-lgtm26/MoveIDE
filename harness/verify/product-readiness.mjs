import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { preview } from 'vite';

// Fresh-build recorded-product gate. No account inference, phone test or paid Wren dispatch.
const root = fileURLToPath(new URL('../../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const optionalPacket = process.argv.includes('--developer-packet');
const checks = {};
let browser, server;
let result = {
  testedAt: new Date().toISOString(), readyForFinalQA: false, readyForWrenDispatch: false,
  outcome: 'probe-error', provider: 'Controlled disconnected connection; no model interpretation requested.', checks,
  scope: 'Fresh-built root recorded-video Start journey with real local MediaPipe Heavy. Developer export is diagnostic inspection, not a normal user step. No packet/copy step is required. This gate does not establish real AI, two-video comparison, phone connectivity, clinical angle accuracy, or final Wren qualification.',
};
try {
  result.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  result.sourceChanges = execFileSync('git', ['status', '--porcelain', '--', 'src', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  execFileSync('npm', ['run', 'build'], { cwd: root, env: { ...process.env, CI: '1' }, encoding: 'utf8', maxBuffer: 5_000_000 });
  checks.freshBuild = true;
  result.build = { indexSha256: sha(await readFile(`${root}dist/index.html`)), probeSha256: sha(await readFile(fileURLToPath(import.meta.url))) };
  const expectedHash = sha(await readFile(`${root}fixtures/squat/clear-squat.mp4`));
  const labels = JSON.parse(await readFile(`${root}fixtures/squat/clear-squat.labels.json`, 'utf8'));
  server = await preview({ root, configFile: `${root}vite.config.ts`, preview: { host: '127.0.0.1', port: 0, strictPort: false } });
  browser = await chromium.launch({ channel: process.env.MOVEIDE_CHROMIUM_CHANNEL || 'chrome' });
  result.browser = browser.version();
  const context = await browser.newContext();
  const page = await context.newPage();
  const origins = new Set(), errors = [];
  let interpretationRequests = 0;
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  context.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) origins.add(url.origin);
    if (url.pathname === '/api/interpret') interpretationRequests++;
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/connection', route => route.fulfill({ json: { state: 'disconnected', enabled: false } }));
  await page.goto(origin);
  await page.getByRole('button', { name: 'Start coached squat', exact: true }).click();
  await page.getByText(/Ready · clear-squat\.mp4/).waitFor({ timeout: 90_000 });
  await page.getByText(/Local tracking only — coach disconnected/).waitFor();
  checks.oneStartReady = true;
  checks.honestOfflineMode = true;
  checks.packetHiddenByDefault = !await page.getByRole('button', { name: 'Preview coaching packet', exact: true }).isVisible();
  result.sourceHash = await page.locator('video').evaluate(async video => {
    const bytes = await (await fetch(video.currentSrc || video.src)).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  });
  checks.clearFixture = result.sourceHash === expectedHash;
  // Read the report only after the normal Start workflow has succeeded; do not open packet tools.
  await page.getByText('Developer tools: report and coaching packet', { exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export report JSON', exact: true }).click()]);
  const report = JSON.parse(await readFile(await download.path()));
  checks.heavyModel = report.poseModel.id === 'mediapipe-pose-landmarker-heavy';
  checks.labeledTiming = report.reps.length === labels.expectedCompleteReps && report.reps.every((rep, i) => Math.abs(rep.bottomMs - labels.bottomTimestampsMs[i]) <= labels.bottomToleranceMs);
  checks.twoUsableComparisons = report.reps.length === 2 && report.reps.every(rep => ['knee_flexion', 'rep_duration', 'torso_lean'].every(metric => report.measurements.some(m => m.repId === rep.id && m.metric === metric && m.quality === 'usable')));
  checks.comparisonVisible = await page.locator('.compare table').first().isVisible() && await page.getByRole('combobox', { name: 'Rep A', exact: true }).inputValue() !== await page.getByRole('combobox', { name: 'Rep B', exact: true }).inputValue();
  result.analysis = { model: report.poseModel, samples: report.frames.length, tracked: report.frames.filter(frame => frame.quality === 'usable').length, bottomTimestampsMs: report.reps.map(rep => rep.bottomMs), labeledBottomTimestampsMs: labels.bottomTimestampsMs, timingErrorMs: report.reps.map((rep, i) => Math.abs(rep.bottomMs - labels.bottomTimestampsMs[i])), toleranceMs: labels.bottomToleranceMs, measurements: report.measurements };
  result.developerPacket = { requested: optionalPacket, requiredForReadiness: false };
  if (optionalPacket) {
    await page.getByRole('button', { name: 'Preview coaching packet', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.packet .frames img')].filter(image => image.complete && image.naturalWidth > 0).length === 2, null, { timeout: 15_000 });
    result.developerPacket.decodedImages = await page.locator('.packet .frames img').count();
  }
  await page.getByText('Developer tools: report and coaching packet', { exact: true }).click();
  const trace = page.getByRole('img', { name: 'Knee flexion and torso lean over time', exact: true });
  checks.traceVisible = await trace.isVisible();
  checks.traceHasMetrics = await trace.locator('path').evaluateAll(paths => paths.length === 2 && paths.every(path => path.getAttribute('d')?.includes('L')));
  await page.getByRole('button', { name: `${report.reps[0].id} bottom @ ${report.reps[0].bottomMs} ms`, exact: true }).click();
  await page.waitForFunction(ms => Math.abs(document.querySelector('video').currentTime * 1000 - ms) < 2, report.reps[0].bottomMs);
  await page.waitForFunction(() => !!document.querySelector('.trace .playhead'));
  checks.repEvidenceSeek = true;
  const hasOverlay = () => page.locator('.stage canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  await page.waitForFunction(() => { const c = document.querySelector('.stage canvas'); return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i) => i % 4 === 3 && v > 0); });
  checks.overlayVisibleAtEvidence = await hasOverlay();
  await page.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('0.25');
  checks.playbackRate = await page.locator('video').evaluate(video => video.playbackRate === 0.25);
  await page.locator('h1').click();
  await page.keyboard.press('ArrowRight');
  const next = report.frames.find(frame => frame.timestampMs > report.reps[0].bottomMs).timestampMs;
  await page.waitForFunction(ms => Math.abs(document.querySelector('video').currentTime * 1000 - ms) < 2, next);
  checks.keyboardSampleStep = true;
  const box = await trace.boundingBox();
  const clickTime = report.frames[0].timestampMs + 0.7 * (report.frames.at(-1).timestampMs - report.frames[0].timestampMs);
  const nearest = report.frames.reduce((a,b) => Math.abs(b.timestampMs-clickTime)<Math.abs(a.timestampMs-clickTime)?b:a).timestampMs;
  await trace.click({ position: { x: box.width * 0.7, y: box.height * 0.5 } });
  await page.waitForFunction(ms => Math.abs(document.querySelector('video').currentTime * 1000 - ms) < 2, nearest);
  checks.traceClickSeek = true;
  // A replacement that fails to load must not keep the prior person's geometry.
  await page.route('**/assets/clear-squat-*.mp4', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Start coached squat', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Couldn’t load the built-in sample.' }).waitFor();
  checks.noStaleOverlayAfterReplacementFailure = !await hasOverlay();
  checks.noUnrequestedInterpretation = interpretationRequests === 0;
  checks.sameOriginAssets = origins.size === 0;
  checks.noPageErrors = errors.length === 0;
  result = { ...result, outcome: 'verified', readyForFinalQA: Object.values(checks).every(Boolean), interpretationRequests, externalOrigins: [...origins], errors,
    gaps: ['Actual connected-provider interpretation is verified separately.', 'Two clips with independent identities are not covered by this one-recording/two-rep gate.', 'Physical iPhone, venue network and final two Wren workflows remain separate release gates.', 'Timing and local geometry checks are not independent joint-angle accuracy validation.'] };
} catch (error) {
  result = { ...result, outcome: 'probe-error', error: error.message, readyForFinalQA: false };
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.httpServer.close(resolve));
  if (process.argv.includes('--write')) {
    const output = `${root}qa/product-readiness.json`;
    let previous;
    try { previous = await readFile(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous) {
      const old = JSON.parse(previous);
      const date = (old.testedAt ?? new Date().toISOString()).slice(0, 10);
      const name = `product-readiness-${date}-${(old.commit ?? 'unknown').slice(0, 7)}-${sha(previous).slice(0, 8)}.json`;
      await mkdir(`${root}qa/archive`, { recursive: true });
      try { await writeFile(`${root}qa/archive/${name}`, previous, { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      result.previousEvidenceArchive = `qa/archive/${name}`;
    }
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.readyForFinalQA) process.exitCode = 1;
}
