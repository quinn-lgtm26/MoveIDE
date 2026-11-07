// Real public HTTPS + WebRTC + Heavy + connected ChatGPT, with a synthetic fixture camera.
// Failure evidence excludes pairing capabilities, images and full AI output.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
if (!process.argv.includes('--send-public-fixture')) throw new Error('Use --send-public-fixture to send fixture evidence to the connected plan.');
const sanitize = text => String(text).replace(/https?:\/\/\S+/g, '[URL redacted]').replace(/[a-f0-9]{32}/gi, '[room redacted]').slice(0,700);
const evidencePath = new URL('../../qa/phone-https.json', import.meta.url);
try {
 const previous = await readFile(evidencePath, 'utf8'); const record = JSON.parse(previous);
 if (record.status === 'failed') {
  const stamp = String(record.verifiedAtUtc ?? 'unknown').replace(/[^0-9TZ]/g, '');
  await writeFile(new URL(`../../qa/phone-https-failed-${stamp}.json`, import.meta.url), previous, {flag:'wx'}).catch(error => { if(error.code !== 'EEXIST') throw error; });
 }
} catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
const browser = await chromium.launch({channel:'chrome',args:['--autoplay-policy=no-user-gesture-required']});
let receiver, sender, failed;
const requests=[],providerResponses=[],errors=[],checkpoints=[],transportFailures=[],responseTasks=[];
const started=new Map();
const result={verifiedAtUtc:new Date().toISOString(),status:'running',publicHttps:true,phoneSignalling:'authenticated JSON long polling',video:'real WebRTC across two Chrome contexts',camera:'public fixture via synthetic MediaStream; physical iPhone NOT tested',poseModel:'Heavy',provider:'real connected ChatGPT',requests,providerResponses,checkpoints,transportFailures,errors,claimLimits:'Local processing only; not network end-to-end latency or angle ground truth'};
async function snapshot(){
 if(receiver&&!receiver.isClosed())result.receiver=await receiver.evaluate(()=>({status:document.querySelector('#status')?.textContent,error:document.querySelector('#error')?.textContent,ai:document.querySelector('#ai')?.textContent,repCount:document.querySelector('#count')?.textContent,aiCards:document.querySelector('#ai-feed')?.children.length??null,processing:document.querySelector('#latency')?.textContent,knee:document.querySelector('#knee')?.textContent,dimensions:window.qaDimensions??[]})).catch(()=>({unavailable:true}));
 if(sender&&!sender.isClosed())result.sender=await sender.evaluate(()=>({status:document.querySelector('#status')?.textContent,localCaptionPresent:Boolean(document.querySelector('#feedback')?.textContent),aiCaptionPresent:Boolean(document.querySelector('#ai-feedback')?.textContent),cameraCalls:window.qaCameraCalls??0,trackStates:window.qaStream?.getTracks().map(track=>track.readyState)??[]})).catch(()=>({unavailable:true}));
}
function watch(page){
 page.on('pageerror',error=>errors.push(sanitize(error.message)));
 page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/rooms/')&&response.status()>=400)transportFailures.push({route:path.replace(/\/rooms\/[^/]+/,'/rooms/<redacted>'),status:response.status()});});
}
try{
 receiver=await browser.newPage();watch(receiver);
 receiver.on('request',request=>{if(new URL(request.url()).pathname!=='/api/interpret')return;const {model,packet,images}=request.postDataJSON();started.set(request,Date.now());requests.push({model,repIds:packet.repIds,imageTimestampsMs:images.map(image=>image.timestampMs)});});
 receiver.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/api/interpret')providerResponses.push({route:'/api/interpret',failed:sanitize(request.failure()?.errorText??'aborted'),durationMs:started.has(request)?Date.now()-started.get(request):undefined});});
 receiver.on('response',response=>{const path=new URL(response.url()).pathname;if(!['/api/connection','/api/models','/api/interpret'].includes(path))return;responseTasks.push((async()=>{const body=await response.json().catch(()=>null);providerResponses.push({route:path,status:response.status(),durationMs:started.has(response.request())?Date.now()-started.get(response.request()):undefined,state:body?.state,error:body?.error,observationCount:Array.isArray(body?.observations)?body.observations.length:undefined,nextFocusLength:typeof body?.nextFocus?.text==='string'?body.nextFocus.text.length:undefined});})());});
 await receiver.goto('http://127.0.0.1:4173/harness/live/');await receiver.evaluate(()=>{window.qaDimensions=[];const video=document.querySelector('#video');video.addEventListener('resize',()=>{if(window.qaDimensions.length<16)window.qaDimensions.push({width:video.videoWidth,height:video.videoHeight,atMs:Math.round(performance.now())});});});await receiver.locator('#source').selectOption('phone');await receiver.locator('#start').click();
 await receiver.waitForFunction(()=>document.querySelector('#phone-url').value.startsWith('https:'));
 const url=await receiver.locator('#phone-url').inputValue();checkpoints.push('private receiver created HTTPS phone pairing');
 sender=await browser.newPage();watch(sender);
 const fixture=await readFile(new URL('../../fixtures/squat/clear-squat.mp4',import.meta.url));
 await sender.route('**/qa-fixture.mp4',route=>route.fulfill({body:fixture,contentType:'video/mp4'}));
 await sender.addInitScript(()=>{window.qaCameraCalls=0;navigator.mediaDevices.getUserMedia=async constraints=>{window.qaCameraCalls++;if(constraints.audio!==false)throw new Error('Unexpected microphone permission');const video=document.createElement('video');video.src='/qa-fixture.mp4';video.loop=true;video.muted=true;video.style.display='none';document.body.append(video);await video.play();window.qaStream=video.captureStream();return window.qaStream;};});
 await sender.goto(url);assert.equal(await sender.evaluate(()=>window.qaCameraCalls),0);await sender.locator('#start').click();
 await receiver.waitForFunction(()=>document.querySelector('#knee').textContent!=='—',null,{timeout:60000});checkpoints.push('public phone video reached Heavy receiver with valid metric');
 await sender.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('projected knee'),null,{timeout:30000});checkpoints.push('local feedback returned over RTC to HTTPS phone');
 await Promise.race([sender.waitForFunction(()=>document.querySelector('#ai-feedback').textContent.includes('AI'),null,{timeout:150000}),receiver.waitForFunction(()=>document.querySelector('#stop').hidden||Boolean(document.querySelector('#error').textContent),null,{timeout:151000}).then(async()=>{throw new Error('Receiver stopped before AI review: '+await receiver.locator('#error').textContent());})]);checkpoints.push('AI review returned over RTC to HTTPS phone');
 assert.ok(requests.length>=1&&requests.length<=6);result.returnedAICueVisible=true;await snapshot();
 await receiver.locator('#stop').click();await sender.waitForFunction(()=>window.qaStream.getTracks().every(track=>track.readyState==='ended')&&document.querySelector('#ai-feedback').textContent==='',null,{timeout:15000});result.stopClearedTracksAndFeedback=true;assert.deepEqual(errors,[]);result.status='passed';
}catch(error){failed=error;result.status='failed';result.failure=sanitize(error.message);await snapshot();}
finally{
 if(receiver&&!receiver.isClosed())await receiver.locator('#stop').click({timeout:1000}).catch(()=>{});
 await Promise.allSettled(responseTasks);await writeFile(new URL('../../qa/phone-https.json',import.meta.url),JSON.stringify(result,null,2)+'\n');await browser.close();console.log(JSON.stringify(result,null,2));
}
if(failed)process.exitCode=1;
