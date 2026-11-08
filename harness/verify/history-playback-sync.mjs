import {chromium} from 'playwright';
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=await createServer({root,configFile:`${root}/vite.config.ts`,server:{host:'127.0.0.1',port:4189,strictPort:true}});
await server.listen(); await server.watcher.close();
const browser=await chromium.launch({channel:'chrome'});
const out={verifiedAtUtc:new Date().toISOString(),scope:'Seeded local live-history sessions with existing fixture video. Tests approximate replay mapping and UI only; no camera, Heavy or AI inference.',checks:{},errors:[]};
let requests=0;
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',e=>out.errors.push(e.message));
 await page.routeWebSocket('**',s=>s.close());
 await page.route('**/api/**',r=>{if(r.request().url().endsWith('/interpret'))requests++;return r.fulfill({json:{state:'disconnected'}});});
 await page.goto('http://127.0.0.1:4189');
 const ids=await page.evaluate(async()=>{
  const h=await import('/harness/history/index.mjs'); const video=await(await fetch('/fixtures/squat/clear-squat.mp4')).blob();
  const make=async(mapping)=>{const id=h.createSessionId();await h.saveSession({id,kind:'live',title:mapping?'Mapped live replay':'Unmapped live replay',video,live:{
   samples:[0,250,500,750,1000,1250,1500,1750,2750].map(timestampMs=>({timestampMs,viewEpoch:timestampMs<1000?0:1,phase:'moving',analysisEligible:true,metrics:{kneeFlexionDeg:timestampMs/10,hipFlexionDeg:80,torsoLeanDeg:30},metricValidity:{kneeFlexionDeg:{status:timestampMs===500?'unavailable':'estimated',reason:timestampMs===500?'low_visibility':'side_projection'}}})),
   reps:[{id:'rep-1',startMs:0,bottomMs:250,endMs:750,viewEpoch:0}],notes:[],
   timing:{alignment:'approximate',firstSampleMapping:mapping?{analysisTimestampMs:0,recordingElapsedMs:1000,sourceMediaTimeMs:90000}:null},recording:{durationMs:3800}
  }});return id;};return {mapped:await make(true),unmapped:await make(false)};
 });
 await page.goto(`http://127.0.0.1:4189/?session=${ids.mapped}`);
 const replay=page.getByRole('region',{name:'Saved live session'}),video=replay.locator('video'),inspector=replay.getByRole('region',{name:'Saved measurement inspector'});
 await page.waitForFunction(()=>Math.abs(document.querySelector('.saved-live video')?.currentTime-1.25)<.03);
 assert.match(await inspector.innerText(),/Original analysis 0.25s/);out.checks.opensNearFirstCompletedRepWithNonzeroOffset=true;
 const seek=async time=>{await video.evaluate((v,t)=>{v.pause();v.currentTime=t;},time);await page.waitForTimeout(150);};
 await seek(2);assert.match(await inspector.innerText(),/Original analysis 1.00s · view 2/);out.checks.nativeSeekFollowsMappedSamples=true;
 await seek(1);await video.evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('.saved-live video').currentTime>1.22);await video.evaluate(v=>v.pause());assert.match(await inspector.innerText(),/Original analysis 0.25s/);out.checks.playbackAdvancesMeasurement=true;
 await seek(1.5);assert.equal(await inspector.locator('.replay-metric-strip strong').first().innerText(),'—');assert.match(await inspector.innerText(),/low visibility/);out.checks.invalidMetricNotRevived=true;
 await seek(1.875);assert.match(await inspector.innerText(),/No saved measurement near this video moment/);out.checks.epochTransitionWithheld=true;
 await seek(3.2);assert.match(await inspector.innerText(),/No saved measurement near this video moment/);out.checks.largeCaptureGapWithheld=true;
 await seek(.9);assert.match(await inspector.innerText(),/No saved measurement near this video moment/);out.checks.beforeAnalysisStartsWithheld=true;
 await seek(1.25);await inspector.getByRole('button',{name:'Next moment',exact:true}).click();assert.ok(Math.abs(await video.evaluate(v=>v.currentTime)-1.5)<.03);assert.match(await inspector.innerText(),/Original analysis 0.50s/);out.checks.measurementNavigationSeeksVideo=true;
 assert.equal(await replay.locator('canvas').count(),0);assert.match(await replay.innerText(),/alignment is approximate/);assert.match(await replay.innerText(),/No AI review was saved/);out.checks.noInventedOverlayOrAI=true;
 await page.goto(`http://127.0.0.1:4189/?session=${ids.unmapped}`);await replay.getByRole('heading',{name:'Unmapped live replay'}).waitFor();await page.waitForTimeout(100);
 assert.match(await inspector.innerText(),/Independent saved-sample inspection/);await inspector.getByRole('button',{name:'Next moment',exact:true}).click();assert.equal(await video.evaluate(v=>v.currentTime),0);assert.match(await inspector.innerText(),/Original analysis 0.25s/);out.checks.missingMappingStaysIndependent=true;
 await video.evaluate(v=>{v.currentTime=1;});await page.waitForTimeout(100);assert.match(await inspector.innerText(),/No saved measurement near this video moment/);out.checks.unmappedPlaybackDoesNotInventAssociation=true;
 assert.equal(requests,0);assert.deepEqual(out.errors,[]);out.checks.noProviderRequestsOrPageErrors=true;out.status='passed';
} catch(error){out.status='failed';out.failure=error.stack;throw error;}
finally{await writeFile(`${root}/qa/history-playback-sync.json`,JSON.stringify(out,null,2)+'\n');await browser.close();await server.close();console.log(JSON.stringify(out));}
