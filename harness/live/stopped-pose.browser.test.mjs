// Real recorder/IndexedDB; controlled pose results and provider. No camera, account or GPU.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const realPose = process.env.REAL_STOPPED_POSE === '1';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({ configFile:new URL('../vite.config.mjs',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,strictPort:false,watch:null} });
let browser;
try {
  await server.listen();await server.watcher.close();browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}), errors=[];let sends=0;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/harness/live/motion/index.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export async function startLiveSquat(video,options){
    const report=await(await fetch('/harness/results/clear-squat.analysis-report.v1.json')).json();
    const metrics={kneeFlexionDeg:20,hipFlexionDeg:20,torsoLeanDeg:5,shinInclinationDeg:5,ankleClosureChangeDeg:0,hipDescentLegLengths:0,hipAboveKneeLegLengths:1};
    options.onSample({timestampMs:0,sourceMediaTimeMs:0,report,frame:report.frames[0],poseDisplayFrame:report.frames[0],metrics,metricValidity:Object.fromEntries(Object.keys(metrics).map(key=>[key,{status:'estimated',reason:'projected_side_estimate'}])),viewGuard:{epoch:0,state:'stable',reason:'stable-window'},analysisEligible:true,phase:'standing',feedback:{state:'tracking',label:'Controlled fixture'},trackingConfidence:1,processingLatencyMs:0,stats:{analyzedHz:10,processedFrames:1,droppedBusy:0}});
    window.emitRep=async()=>{const rep=report.reps[0],blob=await(await fetch('/harness/results/clear-squat-evidence/frame-1067ms.jpg')).blob();options.onRepComplete({key:'first-fixture-rep',epoch:0,rep,report,evidenceImages:[{phase:'bottom',timestampMs:rep.bottomMs,blob}],feedback:{state:'target-met',label:'Fixture'}});};return{stop(){}};
  }` }));
  await page.route('**/harness/history/index.mjs*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('export async function saveSession(input) {','export async function saveSession(input) { await new Promise(resolve=>setTimeout(resolve,700));')});});
  if (!realPose) await page.route('**/harness/history/pose-replay.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export async function prepareSavedPoseReplay(session,{signal,persist,onProgress}){
    window.poseCalls??=[];window.poseCalls.push({id:session.id,persist,bytes:session.video.size,hash:session.videoSha256});onProgress({stage:'analyzing',progress:.5});
    if(window.holdPose)await new Promise((resolve,reject)=>{window.releasePose=resolve;signal.addEventListener('abort',()=>{window.poseAborted=(window.poseAborted||0)+1;reject(new DOMException('Cancelled','AbortError'));},{once:true});});
    const report=await(await fetch('/harness/results/clear-squat.analysis-report.v1.json')).json();report.frames=report.frames.filter(frame=>frame.timestampMs<2000||frame.timestampMs>2500);return{report,cached:false,saveError:null};
  }` }));
  await page.route('**/api/connection',route=>route.fulfill({json:{state:'connected'}}));await page.route('**/api/models',route=>route.fulfill({json:[{id:'mock'}]}));
  await page.route('**/api/interpret',route=>{sends++;const packet=route.request().postDataJSON().packet,evidenceIds=[packet.evidence[0].id];return route.fulfill({json:{observations:[{text:'Saved fixture observation.',evidenceIds}],nextFocus:{text:'Keep the same camera position.',evidenceIds},uncertainty:'Controlled provider only.'}});});
  await page.addInitScript(()=>{window.poseCalls=[];navigator.mediaDevices.getUserMedia=async()=>{const video=document.createElement('video');video.src='/fixtures/squat/clear-squat.mp4';video.muted=true;video.loop=true;video.style.display='none';document.body.append(video);await video.play();const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const context=canvas.getContext('2d');let stream;const draw=()=>{if(stream?.getVideoTracks()[0].readyState==='ended'){video.pause();video.remove();return;}context.drawImage(video,0,0);requestAnimationFrame(draw);};draw();stream=canvas.captureStream(20);return stream;};});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);
  await page.getByRole('button',{name:'Not now',exact:true}).click();
  await page.locator('#start').click();await page.waitForFunction(()=>typeof window.emitRep==='function');await page.evaluate(()=>emitRep());
  await page.waitForFunction(()=>document.querySelector('#ai-feed').children.length===1);
  assert.equal(await page.locator('[data-replay-evidence]').first().isDisabled(),true,'AI timestamps never seek the active stream');
  await page.waitForTimeout(2800);await page.locator('#stop').click();
  await page.locator('#replay-pose-controls').waitFor();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>poseCalls.length),0,'Replay analysis waits for initial storage transaction');
  await page.waitForFunction(()=>document.querySelector('#replay-pose-controls').textContent.includes('Replay skeleton ready'));
  if (!realPose) { assert.equal((await page.evaluate(()=>poseCalls))[0].persist,true);assert.match((await page.evaluate(()=>poseCalls))[0].hash,/^[a-f0-9]{64}$/); }
  const buttons=page.locator('[data-replay-evidence]');assert.equal(await buttons.count(),2);assert.equal(await buttons.first().isEnabled(),true);
  await buttons.first().click();await page.waitForFunction(()=>document.querySelector('#overlay').dataset.replayTimestampMs!==undefined);
  const overlay=await page.evaluate(()=>{const video=document.querySelector('#video'),canvas=document.querySelector('#overlay');return{time:video.currentTime,frame:Number(canvas.dataset.replayTimestampMs),width:canvas.width,height:canvas.height,composite:canvas.getContext('2d').globalCompositeOperation,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((value,index)=>index%4===3&&value>0)};});
  assert.ok(overlay.pixels,JSON.stringify(overlay));assert.ok(Math.abs(overlay.frame-overlay.time*1000)<=100);assert.equal(sends,1);
  if (realPose) {
    const stored = await page.evaluate(async()=>{const api=await import('/harness/history/index.mjs');const rows=await api.listSessions();const session=await api.getSession(rows[0].id);return{hash:session.videoSha256,bytes:session.video.size,mimeType:session.video.type,reportClip:session.report.clip.id,frames:session.report.frames.length,usable:session.report.frames.filter(f=>f.quality==='usable').length,model:session.report.poseModel.id,reportDurationMs:session.report.clip.durationMs,recordedDurationMs:session.live.recording.durationMs};});
    assert.equal(stored.reportClip,`saved-pose:${stored.hash}`);assert.ok(stored.usable>5);assert.ok(stored.mimeType.includes('webm'));assert.deepEqual(errors,[]);
    const proof={passed:true,verifiedAtUtc:new Date().toISOString(),mode:'isolated source browser test',source:'public clear-squat fixture captured through real Chrome MediaRecorder',liveDetector:'controlled',replayPose:'actual MediaPipe Heavy',provider:'controlled; one completed-rep response, no account',stored,overlay,checks:['real WebM decoded','initial IDB save awaited','saved source hash binds replay report','Heavy produces usable pose frames','paused seek renders skeleton within 100 ms','AI evidence links available only after Stop','local replay analysis sends no additional AI requests']};
    await writeFile(new URL('../../qa/stopped-live-pose.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
  } else {
  await page.evaluate(()=>{const video=document.querySelector('#video');video.currentTime=2.2;});await page.waitForFunction(()=>!document.querySelector('#video').seeking);
  await page.waitForTimeout(50);assert.equal(await page.locator('#overlay').getAttribute('data-replay-timestamp-ms'),null,'Missing pose interval clears prior skeleton');
  assert.equal(await page.evaluate(()=>{const c=document.querySelector('#overlay');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);}),false);
  // Save-off uses the same real recorded bytes without an IDB write, and can be cancelled/retried.
  const savedCount=await page.evaluate(async()=> (await (await import('/harness/history/index.mjs')).listSessions()).length);
  await page.locator('#save-local').uncheck();await page.evaluate(()=>{window.holdPose=true;});await page.locator('#start').click();await page.waitForTimeout(1100);await page.locator('#stop').click();
  await page.waitForFunction(()=>poseCalls.length===2);assert.equal((await page.evaluate(()=>poseCalls))[1].persist,false);
  await page.getByRole('button',{name:'Cancel replay analysis',exact:true}).click();await page.getByRole('button',{name:'Retry replay analysis',exact:true}).waitFor();
  await page.evaluate(()=>{window.holdPose=false;});await page.getByRole('button',{name:'Retry replay analysis',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#replay-pose-controls').textContent.includes('Replay skeleton ready'));
  assert.equal(await page.evaluate(async()=> (await (await import('/harness/history/index.mjs')).listSessions()).length),savedCount);
  assert.equal(sends,1,'Replay preparation, seeking and retry never invoke AI');
  await page.evaluate(()=>{window.holdPose=true;});await page.locator('#start').click();await page.waitForTimeout(700);await page.locator('#stop').click();await page.waitForFunction(()=>poseCalls.length===4);
  const aborted=await page.evaluate(()=>window.poseAborted||0);await page.locator('#start').click();await page.waitForFunction(()=>window.poseAborted>0);
  assert.ok(await page.evaluate(()=>window.poseAborted)>aborted);assert.equal(await page.locator('#replay-pose-controls').count(),0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,realMediaRecorder:true,realIndexedDB:true,pose:'controlled stored fixture',initialSaveAwaited:true,saveOffNoHistory:true,sourceClockOverlay:true,gapsClear:true,aiEvidenceLinksAfterStopOnly:true,cancelRetry:true,newStartAborts:true,noReplayAI:true}));
  }
}finally{await browser?.close();await server.close();}
