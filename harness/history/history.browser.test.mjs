import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../../', import.meta.url));
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Isolated history verification</title>'); return; }
    if (pathname === '/fixture.mp4') { response.setHeader('Content-Type', 'video/mp4'); response.end(await readFile(resolve(root, 'fixtures/squat/clear-squat.mp4'))); return; }
    if (pathname === '/report.json') { response.setHeader('Content-Type', 'application/json'); response.end(await readFile(resolve(root, 'harness/results/clear-squat.analysis-report.v1.json'))); return; }
    const path = resolve(root, `.${pathname}`);
    if (!path.startsWith(`${root}harness/`) || !path.endsWith('.mjs') || !/^\/harness\/(history|coaching|motion)\//.test(pathname)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const checks = {};
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage(); const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); externalRequests.push('blocked external request'); return route.abort(); });
  await page.goto(origin);
  const created = await page.evaluate(async () => {
    const history = await import('/harness/history/index.mjs');
    const report = await (await fetch('/report.json')).json();
    const video = await (await fetch('/fixture.mp4')).blob();
    const session = await history.saveSession({ id: 'recorded-original', kind: 'recorded', title: 'Original squat', video, report, metadata: { videoName: 'clear-squat.mp4' } });
    return { id: session.id, hash: session.videoSha256, bytes: session.video.size, revision: session.revision, repCount: session.repCount };
  });
  assert.equal(created.revision, 1); assert.equal(created.repCount, 2); assert.match(created.hash, /^[a-f0-9]{64}$/);
  await page.reload();
  const restored = await page.evaluate(async () => {
    const history = await import('/harness/history/index.mjs');
    const session = await history.getSession('recorded-original'), summaries = await history.listSessions();
    const player = document.createElement('video'); player.muted = true; player.src = URL.createObjectURL(session.video); document.body.append(player);
    await new Promise((resolve, reject) => { player.onloadedmetadata = resolve; player.onerror = reject; });
    const replay = { width: player.videoWidth, duration: player.duration }; URL.revokeObjectURL(player.src); player.remove();
    return { hash: session.videoSha256, bytes: session.video.size, reportClip: session.report.clip.id, summaries, replay };
  });
  assert.equal(restored.hash, created.hash); assert.equal(restored.bytes, created.bytes); assert.equal(restored.reportClip, 'clear-squat');
  assert.equal(restored.replay.width, 810); assert.equal(restored.replay.duration, 3.8);
  assert.equal(Object.hasOwn(restored.summaries[0], 'video'), false); checks.reloadPreservesOriginalVideoReportAndReplay = true;
  const patched = await page.evaluate(async () => {
    const h = await import('/harness/history/index.mjs');
    await Promise.all([h.saveSession({ id: 'recorded-original', title: 'Updated title' }), h.saveSession({ id: 'recorded-original', metadata: { note: 'atomic patch' } })]);
    const current = await h.getSession('recorded-original');
    let conflict; try { await h.saveSession({ id: current.id, title: 'stale update', expectedRevision: 1 }); } catch (error) { conflict = error.code; }
    const exported = h.exportSessionData(current);
    return { title: current.title, note: current.metadata.note, hash: current.videoSha256, revision: current.revision, conflict, exportHasBlob: exported.video instanceof Blob, exported };
  });
  assert.equal(patched.title, 'Updated title'); assert.equal(patched.note, 'atomic patch'); assert.equal(patched.revision, 3); assert.equal(patched.hash, created.hash); assert.equal(patched.conflict, 'conflict'); assert.equal(patched.exportHasBlob, false);
  assert.equal(patched.exported.video.sha256, created.hash); checks.atomicPatchesPreserveVideoAndRejectStaleRevision = true; checks.jsonExportSeparatesBinaryAssets = true;
  const immutable = await page.evaluate(async () => {
    const h = await import('/harness/history/index.mjs'), codes = [];
    for (const video of [new Blob(['different recording'], {type:'video/mp4'}), null]) {
      try { await h.saveSession({id:'recorded-original',video}); } catch(error) { codes.push(error.code); }
    }
    const before=await h.getSession('recorded-original');
    for(const report of [null,{...before.report,clip:{...before.report.clip,id:'different-analysis'}}]) {
      try {await h.saveSession({id:before.id,report})}catch(error){codes.push(error.code)}
    }
    const identical=await h.saveSession({id:before.id,video:before.video});
    return {codes,hash:identical.videoSha256,revision:identical.revision};
  });
  assert.deepEqual(immutable.codes,['source_changed','source_changed','source_changed','source_changed']); assert.equal(immutable.hash,created.hash); assert.equal(immutable.revision,4);
  checks.savedVideoAndReportIdentityIsImmutable = true;
  const boundaries = await page.evaluate(async () => {
    const h = await import('/harness/history/index.mjs'); const codes = {};
    const tooLarge = new Blob(['small mock']); Object.defineProperty(tooLarge, 'size', { value: h.HISTORY_LIMITS.videoBytes + 1 });
    for (const [key, patch] of Object.entries({ video: {video:tooLarge}, report:{report:{schemaVersion:1}}, samples:{live:{samples:Array(10001).fill(null),notes:[],timing:{}}}, credentials:{metadata:{accessToken:'must not persist'}} })) {
      try { await h.saveSession({id:'blocked-'+key,kind:'live',title:'Rejected',...patch}); } catch(error) { codes[key]=error.code; }
    }
    const oldPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value,...args){ if(this.name==='assets') throw new DOMException('Simulated full storage','QuotaExceededError');return oldPut.call(this,value,...args); };
    try { await h.saveSession({ id: 'recorded-original', title: 'must roll back', evidenceImages:[] }); } catch(error) { codes.quota=error.code; }
    finally { IDBObjectStore.prototype.put=oldPut; }
    const after=await h.getSession('recorded-original');
    return {codes,title:after.title,hash:after.videoSha256,revision:after.revision,summaries:await h.listSessions()};
  });
  assert.equal(boundaries.codes.video, 'limit_exceeded'); assert.equal(boundaries.codes.report, 'invalid_input'); assert.equal(boundaries.codes.samples, 'limit_exceeded'); assert.equal(boundaries.codes.credentials, 'invalid_input'); assert.equal(boundaries.codes.quota, 'quota_exceeded');
  assert.equal(boundaries.title, 'Updated title'); assert.equal(boundaries.hash, created.hash); assert.equal(boundaries.revision, 4); assert.equal(boundaries.summaries.length, 1);
  checks.applicationLimitsAndSimulatedQuotaRollback = true;
  const appCap=await page.evaluate(async()=>{
    const h=await import('/harness/history/index.mjs');
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('moveide-history-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const previous=(await h.storageStatus()).appBytes;
    const account=bytes=>new Promise((resolve,reject)=>{const tx=db.transaction('accounting','readwrite');tx.objectStore('accounting').put({id:'storage',bytes});tx.oncomplete=resolve;tx.onerror=reject;});
    await account(h.HISTORY_LIMITS.appBytes);
    let code;try{await h.saveSession({id:'over-app-cap',kind:'live',title:'Must not evict'})}catch(error){code=error.code}
    finally{await account(previous);db.close();}
    return {code,count:(await h.listSessions()).length,bytes:(await h.storageStatus()).appBytes,previous};
  });
  assert.equal(appCap.code,'limit_exceeded');assert.equal(appCap.count,1);assert.equal(appCap.bytes,appCap.previous);checks.simulatedAppCapRejectsWithoutEviction=true;
  const coaching=await page.evaluate(async()=>{
    const h=await import('/harness/history/index.mjs'),{buildCoachPacket}=await import('/harness/coaching/packet.mjs'),{getCoachingSegments}=await import('/harness/coaching/playback.mjs');
    const session=await h.getSession('recorded-original'),packet=buildCoachPacket(session.report);
    const cite={text:'Review this recorded bottom.',evidenceIds:[packet.measurements[0].id]};
    const response={observations:[cite],nextFocus: cite,uncertainty:'Projected angles are estimates.'};
    const segments=getCoachingSegments(response,packet,session.report),codes=[];
    const altered=structuredClone(packet);altered.measurements[0].value+=1;
    for(const value of [{packet:altered,response,segments},{packet,response,segments:[]}]) {
      try{await h.saveSession({id:session.id,coaching:value})}catch(error){codes.push(error.code)}
    }
    await h.saveSession({id:session.id,coaching:{packet,response,segments}});
    return {codes,count:(await h.getSession(session.id)).coaching.segments.length};
  });
  assert.deepEqual(coaching.codes,['invalid_input','invalid_input']);assert.ok(coaching.count>0);
  checks.coachingMustMatchSavedReportAndDerivedSegments=true;
  const live = await page.evaluate(async () => {
    const h = await import('/harness/history/index.mjs');
    const jpeg = new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'});
    const session=await h.saveSession({id:'live-session',kind:'live',title:'Live motion',video:null,live:{samples:[{timestampMs:12,kneeFlexionDeg:90}],notes:[{text:'accepted local note'}],timing:{alignment:'approximate'},reps:[],recording:{durationMs:1234}},evidenceImages:[{timestampMs:12,phase:'bottom',repKey:'rep-1',viewEpoch:0,blob:jpeg}],metadata:{model:'MediaPipe Heavy'}});
    const reopened=await h.getSession(session.id),status=await h.storageStatus();
    return {images:reopened.evidenceImages.length,imageHash:reopened.evidenceImages[0].imageSha256,samples:reopened.live.samples.length,duration:reopened.durationMs,model:reopened.model,available:status.available,appBytes:status.appBytes};
  });
  assert.equal(live.images, 1); assert.match(live.imageHash, /^[a-f0-9]{64}$/); assert.equal(live.samples, 1); assert.equal(live.duration, 1234); assert.equal(live.available, true); assert.ok(live.appBytes > created.bytes);
  checks.liveDataAndEvidenceAssetsPersist = true;
  const enrichment=await page.evaluate(async()=>{
    const h=await import('/harness/history/index.mjs');
    const before=await h.getSession('live-session');
    const review={repKey:'view-0-rep-1',repId:'rep-1',viewEpoch:0,timestampMs:12,state:'ready',message:'Review ready',updatedAt:Date.now()};
    const updatedLive={...before.live,notes:[...before.live.notes,{text:'Late accepted review',timestampMs:12}],repReviews:[review],coachingStatus:{state:'accepted',sent:1,accepted:1,skipped:0}};
    await Promise.all([h.patchSession({id:before.id,live:updatedLive}),h.saveSession({id:before.id,title:'Renamed while AI finished'})]);
    const after=await h.getSession(before.id);
    const reviewErrors=[];
    for(const repReviews of [[review,review],[{...review,state:'made-up-state'}],Array(151).fill(review)]){
      try{await h.patchSession({id:before.id,live:{...updatedLive,repReviews}})}catch(error){reviewErrors.push(error.code)}
    }
    let conflict;try{await h.patchSession({id:before.id,live:before.live,expectedRevision:before.revision});}catch(error){conflict=error.code}
    await h.saveSession({id:'late-delete',kind:'live',title:'To delete',live:{samples:[],notes:[],timing:{}}});
    // Queue deletion first. Even a patch carrying enough initial fields cannot recreate the row.
    const deletion=h.deleteSession('late-delete');
    const late=h.patchSession({id:'late-delete',kind:'live',title:'Must not return',live:updatedLive}).catch(error=>error.code);
    await deletion;const deletedPatch=await late;
    const missing=await h.getSession('late-delete');
    return {title:after.title,notes:after.live.notes.length,state:after.live.coachingStatus.state,reviewState:after.live.repReviews[0].state,reviewErrors,imageHash:after.evidenceImages[0].imageSha256,originalImageHash:before.evidenceImages[0].imageSha256,conflict,deletedPatch,missing};
  });
  assert.equal(enrichment.title,'Renamed while AI finished');assert.equal(enrichment.notes,2);assert.equal(enrichment.state,'accepted');assert.equal(enrichment.imageHash,enrichment.originalImageHash);
  assert.equal(enrichment.conflict,'conflict');assert.equal(enrichment.deletedPatch,'not_found');assert.equal(enrichment.missing,null);
  assert.equal(enrichment.reviewState,'ready');assert.deepEqual(enrichment.reviewErrors,['invalid_input','invalid_input','limit_exceeded']);
  checks.lateCoachingPatchPreservesRenameAssetsAndCannotResurrectDeletedSession=true;
  const heartbeatRevision=await page.evaluate(async()=>{
    const h=await import('/harness/history/index.mjs');
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('moveide-history-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');const store=tx.objectStore('sessions');const request=store.get('live-session');request.onsuccess=()=>{const row=request.result;delete row.contentRevision;store.put(row);};tx.oncomplete=resolve;tx.onerror=reject;});db.close();
    const legacy=await h.getSession('live-session');
    const heartbeat=await h.patchSession({id:legacy.id,live:{...legacy.live,queueHeartbeatAt:Date.now()}});
    const summary=(await h.listSessions()).find(item=>item.id===legacy.id);
    const renamed=await h.patchSession({id:legacy.id,title:'Metadata content changed'});
    const changedEvidence=await h.patchSession({id:legacy.id,evidenceImages:renamed.evidenceImages.map(image=>({...image,blob:new Blob([new Uint8Array([255,216,1,255,217])],{type:'image/jpeg'})}))});
    const errors=[];for(const queueHeartbeatAt of [-1,null]){try{await h.patchSession({id:legacy.id,live:{...legacy.live,queueHeartbeatAt}})}catch(error){errors.push(error.code)}}
    return {legacyFallback:legacy.contentRevision===legacy.revision,heartbeatOnly:heartbeat.contentRevision===legacy.contentRevision,revisionAdvanced:heartbeat.revision>legacy.revision,summaryHeartbeat:summary.queueHeartbeatAt===heartbeat.live.queueHeartbeatAt,renameAdvanced:renamed.contentRevision>heartbeat.contentRevision,evidenceAdvanced:changedEvidence.contentRevision>renamed.contentRevision,errors};
  });
  assert.deepEqual(heartbeatRevision,{legacyFallback:true,heartbeatOnly:true,revisionAdvanced:true,summaryHeartbeat:true,renameAdvanced:true,evidenceAdvanced:true,errors:['invalid_input','invalid_input']});
  checks.heartbeatMetadataSkipsMediaReadWithoutHidingContentChanges=true;
  const integrity = await page.evaluate(async () => {
    const h=await import('/harness/history/index.mjs');
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('moveide-history-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    let original;
    await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');const store=tx.objectStore('sessions');const request=store.get('recorded-original');request.onsuccess=()=>{original=request.result;const changed=structuredClone(original);changed.coaching.response.nextFocus.evidenceIds=['another-session'];store.put(changed);};tx.oncomplete=resolve;tx.onerror=reject;});
    let coachingCode;try{await h.getSession('recorded-original')}catch(error){coachingCode=error.code}
    await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(original);tx.oncomplete=resolve;tx.onerror=reject;});
    await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');const store=tx.objectStore('assets');const request=store.get('recorded-original');request.onsuccess=()=>store.put({...request.result,video:new Blob(['corrupted'])});tx.oncomplete=resolve;tx.onerror=reject;});db.close();
    let code;try{await h.getSession('recorded-original')}catch(error){code=error.code}
    await h.deleteSession('recorded-original');await h.deleteSession('live-session');
    return {code,coachingCode,count:(await h.listSessions()).length,bytes:(await h.storageStatus()).appBytes,missing:await h.getSession('recorded-original')};
  });
  assert.equal(integrity.code, 'integrity_error');assert.equal(integrity.coachingCode,'integrity_error'); assert.equal(integrity.count, 0); assert.equal(integrity.bytes, 0); assert.equal(integrity.missing, null); checks.corruptionRejectedAndExplicitDeletionClearsAssets = true;
  const sequenceBoundary=await page.evaluate(async()=>{
    const h=await import('/harness/history/index.mjs');
    const evidenceImages=Array.from({length:192},(_,i)=>({timestampMs:i*100,phase:'descent',repKey:`rep-${Math.floor(i/32)}`,viewEpoch:0,blob:new Blob(['fixture JPEG bytes'],{type:'image/jpeg'})}));
    await h.saveSession({id:'seven-image-sequences',kind:'live',title:'Six bounded reviews',evidenceImages});
    const saved=await h.getSession('seven-image-sequences');let code;
    try{await h.patchSession({id:saved.id,evidenceImages:[...evidenceImages,{...evidenceImages[0],timestampMs:9999}]})}catch(error){code=error.code}
    const unchanged=await h.getSession(saved.id);await h.deleteSession(saved.id);
    return{count:saved.evidenceImages.length,hashes:saved.evidenceImages.every(image=>/^[a-f0-9]{64}$/.test(image.imageSha256)),code,unchanged:unchanged.revision===saved.revision};
  });
  assert.deepEqual(sequenceBoundary,{count:192,hashes:true,code:'limit_exceeded',unchanged:true});checks.sixThirtyTwoImageReviewsPersistAndNextRollsBack=true;
  const denied = await browser.newPage();
  await denied.addInitScript(() => Object.defineProperty(window, 'indexedDB', {value:undefined})); await denied.goto(origin);
  const unavailable=await denied.evaluate(async()=>{const h=await import('/harness/history/index.mjs');return h.storageStatus();});
  assert.equal(unavailable.available, false); assert.equal(unavailable.error.code, 'storage_unavailable'); checks.unavailableStorageHasActionableStatus = true;
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  const result={verifiedAtUtc:new Date().toISOString(),surface:'isolated Chromium IndexedDB on ephemeral localhost origin',checks,limits:'Browser quota fault and app accounting boundary injected; unavailable IndexedDB simulated. Not an actual Safari/private-mode or disk-full test.',externalRequests:0};
  await writeFile(new URL('./browser-verification.json',import.meta.url),`${JSON.stringify(result,null,2)}\n`); console.log(JSON.stringify(result,null,2));
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
