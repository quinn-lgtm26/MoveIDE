/** Portable local session files. No network, credentials, provider calls, or automatic overwrite. */
import { createSessionId, saveSession, HISTORY_LIMITS, HistoryError } from './index.mjs';
import { validateHistoryReport } from './report-validation.mjs';
import { validateCoachPacket, validateCoachingResponse } from '../coaching/packet.mjs';
export const PORTABLE_SESSION_LIMITS = Object.freeze({ fileBytes: 200 * 1024 ** 2, metadataBytes: HISTORY_LIMITS.metadataBytes });
const fail = (code,message) => { throw new HistoryError(code,message); };
const encoder = new TextEncoder();
const exact = (value,keys) => value && !Array.isArray(value) && typeof value==='object' && Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key));
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
function safeJson(value,depth=0) {
  if(depth>32)fail('invalid_bundle','Session metadata is nested too deeply.');
  if(value===null || typeof value==='string' || typeof value==='boolean' || (typeof value==='number'&&Number.isFinite(value)))return;
  if(Array.isArray(value)){for(const item of value)safeJson(item,depth+1);return;}
  if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value))){
    for(const[key,item]of Object.entries(value)){
      if(/^(access.?token|refresh.?token|authorization|api.?key|provider.?credentials|oauth.?credentials|credentials?|client.?secret|secret|password|cookie|bearer|token|__proto__|constructor|prototype)$/i.test(key))fail('invalid_bundle','Credentials and executable metadata cannot be included in a session package.');
      safeJson(item,depth+1);
    }return;
  }
  fail('invalid_bundle','Session metadata must contain only finite JSON values.');
}
function checkMetadata(session) {
  if(!exact(session,['sourceId','kind','title','createdAt','report','coaching','live','metadata']))fail('invalid_bundle','This package has an unsupported session structure.');
  safeJson(session);
  if(typeof session.sourceId!=='string'||!/^[a-zA-Z0-9_-]{1,96}$/.test(session.sourceId) || !['live','recorded'].includes(session.kind) || typeof session.title!=='string'||!session.title.trim()||session.title.length>240||!Number.isSafeInteger(session.createdAt)||session.createdAt<0)fail('invalid_bundle','This package needs valid session identity, title and date.');
  if(session.report!==null&&!validateHistoryReport(session.report))fail('invalid_bundle','The package analysis report is malformed.');
  if(session.live?.notes)for(const note of session.live.notes){
    if(note.packet || note.result){try{validateCoachPacket(note.packet);validateCoachingResponse(note.result,note.packet);}catch{fail('invalid_bundle','A saved coaching note has missing or invalid evidence citations.');}}
  }
  if(encoder.encode(JSON.stringify(session)).byteLength>PORTABLE_SESSION_LIMITS.metadataBytes)fail('limit_exceeded','Session metadata exceeds the 8 MiB package limit.');
}
const descriptor = asset => {const {base64,...rest}=asset;return rest;};
const manifest = bundle => ({format:bundle.format,version:bundle.version,exportedAtUtc:bundle.exportedAtUtc,session:bundle.session,video:descriptor(bundle.video),evidenceImages:bundle.evidenceImages.map(descriptor)});
function encodedSize(bytes){return 4*Math.ceil(bytes/3);}
function checkAsset(asset,video) {
  const keys=video?['mimeType','bytes','sha256','base64']:['timestampMs','phase','repKey','viewEpoch','mimeType','bytes','sha256','base64'];
  if(!exact(asset,keys)||!Number.isSafeInteger(asset.bytes)||asset.bytes<=0||asset.bytes>(video?HISTORY_LIMITS.videoBytes:HISTORY_LIMITS.evidenceImageBytes)||typeof asset.mimeType!=='string'||
    !(video?/^video\/[a-z0-9.+-]+(?:;[a-z0-9=., _-]+)?$/i.test(asset.mimeType):asset.mimeType==='image/jpeg')||typeof asset.sha256!=='string'||!/^[a-f0-9]{64}$/.test(asset.sha256)||typeof asset.base64!=='string'||asset.base64.length!==encodedSize(asset.bytes))fail('invalid_bundle','A media asset has invalid type, size, encoding length or checksum.');
  if(!video&&(!Number.isSafeInteger(asset.timestampMs)||asset.timestampMs<0||!Number.isSafeInteger(asset.viewEpoch)||asset.viewEpoch<0||typeof asset.phase!=='string'||asset.phase.length>40||typeof asset.repKey!=='string'||asset.repKey.length>200))fail('invalid_bundle','An evidence image has an invalid timestamp or rep reference.');
  // Validate alphabet and padding before allocating the decoded asset.
  const padding=asset.base64.endsWith('==')?2:asset.base64.endsWith('=')?1:0;
  const firstPadding=asset.base64.indexOf('=');
  if(/[^A-Za-z0-9+/=]/.test(asset.base64)||(firstPadding!==-1&&firstPadding!==asset.base64.length-padding)||asset.base64.length/4*3-padding!==asset.bytes)fail('invalid_bundle','A media asset is not valid base64.');
}
async function encodeAsset(blob,expectedHash,extra={}) {
  const bytes=new Uint8Array(await blob.arrayBuffer());const actual=await digest(bytes);
  if(actual!==expectedHash)fail('integrity_error','The original recording or evidence checksum changed. Reopen the saved session before exporting.');
  const chunks=[];for(let i=0;i<bytes.length;i+=49152)chunks.push(btoa(String.fromCharCode(...bytes.subarray(i,i+49152))));
  return {...extra,mimeType:blob.type,bytes:blob.size,sha256:actual,base64:chunks.join('')};
}
async function decodeAsset(asset) {
  const bytes=new Uint8Array(asset.bytes);let offset=0;
  for(let i=0;i<asset.base64.length;i+=65536){const encoded=asset.base64.slice(i,i+65536);let decoded;try{decoded=atob(encoded);}catch{fail('invalid_bundle','A media asset could not be decoded.');}if(btoa(decoded)!==encoded)fail('invalid_bundle','A media asset uses noncanonical base64.');for(let j=0;j<decoded.length;j++)bytes[offset++]=decoded.charCodeAt(j);}
  if(offset!==asset.bytes||await digest(bytes)!==asset.sha256)fail('integrity_error','A recording or evidence image failed its checksum. Nothing was imported.');
  return new Blob([bytes],{type:asset.mimeType});
}
export async function exportSessionBundle(session) {
  if(!(session?.video instanceof Blob)||!session.video.size)fail('video_required','This portable demo needs a saved recording. Choose a session with video.');
  const data={sourceId:session.id,kind:session.kind,title:session.title,createdAt:session.createdAt,report:session.report,coaching:session.coaching,live:session.live,metadata:session.metadata};
  checkMetadata(data);
  if(session.video.size>HISTORY_LIMITS.videoBytes||!Array.isArray(session.evidenceImages)||session.evidenceImages.length>HISTORY_LIMITS.evidenceImages||session.evidenceImages.some(image=>!(image.blob instanceof Blob)||!image.blob.size||image.blob.size>HISTORY_LIMITS.evidenceImageBytes))fail('limit_exceeded','This session exceeds portable media limits.');
  const projected=encodedSize(session.video.size)+session.evidenceImages.reduce((sum,image)=>sum+encodedSize(image.blob.size)+512,0)+encoder.encode(JSON.stringify(data)).byteLength+2048;
  if(projected>PORTABLE_SESSION_LIMITS.fileBytes)fail('limit_exceeded','This session exceeds the 200 MiB portable file limit. Export a shorter recording.');
  const video=await encodeAsset(session.video,session.videoSha256),evidenceImages=[];
  for(const image of session.evidenceImages)evidenceImages.push(await encodeAsset(image.blob,image.imageSha256,{timestampMs:image.timestampMs,phase:image.phase,repKey:image.repKey,viewEpoch:image.viewEpoch}));
  checkAsset(video,true);for(const image of evidenceImages)checkAsset(image,false);
  const bundle={format:'moveide-session',version:1,exportedAtUtc:new Date().toISOString(),session:data,video,evidenceImages};
  const manifestSha256=await digest(encoder.encode(JSON.stringify(manifest(bundle))));
  const file=new Blob([JSON.stringify({...bundle,manifestSha256})],{type:'application/json'});
  if(file.size>PORTABLE_SESSION_LIMITS.fileBytes)fail('limit_exceeded','This session exceeds the 200 MiB portable file limit.');
  return file;
}
export async function importSessionBundle(blob) {
  if(!(blob instanceof Blob)||!blob.size||blob.size>PORTABLE_SESSION_LIMITS.fileBytes)fail('limit_exceeded','Choose a MoveIDE session JSON file of at most 200 MiB.');
  let bundle;try{bundle=JSON.parse(await blob.text());}catch{fail('invalid_bundle','This file is not valid MoveIDE session JSON.');}
  if(!exact(bundle,['format','version','exportedAtUtc','session','video','evidenceImages','manifestSha256'])||bundle.format!=='moveide-session'||bundle.version!==1||typeof bundle.exportedAtUtc!=='string'||bundle.exportedAtUtc.length>40||!Number.isFinite(Date.parse(bundle.exportedAtUtc))||typeof bundle.manifestSha256!=='string'||!/^[a-f0-9]{64}$/.test(bundle.manifestSha256))fail('invalid_bundle','Unsupported MoveIDE session package version or structure.');
  checkMetadata(bundle.session);
  if(!Array.isArray(bundle.evidenceImages)||bundle.evidenceImages.length>HISTORY_LIMITS.evidenceImages)fail('limit_exceeded','The package contains too many evidence images.');
  checkAsset(bundle.video,true);for(const image of bundle.evidenceImages)checkAsset(image,false);
  if(await digest(encoder.encode(JSON.stringify(manifest(bundle))))!==bundle.manifestSha256)fail('integrity_error','The session metadata or media manifest changed. Nothing was imported.');
  const video=await decodeAsset(bundle.video),evidenceImages=[];
  for(const image of bundle.evidenceImages)evidenceImages.push({timestampMs:image.timestampMs,phase:image.phase,repKey:image.repKey,viewEpoch:image.viewEpoch,blob:await decodeAsset(image)});
  // Imported unfinished requests cannot resume on another device. Preserve accepted notes.
  const {sourceId,...input}=bundle.session;
  if(input.live){delete input.live.queueHeartbeatAt;for(const review of input.live.repReviews??[])if(['queued','analyzing'].includes(review.state)){review.state='cancelled';review.message='This review was unfinished when exported; queued requests do not transfer between devices.';review.updatedAt=Date.now();}}
  const saved=await saveSession({...input,id:createSessionId(),expectedRevision:0,video,evidenceImages});
  return saved.id;
}
