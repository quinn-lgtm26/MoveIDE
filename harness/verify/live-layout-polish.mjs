// Layout-only probe: public video capture + stored fixture metrics + mocked coaching.
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile: new URL('../vite.config.mjs', import.meta.url).pathname, server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null } });
let browser, releaseSecond;
const result = { verifiedAtUtc: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), mode: 'isolated current-source Vite dev', captureMode: 'public clear-squat.mp4 via canvas.captureStream; replayed stored pose/metric callbacks; mock ChatGPT; no fresh Heavy inference, physical camera, account or phone', checks: {}, layouts: [], sourceHashes: {} };
for (const file of ['harness/live/app.css', 'harness/live/app.mjs', 'harness/live/motion/live-chart.mjs']) result.sourceHashes[file] = createHash('sha256').update(await readFile(new URL(`../../${file}`, import.meta.url))).digest('hex');
try {
  await server.listen(); await server.watcher.close();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/harness/live/motion/index.mjs*', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function startLiveSquat(video,options) {
      const report=await(await fetch('/harness/results/clear-squat.analysis-report.v1.json')).json();
      const trace=await(await fetch('/harness/results/clear-squat.motion-trace.v1.json')).json();
      const start=performance.now(); let processed=0;
      const tick=()=>{const time=Math.round(performance.now()-start),source=window.fixtureVideo.currentTime*1000;
        const i=report.frames.reduce((best,frame,index)=>Math.abs(frame.timestampMs-source)<Math.abs(report.frames[best].timestampMs-source)?index:best,0);
        const frame={...report.frames[i],timestampMs:time},metrics={...trace[i],timestampMs:time};
        options.onSample({timestampMs:time,sourceMediaTimeMs:time,report,frame,poseDisplayFrame:frame,metrics,
          metricValidity:Object.fromEntries(Object.keys(metrics).filter(key=>key.endsWith('Deg')||key.endsWith('Lengths')).map(key=>[key,{status:metrics[key]===null?'unavailable':'estimated',reason:'projected_side_estimate'}])),
          viewGuard:{epoch:0,state:'stable',reason:'stable-window'},analysisEligible:true,phase:'moving',trackingConfidence:.95,
          feedback:{state:'tracking',label:'Keep a steady side view and compare your own reps.'},processingLatencyMs:40,stats:{analyzedHz:10,processedFrames:++processed,droppedBusy:0}});
      };
      const timer=setInterval(tick,100);tick();
      window.emitFixtureRep=async(index)=>{const rep=report.reps[index];const blob=await(await fetch('/harness/results/clear-squat-evidence/frame-'+rep.bottomMs+'ms.jpg')).blob();options.onRepComplete({key:'fixture-'+rep.id,epoch:0,rep,report,evidenceImages:[{phase:'bottom',timestampMs:rep.bottomMs,blob}],feedback:{state:'target-met',label:'The chosen practice target was reached.'}});};
      return {stop(){clearInterval(timer);}};
    }` }));
  await page.route('**/api/connection', route => route.fulfill({ json: { state: 'connected' } }));
  await page.route('**/api/models', route => route.fulfill({ json: [{ id: 'layout-mock', label: 'Layout mock' }] }));
  let requests = 0;
  await page.route('**/api/interpret', async route => {
    requests++; const body = route.request().postDataJSON();
    if (requests === 2) await new Promise(resolve => { releaseSecond = resolve; });
    const evidenceIds = [body.packet.evidence[0].id];
    await route.fulfill({ json: { observations: [{ text: 'Your selected rep has a measured bottom position.', evidenceIds }], nextFocus: { text: 'Keep the same side-on camera position for the next rep.', evidenceIds }, uncertainty: 'Controlled layout test response; not a new AI assessment.' } }).catch(() => {});
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const source = document.createElement('video'); source.src = '/fixtures/squat/clear-squat.mp4'; source.loop = true; source.muted = true; source.style.display = 'none'; document.body.append(source); await source.play();
      const canvas = document.createElement('canvas'); canvas.width = source.videoWidth; canvas.height = source.videoHeight; const context = canvas.getContext('2d'); let stream;
      const draw = () => { if (stream?.getVideoTracks()[0]?.readyState === 'ended') { source.pause(); return; } context.drawImage(source, 0, 0, canvas.width, canvas.height); requestAnimationFrame(draw); };
      draw(); stream = canvas.captureStream(20); window.fixtureVideo = source; return stream;
    };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);
  await page.locator('#save-local').uncheck(); await page.locator('#start').click();
  await page.waitForFunction(() => typeof window.emitFixtureRep === 'function');
  await page.evaluate(() => window.emitFixtureRep(0));
  await page.waitForFunction(() => document.querySelector('#ai-feed').children.length === 1);
  await page.evaluate(() => window.emitFixtureRep(1));
  await page.waitForFunction(() => document.querySelector('#ai-queue [data-status="analyzing"]'), null, { timeout: 15_000 });
  result.checks.priorNoteRetainedDuringNextReview = await page.locator('#ai-feed > li').count() === 1;
  result.checks.graphPopulates = (await page.locator('[data-metric="kneeFlexionDeg"]').getAttribute('d')).includes('L');
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]) {
    await page.setViewportSize(viewport); await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(350);
    const layout = await page.evaluate(() => {
      const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height,bottom:r.bottom}; };
      return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,video:rect('.stage'),chart:rect('.live-trends'),svg:rect('#live-chart svg'),note:rect('#ai-feed > li'),axisPixels:[...document.querySelectorAll('#live-chart svg text')].map(node=>Number(node.getAttribute('font-size'))*node.getScreenCTM().a)};
    });
    layout.checks = { noHorizontalOverflow: layout.documentWidth <= viewport.width, videoAtLeast300px: layout.video.height >= 300, readableAxes: layout.axisPixels.every(size=>size>=10.5), chartStartsInLaptopViewport: viewport.width<1100 || layout.chart.top<viewport.height, priorNoteHasVisibleHeight: layout.note.height>0 };
    result.layouts.push(layout);
    const suffix = viewport.width === 390 ? 'mobile' : viewport.width === 1440 ? 'desktop' : 'laptop';
    await page.screenshot({ path: new URL(`../../qa/live-layout-${suffix}.png`, import.meta.url).pathname, fullPage:true });
  }
  result.checks.noBrowserErrors = errors.length === 0; result.browserErrors = errors;
  result.passed = Object.values(result.checks).every(Boolean) && result.layouts.every(layout=>Object.values(layout.checks).every(Boolean));
  await writeFile(new URL('../../qa/live-layout-polish.json', import.meta.url), `${JSON.stringify(result,null,2)}\n`);
  console.log(JSON.stringify(result));
  assert.equal(result.passed,true,'Live layout acceptance checks failed; see qa/live-layout-polish.json');
} finally { releaseSecond?.(); await browser?.close(); await server.close(); }
