import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

test('live SVG keeps valid source angles, breaks missing/epoch/time gaps, bounds memory and stops cleanly', async () => {
  const source = await readFile(new URL('./live-chart.mjs', import.meta.url), 'utf8');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.fulfill({ contentType: route.request().url().endsWith('.mjs') ? 'text/javascript' : 'text/html', body: route.request().url().endsWith('.mjs') ? source : '<!doctype html><main id="chart"></main>' }));
    await page.goto('http://chart.test/'); await page.clock.install();
    await page.evaluate(async () => {
      const { createLiveChart } = await import('/live-chart.mjs');
      window.chart = createLiveChart(document.querySelector('#chart'));
      window.sample = (timestampMs, value = 100, epoch = 0) => ({ timestampMs, analysisEligible: true, viewGuard: { epoch, state: 'stable' }, metrics: { kneeFlexionDeg: value, hipFlexionDeg: value, torsoLeanDeg: value }, metricValidity: Object.fromEntries(['kneeFlexionDeg', 'hipFlexionDeg', 'torsoLeanDeg'].map(key => [key, { status: 'estimated' }])) });
      chart.push(sample(0)); chart.push(sample(100));
      chart.push(sample(200, null)); chart.push(sample(300));
      chart.push(sample(400, 80, 1)); chart.push(sample(2000, 70, 1));
      chart.push(sample(1900, 0)); // Regressed source time cannot rewrite the trace.
      chart.rep({ key: 'epoch1-rep', epoch: 1, rep: { bottomMs: 400 } });
      chart.rep({ key: 'epoch1-rep', epoch: 1, rep: { bottomMs: 400 } });
    });
    assert.match(await page.locator('#chart p').first().textContent(), /graph starts when tracking/);
    assert.equal(await page.locator('svg').isVisible(), false, 'Empty state has no large fake 0–1s plot');
    assert.ok((await page.locator('#chart').boundingBox()).height < 120, 'Empty chart stays compact');
    await page.clock.fastForward(250);
    await page.locator('.chart-metric-controls summary').click();
    await page.locator('[data-chart-metric="hipFlexionDeg"]').check();
    await page.locator('[data-chart-metric="torsoLeanDeg"]').check();
    await page.clock.fastForward(250);
    const path = await page.locator('[data-metric="kneeFlexionDeg"]').getAttribute('d');
    assert.equal((path.match(/M/g) ?? []).length, 4); assert.equal((path.match(/L/g) ?? []).length, 1);
    assert.equal(await page.locator('svg').getAttribute('data-rep-count'), '1');
    assert.match(await page.locator('#chart p').first().textContent(), /2.00 s.*70.0°/);
    await page.evaluate(() => {
      const missing = sample(2100); missing.metricValidity.kneeFlexionDeg.status = 'unavailable'; chart.push(missing);
    });
    await page.clock.fastForward(250);
    assert.match(await page.locator('#chart p').first().textContent(), /Knee bend: unavailable.*Hip hinge: 100.0°/);
    await page.evaluate(() => { for (let t = 2200; t < 100_000; t += 10) chart.push(sample(t)); });
    await page.clock.fastForward(250);
    assert.equal(await page.locator('svg').getAttribute('data-sample-count'), '450');
    assert.equal(await page.locator('svg').getAttribute('data-rep-count'), '0');
    assert.match(await page.locator('svg').textContent(), /70.0 s/);
    await page.evaluate(() => { chart.stop(); chart.push(sample(200000)); });
    assert.match(await page.locator('#chart p').first().textContent(), /Stopped · retained.*99.99 s/);
    await page.evaluate(() => { chart.reset(); chart.push(sample(0, 0)); });
    await page.clock.fastForward(250);
    assert.equal(await page.locator('svg').getAttribute('data-sample-count'), '1');
    assert.match(await page.locator('#chart p').first().textContent(), /Knee bend: 0.0°/);
    assert.match(await page.getByRole('img').getAttribute('aria-label'), /source time/);
    await page.evaluate(() => { const unknown = sample(100); unknown.viewGuard.state = 'reacquiring'; chart.push(unknown); });
    await page.clock.fastForward(250);
    assert.match(await page.locator('#chart p').first().textContent(), /Knee bend: unavailable.*Hip hinge: unavailable.*Chest angle: unavailable/);
    await page.evaluate(() => {
      window.completed = (key, bottom, knee, epoch = 0) => {
        const rep = { id: key, startMs: bottom - 100, bottomMs: bottom, endMs: bottom + 100 };
        return { key, epoch, rep, report: { reps: [rep], frames: [{ timestampMs: bottom, quality: 'usable' }], protocol: { id: 'squat-side', version: '1', side: 'left' }, poseModel: { id: 'heavy', version: '1' }, measurements: [
          { repId: key, metric: 'knee_flexion', unit: 'deg', quality: knee === null ? 'unavailable' : 'usable', value: knee, evidenceTimestampMs: bottom },
          { repId: key, metric: 'torso_lean', unit: 'deg', quality: 'usable', value: 35, evidenceTimestampMs: bottom },
          { repId: key, metric: 'rep_duration', unit: 'ms', quality: 'usable', value: 200, evidenceTimestampMs: bottom },
        ] } };
      };
      chart.reset(); chart.push(sample(1000));
      chart.rep(completed('first', 200, 110)); chart.rep(completed('second', 700, 120));
    });
    await page.clock.fastForward(250);
    const baseline = page.locator('[data-chart-baseline]');
    assert.match(await baseline.textContent(), /0.20 s.*0.70 s/);
    assert.match(await baseline.textContent(), /Bottom knee bend110.0°120.0°\+10.0°/);
    assert.match(await baseline.textContent(), /Duration0.20 s0.20 s0.00 s/);
    assert.equal(await page.locator('[data-rep-phase="descent"]').count(), 2);
    assert.equal(await page.locator('[data-rep-phase="return"]').count(), 2);
    assert.equal(await page.locator('.chart-rep-details li').count(), 2);
    assert.match(await page.locator('.chart-rep-summary').textContent(), /Knee bend 120.0°.*Down 0.10 s.*Return 0.10 s.*Total 0.20 s/);
    assert.match(await page.locator('.chart-window-label').textContent(), /Rolling 30-second.*saved session/);
    assert.equal(await page.locator('[data-practice-target]').getAttribute('data-practice-target'), '110');
    await page.evaluate(() => {
      const wrongEvidence = completed('third', 800, 130);
      wrongEvidence.report.measurements[0].evidenceTimestampMs = 799; chart.rep(wrongEvidence);
    });
    await page.clock.fastForward(250);
    assert.match(await baseline.textContent(), /Bottom knee bend110.0°UnavailableUnavailable/);
    await page.evaluate(() => { chart.push(sample(1100, 90, 1)); chart.rep(completed('old-epoch', 900, 180, 0)); });
    await page.clock.fastForward(250);
    assert.match(await baseline.textContent(), /Reference reset.*Complete a rep/);
    assert.equal(await baseline.locator('table').count(), 0);
    await page.evaluate(() => { chart.rep(completed('new-view', 1100, 95, 1)); });
    await page.clock.fastForward(250);
    assert.match(await baseline.textContent(), /Bottom knee bend95.0°95.0°0.0°/);
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(50); await page.clock.fastForward(250);
      const layout = await page.locator('svg').evaluate(svg => ({
        viewWidth: svg.viewBox.baseVal.width, containerWidth: svg.parentElement.clientWidth,
        width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height,
        text: [...svg.querySelectorAll('text')].map(node => ({
          fontPixels: Number(node.getAttribute('font-size')) * node.getScreenCTM().a,
          left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right,
        })),
      }));
      assert.equal(layout.viewWidth, layout.containerWidth);
      assert.equal(layout.height, 220);
      assert.equal(layout.width, layout.containerWidth);
      assert.ok(layout.text.every(label => label.fontPixels >= 10.9 && label.left >= 0 && label.right <= width));
      assert.ok(!(await page.locator('svg').textContent()).includes('form-quality'));
      assert.match(await page.locator('.chart-metric-controls > p').textContent(), /110° knee practice target, not a form-quality standard/);
    }
  } finally { await browser.close(); }
});
