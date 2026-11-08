import {useEffect,useRef,useState,type RefObject} from 'react';
import {getSavedPoseReplay,prepareSavedPoseReplay} from '../harness/history/pose-replay.mjs';
import {drawSquatOverlay,overlayFrameAt} from '../harness/motion/overlay.mjs';
import {patchSession} from '../harness/history/index.mjs';
import type {SavedSession} from './History';
export function useSavedPoseReplay(session:SavedSession,video:RefObject<HTMLVideoElement|null>,sourceUrl:string|null) {
  const [report,setReport]=useState(()=>getSavedPoseReplay(session));
  const [status,setStatus]=useState(report?'ready':'idle'),[progress,setProgress]=useState(0),[error,setError]=useState('');
  const [retry,setRetry]=useState(0),[visible,setVisible]=useState(true),[sampleMs,setSampleMs]=useState<number|null>(null);
  const canvas=useRef<HTMLCanvasElement>(null),controller=useRef<AbortController|null>(null),retained=useRef(report);
  useEffect(()=>{
    if(!session.video)return;
    const abort=new AbortController();controller.current=abort;
    const cached=getSavedPoseReplay(session);if(cached){retained.current=cached;setReport(cached);setStatus('ready');return;}
    setStatus('preparing');setError('');
    void (async()=>{
      // A failed cache write can retry without repeating pose inference.
      if(retained.current){await patchSession({id:session.id,report:retained.current});return {report:retained.current,saveError:null};}
      return prepareSavedPoseReplay(session,{signal:abort.signal,onProgress:state=>{if(!abort.signal.aborted)setProgress(state.progress);}});
    })().then(result=>{if(abort.signal.aborted)return;retained.current=result.report;setReport(result.report);setError(result.saveError??'');setStatus(result.saveError?'unsaved':'ready');}).catch(reason=>{if(abort.signal.aborted)return;setError(reason instanceof Error?reason.message:String(reason));setStatus(retained.current?'unsaved':'error');});
    return()=>abort.abort();
  },[session.id,session.videoSha256,retry]);
  useEffect(()=>{
    const v=video.current,c=canvas.current;if(!v||!c||!report)return;
    const ctx=c.getContext('2d');if(!ctx)return;
    let active=true,handle=0;
    const clear=()=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);};
    const draw=(time:number)=>{if(!active)return;const dpr=devicePixelRatio||1,width=v.clientWidth,height=v.clientHeight;c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
      const dimensionsMatch=v.videoWidth===report.clip.widthPx&&v.videoHeight===report.clip.heightPx;
      const frame=visible&&dimensionsMatch&&!v.seeking&&v.readyState>=2?overlayFrameAt(report.frames,Math.round(time*1000)):null;
      setSampleMs(frame?.timestampMs??null);drawSquatOverlay(ctx,frame,{side:report.protocol.side,videoWidth:v.videoWidth,videoHeight:v.videoHeight,width,height,fullBody:true,showKneeArc:false});};
    const frame=(_:number,metadata:VideoFrameCallbackMetadata)=>{draw(metadata.mediaTime);if(active)handle=v.requestVideoFrameCallback(frame);};
    if(v.requestVideoFrameCallback)handle=v.requestVideoFrameCallback(frame);
    const redraw=()=>draw(v.currentTime),seeking=()=>{clear();setSampleMs(null);};
    const resize=new ResizeObserver(redraw);resize.observe(v);
    for(const event of ['loadeddata','seeked','pause','timeupdate'])v.addEventListener(event,redraw);
    v.addEventListener('seeking',seeking);redraw();
    return()=>{active=false;if(v.cancelVideoFrameCallback)v.cancelVideoFrameCallback(handle);resize.disconnect();for(const event of ['loadeddata','seeked','pause','timeupdate'])v.removeEventListener(event,redraw);v.removeEventListener('seeking',seeking);clear();};
  },[report,visible,video,sourceUrl]);
  return {hasReport:!!report,canvas:report?<canvas ref={canvas} className="saved-pose-overlay" aria-hidden="true" data-pose-sample-ms={sampleMs??''}/>:null,controls:session.video?<section className="saved-pose-controls" aria-label="Saved recording pose replay">
    {status==='preparing'?<><p role="status">Preparing pose replay locally · {Math.round(progress*100)}%. Video and saved notes remain usable. No new AI request.</p><button onClick={()=>{controller.current?.abort();setStatus('cancelled');}}>Cancel pose preparation</button></>:report?<><label><input type="checkbox" checked={visible} onChange={event=>setVisible(event.target.checked)}/> Show saved-video pose</label><p className="fine">{!visible?'Pose overlay hidden.':sampleMs===null?'No reliable pose sample at this recording moment.':`Pose sampled from this saved video at ${(sampleMs/1000).toFixed(2)}s (within 100 ms).`} Estimated pose. Original live counts and coach notes stay the same.</p></>:<p className="fine">Pose replay uses one local analysis of this saved video. Original live notes retain their approximate recording alignment.</p>}
    {error&&<p role="alert">{error} Playback remains available.</p>}{['error','cancelled','unsaved'].includes(status)&&<button onClick={()=>setRetry(value=>value+1)}>{status==='unsaved'?'Retry saving pose replay':'Prepare pose replay'}</button>}
  </section>:null};
}
