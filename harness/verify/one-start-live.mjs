import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel:'chrome'});
try {
  const page = await browser.newPage({viewport:{width:1280,height:960}});
  const calls = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname !== '/api/interpret') return;
    const {model,packet,images} = request.postDataJSON();
    calls.push({model,measurementIds:packet.measurements.map(x=>x.id),imageTimestampsMs:images.map(x=>x.timestampMs)});
  });
  await page.goto('http://127.0.0.1:4173/harness/smoke/');
  await page.waitForFunction(()=>document.querySelector('#connection').textContent==='Using ChatGPT plan');
  await page.getByRole('button',{name:'Start coached squat',exact:true}).click();
  await page.waitForFunction(()=>/AI analysis ready|AI analysis could not complete/.test(document.querySelector('#coaching-status').textContent),null,{timeout:150000});
  const status = await page.locator('#coaching-status').textContent();
  assert.match(status,/AI analysis ready/, status);
  assert.equal(calls.length,1);
  const response = JSON.parse(await page.locator('#coaching').textContent());
  const evidence = {verifiedAtUtc:new Date().toISOString(),fixture:'clear-squat.mp4',poseModel:'mediapipe-pose-landmarker-heavy',workflow:'single Start: real Heavy + exact source JPEGs + real ChatGPT + playback cues',requests:calls,observationEvidenceIds:response.observations.map(x=>x.evidenceIds),nextFocusEvidenceIds:response.nextFocus.evidenceIds};
  await page.locator('#clip').evaluate(v=>{v.pause();v.currentTime=1.0675;});
  await page.locator('#cue-history > li').first().waitFor({state:'visible'});
  await page.screenshot({path:'qa/one-start-heavy-live.png',fullPage:true});
  await writeFile('qa/one-start-heavy-live.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
} finally {await browser.close();}
