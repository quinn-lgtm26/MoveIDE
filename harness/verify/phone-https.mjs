// Real public HTTPS signalling + local WebRTC + Heavy + real connected ChatGPT.
// The camera is a public fixture, not a physical iPhone. Pairing capabilities are never logged.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
if (!process.argv.includes('--send-public-fixture')) throw new Error('Use --send-public-fixture to send fixture evidence to the connected plan.');
const browser = await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
try {
 const receiver = await browser.newPage();
 const errors=[], sends=[];
 receiver.on('pageerror',e=>errors.push(e.message));
 receiver.on('request',request=>{if(new URL(request.url()).pathname==='/api/interpret'){const {model,packet,images}=request.postDataJSON();sends.push({model,repIds:packet.repIds,imageTimestampsMs:images.map(x=>x.timestampMs)});}});
 await receiver.goto('http://127.0.0.1:4173/harness/live/');
 await receiver.locator('#source').selectOption('phone');
 await receiver.locator('#start').click();
 await receiver.waitForFunction(()=>document.querySelector('#phone-url').value.startsWith('https:'));
 const url=await receiver.locator('#phone-url').inputValue();
 const sender=await browser.newPage();
 sender.on('pageerror',e=>errors.push(e.message));
 const fixture=await readFile(new URL('../../fixtures/squat/clear-squat.mp4',import.meta.url));
 await sender.route('**/qa-fixture.mp4',route=>route.fulfill({body:fixture,contentType:'video/mp4'}));
 await sender.addInitScript(()=>{
  navigator.mediaDevices.getUserMedia=async constraints=>{
   if(constraints.audio!==false) throw new Error('Unexpected microphone permission');
   const video=document.createElement('video');video.src='/qa-fixture.mp4';video.loop=true;video.muted=true;video.style.display='none';document.body.append(video);await video.play();window.qaStream=video.captureStream();return window.qaStream;
  };
 });
 await sender.goto(url);
 await sender.locator('#start').click();
 await receiver.waitForFunction(()=>document.querySelector('#knee').textContent!=='—',null,{timeout:60000});
 await sender.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('projected knee'),null,{timeout:30000});
 await sender.waitForFunction(()=>document.querySelector('#ai-feedback').textContent.includes('AI'),null,{timeout:150000});
 assert(sends.length>=1&&sends.length<=6);
 const cue=await sender.locator('#ai-feedback').textContent();
 const performanceText=await receiver.locator('#latency').textContent();
 const result={verifiedAtUtc:new Date().toISOString(),publicHttps:true,phoneSignalling:'authenticated JSON long polling',video:'real WebRTC across two Chrome contexts',camera:'public fixture via synthetic MediaStream; physical iPhone NOT tested',poseModel:'Heavy',provider:'real connected ChatGPT',requests:sends,returnedAICueVisible:cue.length>0,localPerformance:performanceText,claimLimits:'Local processing only; not network end-to-end latency or angle ground truth'};
 await receiver.locator('#stop').click();
 await sender.waitForFunction(()=>window.qaStream.getTracks().every(t=>t.readyState==='ended')&&document.querySelector('#ai-feedback').textContent==='',null,{timeout:15000});
 result.stopClearedTracksAndFeedback=true;assert.deepEqual(errors,[]);
 await writeFile(new URL('../../qa/phone-https.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
