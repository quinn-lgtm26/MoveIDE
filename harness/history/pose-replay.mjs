import { analyzeSquat } from '../motion/analyze.mjs';
import { openVideo } from '../motion/video.mjs';
import { bindReportSource } from '../motion/source-identity.mjs';
import { patchSession, getSession } from './index.mjs';
import { validateHistoryReport } from './report-validation.mjs';
const identity = session => `saved-pose:${session.videoSha256}`;
export function getSavedPoseReplay(session) {
  if (!session?.video || !session.videoSha256 || !validateHistoryReport(session.report) || session.report.clip.id !== identity(session)) return null;
  bindReportSource(session.report, session.video); return session.report;
}
/** Analyze the saved encoded recording, not the original live clock. Never invokes AI. */
export async function prepareSavedPoseReplay(session, options = {}) {
  const {signal,persist=true}=options;
  signal?.throwIfAborted();
  if(!persist || !globalThis.navigator?.locks?.request) return prepare(session,options);
  // A stopped live tab and History may open simultaneously. Serialize only the
  // same saved session, then re-read the verified cache before loading Heavy.
  return navigator.locks.request(`moveide-pose-replay:${session.id}`, {mode:'exclusive',...(signal?{signal}:{})}, async()=>{
    signal?.throwIfAborted();
    const current=await getSession(session.id);
    signal?.throwIfAborted();
    if(!current)throw new Error('This saved session was deleted or is no longer available.');
    if(current.videoSha256!==session.videoSha256)throw new Error('The saved recording source changed. Reopen this session.');
    // Retain the caller's bytes so a mismatching supplied Blob is still rejected.
    return prepare({...current,video:session.video},options);
  });
}
async function prepare(session, { signal, onProgress = () => {}, persist = true } = {}) {
  signal?.throwIfAborted();
  if (session?.kind !== 'live' || !(session.video instanceof Blob) || !session.video.size) throw new Error('No saved video is available for pose replay.');
  if (session.video.size > 100 * 1024 * 1024) throw new Error('Pose replay supports saved recordings up to 100 MiB and five minutes.');
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await session.video.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');
  signal?.throwIfAborted();
  if (hash !== session.videoSha256) throw new Error('The saved recording does not match its verified source identity.');
  const cached=getSavedPoseReplay(session);
  if(cached)return {report:cached,cached:true,saveError:null};
  if(session.report)throw new Error('This saved analysis has a different source identity; it cannot be replaced. The original video and notes remain available.');
  const decoded=await openVideo(session.video,{signal});
  try {if(decoded.video.duration>300)throw new Error('Pose replay supports saved recordings up to five minutes.');} finally {decoded.close();}
  signal?.throwIfAborted();
  const report=await analyzeSquat(session.video,{signal,model:'heavy',clipId:identity(session),onProgress});
  signal?.throwIfAborted();
  if (!persist) return {report,cached:false,saveError:null};
  try {await patchSession({id:session.id,report});return {report,cached:false,saveError:null};}
  catch(error){
    signal?.throwIfAborted();
    // A parallel tab may already have saved its equivalent source-bound result.
    if(error?.code==='source_changed'){const current=await getSession(session.id);const other=current&&getSavedPoseReplay(current);if(other)return {report:other,cached:true,saveError:null};}
    return {report,cached:false,saveError:error instanceof Error?error.message:String(error)};
  }
}
