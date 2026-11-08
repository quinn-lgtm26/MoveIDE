import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const server = await createServer({configFile:new URL('../vite.config.mjs',import.meta.url).pathname,server:{host:'127.0.0.1',port:0,strictPort:false,watch:null}});
let browser;
try {
 await server.listen();await server.watcher.close();browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage();const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/harness/live/motion/index.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export async function startLiveSquat(video,options){ window.emitRep=async(index)=>{const report=await(await fetch('/harness/results/clear-squat.analysis-report.v1.json')).json(); const rep=report.reps[index]; const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg'));const evidenceImages=report.frames.filter(frame=>frame.timestampMs>=rep.startMs&&frame.timestampMs<=rep.endMs).map(frame=>({timestampMs:frame.timestampMs,phase:frame.timestampMs===rep.bottomMs?'bottom':frame.timestampMs<rep.bottomMs?'descent':'ascent',blob}));options.onRepComplete({key:'view0-'+rep.id,epoch:0,rep,report,evidenceImages:[...evidenceImages.filter(image=>image.timestampMs===rep.bottomMs),...evidenceImages.filter(image=>image.timestampMs!==rep.bottomMs)].slice(0,3),feedback:{state:'target-met',label:'Fixture target'}});};return {stop(){}};}` }));
 await page.route('**/harness/history/index.mjs*',async route=>{const response=await route.fetch();const text=await response.text();await route.fulfill({response,body:text.replace('export async function saveSession(input) {', 'export async function saveSession(input) { await new Promise(resolve => setTimeout(resolve, 1000));')});});
 await page.route('**/api/connection',route=>route.fulfill({json:{state:'connected'}}));await page.route('**/api/models',route=>route.fulfill({json:[{id:'mock',label:'Mock'}]}));
 await page.route('**/api/interpret',async route=>{const body=route.request().postDataJSON();let release;const held=new Promise(resolve=>release=resolve);requests.push({body,release,at:Date.now()});await held;const evidenceIds=[body.packet.evidence[0].id];await route.fulfill({json:{observations:[{text:'Measured fixture rep.',evidenceIds}],nextFocus:{text:'Keep the same camera position.',evidenceIds},uncertainty:'Mock provider only.'}}).catch(()=>{});});
 await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const context=canvas.getContext('2d');let frame=0;const stream=canvas.captureStream(20);const timer=setInterval(()=>{if(stream.getVideoTracks()[0].readyState==='ended'){clearInterval(timer);return;}context.fillStyle=frame++%2?'green':'blue';context.fillRect(0,0,160,120);},50);window.testStream=stream;return stream;};});
 const waitRequest=async count=>{const deadline=Date.now()+15000;while(requests.length<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(requests.length>=count,`Request ${count} dispatched`);};
 const stored=()=>page.evaluate(async()=>{const {getSession}=await import('/harness/history/index.mjs');const link=document.querySelector('#saved-sessions a');return link?getSession(new URL(link.href).searchParams.get('session')):null;});
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/harness/live/`);await page.locator('#start').click();await page.waitForFunction(()=>typeof window.emitRep==='function');
 await page.evaluate(()=>window.emitRep(0));await waitRequest(1);await page.evaluate(()=>window.emitRep(1));
 assert.equal(await page.locator('#ai-queue [data-status=queued]').count(),1);await page.locator('#stop').click();
 assert.equal(await page.evaluate(()=>window.testStream.getTracks().every(track=>track.readyState==='ended')),true);
 await page.waitForTimeout(100); requests[0].release(); // Reply arrives while the initial IDB save is deliberately delayed.
 await page.waitForFunction(()=>document.querySelector('#ai-feed').children.length===1);
 await page.locator('#saved-sessions a').waitFor();assert.equal(await page.locator('#saved-sessions a').getAttribute('target'),'_blank');
 await page.waitForFunction(async()=>{const {getSession}=await import('/harness/history/index.mjs');const id=new URL(document.querySelector('#saved-sessions a').href).searchParams.get('session');return (await getSession(id)).live.notes.length===1;});
 let saved=await stored();assert.deepEqual(saved.live.repReviews.map(item=>item.state),['ready','queued']);
 await waitRequest(2);
 assert.ok(requests[1].at-requests[0].at>=7900,'Provider dispatches are at least eight seconds apart');
 assert.equal(await page.locator('#ai-feed > li').count(),1,'Last accepted note remains while next rep loads');assert.equal(await page.locator('#ai-queue [data-status=ready]').count(),0,'Accepted cards replace duplicate ready progress rows');assert.match(await page.locator('#ai').innerText(),/1 review ready/);requests[1].release();
 await page.waitForFunction(()=>document.querySelector('#ai-feed').children.length===2);
 await page.waitForFunction(async()=>{const {getSession}=await import('/harness/history/index.mjs');const id=new URL(document.querySelector('#saved-sessions a').href).searchParams.get('session');const saved=await getSession(id);return saved.live.notes.length===2&&saved.live.repReviews.every(item=>item.state==='ready');});
 saved=await stored();assert.equal(saved.live.notes.length,2);assert.ok(saved.evidenceImages.length>0);assert.equal(await page.locator('#saved-sessions a').getAttribute('target'),null);
 // A new source generation cancels pending reviews, even after its camera has stopped.
 await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Live');await page.evaluate(()=>window.emitRep(0));await waitRequest(3);await page.evaluate(()=>window.emitRep(1));await page.locator('#stop').click();
 await page.waitForFunction(()=>document.querySelectorAll('#saved-sessions a').length===2);
 const cancelledId=await page.locator('#saved-sessions a').first().getAttribute('href');await page.locator('#start').click();requests[2].release();
 await page.waitForFunction(async href=>{const {getSession}=await import('/harness/history/index.mjs');const saved=await getSession(new URL(href,location.href).searchParams.get('session'));return saved.live.repReviews.every(item=>item.state==='cancelled')&&saved.live.notes.length===0;},cancelledId);
 assert.equal(await page.locator('#ai-feed > li').count(),0);assert.equal(requests.length,3,'Cancelled queued work never dispatches');await page.locator('#stop').click();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'passed',usesHeavy:false,realIndexedDB:true,realMediaRecorder:true,stopDrainsFIFO:true,eightSecondDispatchSpacing:true,lateResultsEnrichSavedSession:true,delayedInitialSaveCoalescesResult:true,newStartCancelsOldQueue:true,priorNoteRetained:true,linksPreserveOriginTab:true}));
}finally{await browser?.close();await server.close();}
