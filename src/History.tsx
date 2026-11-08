import { useEffect, useMemo, useRef, useState } from 'react';
import './index.css';
import clearSquatReport from '../harness/results/clear-squat.analysis-report.v1.json';
import {getMotionTrace,type AnalysisReport} from '../harness/motion/analyze.mjs';
import {exportSessionBundle,importSessionBundle} from '../harness/history/portable.mjs';
import {useSavedPoseReplay} from './useSavedPoseReplay';
import { validateCoachPacket, validateCoachingResponse } from '../harness/coaching/index.mjs';
import { deleteSession, exportSessionData, getSession, listSessions, saveSession, storageStatus } from '../harness/history/index.mjs';
export type SavedSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
const privacy = 'Saved only in this browser on this computer and this app address. Phone sessions are stored on the receiving computer. Clearing site data removes history; downloads are your backup.';
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const date = (value: number) => new Date(value).toLocaleString();
const bytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function SessionDownloads({ session }: { session: SavedSession }) {
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
  const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const exportPortable=async()=>{setExporting(true);setExportError('');try{const blob=await exportSessionBundle(session);if(alive.current)download(blob,`${session.id}.moveide-session.json`);}catch(error){if(alive.current)setExportError(message(error));}finally{if(alive.current)setExporting(false);}};
  return <><div className="toolbar"><button disabled={!session.video||exporting} onClick={()=>void exportPortable()}>{exporting?'Preparing export…':'Export session'}</button><button disabled={!session.video} onClick={() => session.video && download(session.video, String(session.metadata?.videoName ?? `${session.title}.${session.video.type.includes('mp4') ? 'mp4' : 'webm'}`))}>Download original video</button><button onClick={() => { const data = exportSessionData(session); download(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}), `${session.title}-analysis.json`); }}>Download measurements</button></div><p className="fine">Export session includes the recording, saved measurements, coach notes and snapshots in one file. Import it on another computer to review.</p>{exporting&&<p role="status">Preparing your session file. Larger recordings can take a moment.</p>}{exportError&&<p role="alert" className="error">Export failed: {exportError}</p>}</>;
}

function SavedReason({result}:{result:unknown}) {
  const value = result as {observations?: {text:string}[];nextFocus?:{text:string};uncertainty?:string} | null;
  if (!value || typeof value !== 'object') return <p>Detailed reasoning was not stored.</p>;
  return <>{Array.isArray(value.observations) && value.observations.map((observation,index)=><p key={index}>{String(observation.text)}</p>)}{value.nextFocus?.text && <p><b>Next focus:</b> {String(value.nextFocus.text)}</p>}{value.uncertainty && <p className="muted">Limits: {String(value.uncertainty)}</p>}</>;
}
const metricDefinitions = [
  ['kneeFlexionDeg','Knee flexion','°'],['hipFlexionDeg','Hip flexion','°'],['torsoLeanDeg','Torso lean','°'],['shinInclinationDeg','Shin inclination','°'],['ankleClosureChangeDeg','Ankle closure change','°'],['hipDescentLegLengths','Hip descent',' leg lengths'],['hipAboveKneeLegLengths','Hip above knee',' leg lengths'],
] as const;
function SavedMetrics({sample}:{sample:Record<string,unknown>}) {
  const metrics=(sample.metrics ?? {}) as Record<string,unknown>;
  const validity=(sample.metricValidity ?? {}) as Record<string,{status?:string;reason?:string}>;
  return <>{metricDefinitions.map(([key,label,unit])=>{
    const value=metrics[key], quality=validity[key];
    const usable=sample.analysisEligible!==false&&typeof value==='number'&&Number.isFinite(value)&&quality?.status!=='unavailable';
    return <span className="saved-metric" key={key}>{label}: {usable ? `${(value as number).toFixed(unit==='°'?1:2)}${unit}` : `unavailable${quality?.reason ? ` (${quality.reason.replaceAll('_',' ')})` : ''}`}</span>;
  })}</>;
}
function SavedEvidence({images}:{images:SavedSession['evidenceImages']}) {
  const [urls,setUrls]=useState<{image:SavedSession['evidenceImages'][number];url:string}[]>([]);
  // The list may be freshly filtered each render; stable image references avoid URL churn.
  const key=images.map(image=>image.imageSha256??`${image.repKey}-${image.timestampMs}`).join('|');
  useEffect(()=>{const items=images.map(image=>({image,url:URL.createObjectURL(image.blob)}));setUrls(items);return()=>items.forEach(item=>URL.revokeObjectURL(item.url));},[key]);
  if(!images.length)return null;
  return <details><summary>Original evidence ({images.length} images)</summary><div className="frames">{urls.map(({image,url})=><figure key={url}><img className="thumb" src={url} alt={`${image.phase} evidence at original analysis time ${image.timestampMs} ms, view ${image.viewEpoch+1}`} /><figcaption>{image.phase} · analysis {image.timestampMs} ms · view {image.viewEpoch+1}</figcaption><button onClick={()=>download(image.blob,`evidence-${image.timestampMs}ms.jpg`)}>Download evidence {image.timestampMs} ms</button></figure>)}</div><p className="fine">These are the retained source JPEGs. Their analysis timestamps are not claimed to align exactly with the saved recording clock.</p></details>;
}
const replayTime = (seconds: number) => `${Math.floor(Math.max(0,seconds)/60)}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
type SavedPoint = {[key:string]: import('../harness/history/index.mjs').JsonValue};
const isSavedPoint = (item: import('../harness/history/index.mjs').JsonValue): item is SavedPoint => !!item && typeof item==='object' && !Array.isArray(item);
const repKey = (rep:SavedPoint) => String(rep.key??`${rep.viewEpoch}:${rep.id}:${rep.startMs}`);
const timedRep = (rep:SavedPoint) => ['startMs','bottomMs','endMs','viewEpoch'].every(key=>typeof rep[key]==='number'&&Number.isFinite(rep[key]))&&Number(rep.startMs)>=0&&Number(rep.startMs)<=Number(rep.bottomMs)&&Number(rep.bottomMs)<=Number(rep.endMs);
const matchesRep = (item:SavedPoint,rep:SavedPoint,reps:SavedPoint[]) => {
  if(typeof rep.key==='string'&&typeof item.repKey==='string')return item.repKey===rep.key&&item.viewEpoch===rep.viewEpoch;
  // Legacy local rep IDs are ambiguous after rolling-window resets. Require a unique interval/epoch match.
  return timedRep(rep)&&item.repId===rep.id&&item.viewEpoch===rep.viewEpoch&&typeof item.timestampMs==='number'&&item.timestampMs>=Number(rep.startMs)&&item.timestampMs<=Number(rep.endMs)&&reps.filter(candidate=>candidate.id===rep.id&&candidate.viewEpoch===rep.viewEpoch&&timedRep(candidate)&&Number(item.timestampMs)>=Number(candidate.startMs)&&Number(item.timestampMs)<=Number(candidate.endMs)).length===1;
};
type CitedMoment={text:string;timestampMs:number;phase:string;observationIndex:number};
function citedMoments(note:SavedPoint,rep:SavedPoint|undefined):CitedMoment[] {
  if(!rep||!timedRep(rep))return [];
  try{
    const packet=validateCoachPacket(note.packet),response=validateCoachingResponse(note.result,packet);
    if(!packet.repIds.includes(String(rep.id)))return [];
    const times=new Map([...packet.measurements.map(item=>[item.id,item.evidenceTimestampMs] as const),...packet.evidence.map(item=>[item.id,item.timestampMs] as const)]);
    return response.observations.flatMap((observation,observationIndex)=>[...new Set(observation.evidenceIds.map(id=>times.get(id)))].filter((time):time is number=>typeof time==='number'&&time>=Number(rep.startMs)&&time<=Number(rep.endMs)).map(timestampMs=>({text:observation.text,observationIndex,timestampMs,phase:timestampMs<Number(rep.bottomMs)?'Descent':timestampMs===rep.bottomMs?'Bottom':'Ascent'}))).sort((a,b)=>a.timestampMs-b.timestampMs);
  }catch{return [];}
}
function SavedTrace({samples,reps,cursor,onInspect}:{samples:SavedPoint[];reps:SavedPoint[];cursor:number|null;onInspect:(index:number)=>void}) {
  const graphRef=useRef<HTMLElement>(null),[graphWidth,setGraphWidth]=useState(700);
  useEffect(()=>{const node=graphRef.current;if(!node)return;const observer=new ResizeObserver(entries=>setGraphWidth(Math.max(240,entries[0].contentRect.width)));observer.observe(node);return()=>observer.disconnect();},[]);
  const right=graphWidth-18,plotWidth=right-38;
  const points=useMemo(()=>samples.map((sample,index)=>({sample,index})).filter(({sample})=>typeof sample.timestampMs==='number'&&Number.isFinite(sample.timestampMs)),[samples]);
  const start=points.length?Math.min(...points.map(({sample})=>Number(sample.timestampMs))):0;
  const end=points.length?Math.max(...points.map(({sample})=>Number(sample.timestampMs))):0;
  const span=Math.max(1,end-start),x=(time:number)=>38+(time-start)/span*plotWidth,y=(value:number)=>158-value/180*140;
  const series=useMemo(()=>metricDefinitions.slice(0,3).map(([key,label])=>{
    let previous:SavedPoint|undefined,paths:string[]=[],path='';
    for(const {sample} of points){
      const values=sample.metrics as SavedPoint|undefined,validity=sample.metricValidity as Record<string,{status?:string}>|undefined,value=values?.[key];
      const usable=sample.analysisEligible!==false&&typeof sample.viewEpoch==='number'&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=180&&validity?.[key]?.status!=='unavailable';
      const connected=usable&&previous&&previous.viewEpoch===sample.viewEpoch&&Number(sample.timestampMs)>Number(previous.timestampMs)&&Number(sample.timestampMs)-Number(previous.timestampMs)<=750;
      if(!connected&&path){paths.push(path);path='';}
      if(usable)path+=`${path?'L':'M'}${x(Number(sample.timestampMs)).toFixed(2)},${y(value as number).toFixed(2)} `;
      previous=usable?sample:undefined;
    }
    if(path)paths.push(path);return {key,label,paths};
  }),[points,start,end,graphWidth]);
  if(!points.length)return null;
  return <section ref={graphRef} className="saved-trace" aria-label="Full saved session graph"><div className="replay-panel-heading"><h3>Session movement</h3><span className="fine">{(span/1000).toFixed(1)}s retained trace</span></div><div className="saved-trace-legend">{series.map((item,index)=><span key={item.key} data-series={index}>{item.label}</span>)}</div>
    <svg viewBox={`0 0 ${graphWidth} 190`} role="img" aria-label="Knee flexion, hip flexion and torso lean across the full saved analysis timeline. Gaps and view changes break lines." onClick={event=>{const rect=event.currentTarget.getBoundingClientRect(),time=start+Math.max(0,Math.min(1,((event.clientX-rect.left)/rect.width*graphWidth-38)/plotWidth))*span;const nearest=points.reduce((a,b)=>Math.abs(Number(a.sample.timestampMs)-time)<=Math.abs(Number(b.sample.timestampMs)-time)?a:b);onInspect(nearest.index);}}>
      {[0,90,180].map(value=><g key={value}><line x1="38" x2={right} y1={y(value)} y2={y(value)} className="saved-trace-grid"/><text x="30" y={y(value)+4} textAnchor="end">{value}°</text></g>)}
      {reps.filter(timedRep).map(rep=>{const a=Math.max(start,Number(rep.startMs)),b=Number(rep.bottomMs),c=Math.min(end,Number(rep.endMs));return c>=a?<g key={repKey(rep)} className="saved-trace-phases" aria-label={`Rep ${reps.indexOf(rep)+1} phases`}><title>{`Rep ${reps.indexOf(rep)+1}: down ${(Number(rep.startMs)/1000).toFixed(2)}s, bottom ${(b/1000).toFixed(2)}s, up ${(Number(rep.endMs)/1000).toFixed(2)}s · analysis clock`}</title><rect x={x(a)} y="18" width={Math.max(0,x(Math.min(c,b))-x(a))} height="140" fill="currentColor" opacity=".06"/><rect x={x(Math.max(a,b))} y="18" width={Math.max(0,x(c)-x(Math.max(a,b)))} height="140" fill="currentColor" opacity=".12"/>{b>=start&&b<=end&&<line x1={x(b)} x2={x(b)} y1="18" y2="158" stroke="currentColor" strokeDasharray="2 5" opacity=".35"/>}</g>:null;})}
      {series.map((item,index)=><g key={item.key} data-series={index}>{item.paths.map((path,i)=><path key={i} d={path} className="saved-trace-line"/>)}</g>)}
      {cursor!==null&&cursor>=start&&cursor<=end&&<line className="saved-trace-cursor" x1={x(cursor)} x2={x(cursor)} y1="12" y2="162"/>}<text x="38" y="181">{(start/1000).toFixed(1)}s</text><text x={right} y="181" textAnchor="end">{(end/1000).toFixed(1)}s · analysis time</text>
    </svg><p className="fine">Degrees, camera-based estimates. Shading marks down / up; dotted lines mark rep bottoms. Gaps and view changes break traces. Click to inspect a saved sample, or use the keyboard timeline below.</p>
    <label className="replay-sample-slider">Graph sample<input type="range" min="0" max={Math.max(0,points.length-1)} value={cursor===null?0:points.reduce((best,point,index)=>Math.abs(Number(point.sample.timestampMs)-cursor)<Math.abs(Number(points[best].sample.timestampMs)-cursor)?index:best,0)} disabled={points.length<2} onChange={event=>onInspect(points[Number(event.target.value)].index)}/></label>
  </section>;
}
const exampleReport=clearSquatReport as unknown as AnalysisReport;
const exampleRep=exampleReport.reps[0];
const exampleTrace=getMotionTrace(exampleReport);
const comparisonMetrics=[['kneeFlexionDeg','Knee bend','Higher means more knee bend.'],['hipFlexionDeg','Hip bend','Higher means more hip bend.'],['torsoLeanDeg','Chest angle','Higher means more lean from vertical.']] as const;
type ComparisonMetric=typeof comparisonMetrics[number][0];
function RepExampleGraph({samples,rep,label}:{samples:SavedPoint[];rep:SavedPoint|undefined;label:string}) {
  const [metric,setMetric]=useState<ComparisonMetric>('kneeFlexionDeg');
  const element=useRef<HTMLElement>(null),[width,setWidth]=useState(360);
  useEffect(()=>{const node=element.current;if(!node)return;const observer=new ResizeObserver(entries=>setWidth(Math.max(250,entries[0].contentRect.width)));observer.observe(node);return()=>observer.disconnect();},[]);
  const usableRep=rep&&timedRep(rep)&&Number(rep.bottomMs)>Number(rep.startMs)&&Number(rep.endMs)>Number(rep.bottomMs)?rep:undefined;
  const phaseX=(timestamp:number,bounds:{startMs:number;bottomMs:number;endMs:number})=>timestamp<=bounds.bottomMs ? .5*(timestamp-bounds.startMs)/(bounds.bottomMs-bounds.startMs):.5+.5*(timestamp-bounds.bottomMs)/(bounds.endMs-bounds.bottomMs);
  const x=(phase:number)=>38+phase*(width-56),y=(angle:number)=>158-angle/180*140;
  const series=(points:{time:number;value:number|null}[],bounds:{startMs:number;bottomMs:number;endMs:number},maxGap:number)=>{
    const paths:string[]=[],dots:{time:number;value:number;phase:number}[]=[];let path='',previous:number|null=null;
    for(const point of points){
      const valid=point.value!==null&&Number.isFinite(point.value)&&point.value>=0&&point.value<=180;
      if(!valid||previous===null||point.time<=previous||point.time-previous>maxGap){if(path)paths.push(path);path='';}
      if(valid){const phase=phaseX(point.time,bounds);dots.push({time:point.time,value:point.value!,phase});path+=`${path?'L':'M'}${x(phase).toFixed(2)},${y(point.value!).toFixed(2)} `;previous=point.time;}else previous=null;
    }
    if(path)paths.push(path);return{paths,dots};
  };
  const reference=series(exampleTrace.filter(point=>point.timestampMs>=exampleRep.startMs&&point.timestampMs<=exampleRep.endMs).map(point=>({time:point.timestampMs,value:point[metric]})),exampleRep,150);
  const current=usableRep?series(samples.filter(point=>typeof point.timestampMs==='number'&&point.timestampMs>=Number(usableRep.startMs)&&point.timestampMs<=Number(usableRep.endMs)).map(point=>{
    const values=point.metrics as SavedPoint|undefined,validity=point.metricValidity as Record<string,{status?:string}>|undefined,guard=point.viewGuard as SavedPoint|undefined;
    const valid=point.viewEpoch===usableRep.viewEpoch&&point.analysisEligible!==false&&(!guard||guard.state==='stable')&&validity?.[metric]?.status!=='unavailable'&&typeof values?.[metric]==='number';
    return{time:Number(point.timestampMs),value:valid?Number(values![metric]):null};
  }),{startMs:Number(usableRep.startMs),bottomMs:Number(usableRep.bottomMs),endMs:Number(usableRep.endMs)},750):{paths:[],dots:[]};
  const definition=comparisonMetrics.find(item=>item[0]===metric)!;
  return <section ref={element} className="saved-trace rep-example-graph" aria-label="Selected rep and example comparison"><div className="replay-panel-heading"><h3>Your rep &amp; an example</h3></div><label className="rep-example-metric">Measure <select aria-label="Comparison measure" value={metric} onChange={event=>setMetric(event.target.value as ComparisonMetric)}>{comparisonMetrics.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><div className="saved-trace-legend"><span className="rep-example-yours">— {label||'Selected rep'}</span><span className="rep-example-reference">┄ Public example</span></div>
    <svg viewBox={`0 0 ${width} 190`} role="img" aria-label={`${definition[1]} in degrees. Selected rep and public example aligned at Lower, Bottom and Stand; amplitudes unchanged.`}>
      {[0,90,180].map(value=><g key={value}><line x1="38" x2={width-18} y1={y(value)} y2={y(value)} className="saved-trace-grid"/><text x="30" y={y(value)+4} textAnchor="end">{value}°</text></g>)}
      <line x1={x(.5)} x2={x(.5)} y1="18" y2="158" className="rep-example-bottom"/>
      <g data-comparison="example">{reference.paths.map((path,index)=><path key={index} d={path} className="rep-example-line reference"/>)}</g>
      <g data-comparison="selected">{current.paths.map((path,index)=><path key={index} d={path} className="rep-example-line selected"/>)}{current.dots.map(point=><circle key={point.time} cx={x(point.phase)} cy={y(point.value)} r="2.5" data-value={point.value} data-phase={point.phase} data-analysis-ms={point.time}><title>{`${label}: ${point.value.toFixed(1)}° at analysis ${(point.time/1000).toFixed(2)}s`}</title></circle>)}</g>
      <text x="38" y="181">Lower</text><text x={x(.5)} y="181" textAnchor="middle">Bottom</text><text x={width-18} y="181" textAnchor="end">Stand</text>
    </svg><p className="fine">{definition[2]} Each rep keeps its own pace; only the phases are lined up. Angle values stay unchanged.</p><p className="fine">{usableRep?`${label}: ${((Number(usableRep.endMs)-Number(usableRep.startMs))/1000).toFixed(1)}s · `:'Choose a completed rep. '}Example: {((exampleRep.endMs-exampleRep.startMs)/1000).toFixed(1)}s. {usableRep&&!current.dots.length?'No reliable saved measurements for this rep. ':''}Gaps stay empty.</p><details><summary>About this example</summary><p className="fine">First complete rep of the public clear-squat clip, measured with MediaPipe Heavy. It is an example, not a prescribed shape or an accuracy standard. Body proportions, camera position and movement depth can differ.</p></details>
  </section>;
}
function RepFilmstrip({images,rep,toVideo,onJump}:{images:SavedSession['evidenceImages'];rep:SavedPoint|undefined;toVideo:(time:number)=>number|null;onJump:(time:number)=>void}) {
  const strip=useRef<HTMLOListElement>(null);
  const ordered=images.filter(image=>rep&&image.repKey===repKey(rep)&&image.viewEpoch===rep.viewEpoch&&image.timestampMs>=Number(rep.startMs)&&image.timestampMs<=Number(rep.endMs)).sort((a,b)=>a.timestampMs-b.timestampMs);
  const selected=ordered.length<=32?ordered:Array.from({length:32},(_,index)=>ordered[Math.round(index*(ordered.length-1)/31)]);
  const key=selected.map(image=>`${image.repKey}:${image.viewEpoch}:${image.timestampMs}:${image.imageSha256??''}`).join('|');
  const [stored,setStored]=useState<{key:string;items:{image:SavedSession['evidenceImages'][number];url:string}[]}>({key:'',items:[]});
  const urls=stored.key===key?stored.items:[];
  useEffect(()=>{const next=selected.map(image=>({image,url:URL.createObjectURL(image.blob)}));setStored({key,items:next});if(strip.current)strip.current.scrollLeft=0;return()=>next.forEach(item=>URL.revokeObjectURL(item.url));},[key]);
  if(!rep||!timedRep(rep))return null;
  return <section className="rep-filmstrip" aria-label="Selected rep snapshots"><h4>See the movement</h4>{!selected.length?<p className="fine">No snapshots were saved for this rep. Video replay and measurements are still available.</p>:<><p className="fine">{selected.length} saved snapshots, in time order{ordered.length>32?' · evenly thinned for this strip':''}. Gaps are not filled. Video links are approximate.</p><ol ref={strip} tabIndex={0} aria-label="Saved snapshots in time order">{urls.map(({image,url})=>{const time=toVideo(image.timestampMs),phase=image.timestampMs<Number(rep.bottomMs)?'Lower':image.timestampMs===rep.bottomMs?'Bottom':image.timestampMs>=Number(rep.endMs)?'Stand':'Rise';return <li key={`${image.timestampMs}:${url}`}><button disabled={time===null} onClick={()=>onJump(image.timestampMs)} aria-label={`${phase} snapshot at analysis ${(image.timestampMs/1000).toFixed(2)} seconds${time!==null?`, video approximately ${time.toFixed(2)} seconds`:''}`}><img src={url} alt={`${phase} · original analysis ${(image.timestampMs/1000).toFixed(2)} seconds`}/><span>{phase} · {time!==null?`≈${replayTime(time)}`:`${(image.timestampMs/1000).toFixed(2)}s`}</span></button></li>;})}</ol></>}</section>;
}

function LiveReference({live,sample}:{live:SavedSession['live'];sample:SavedPoint|undefined}) {
  const reps=(live?.reps??[]).filter(isSavedPoint).filter(rep=>['startMs','bottomMs','endMs','viewEpoch'].every(key=>typeof rep[key]==='number'&&Number.isFinite(rep[key]))&&Number(rep.startMs)>=0&&Number(rep.startMs)<=Number(rep.bottomMs)&&Number(rep.bottomMs)<=Number(rep.endMs)).sort((a,b)=>Number(a.startMs)-Number(b.startMs));
  const [referenceKey,setReferenceKey]=useState('');
  const key=(rep:SavedPoint)=>String(rep.key??`${rep.viewEpoch}:${rep.id}:${rep.startMs}`);
  const reference=reps.find(rep=>key(rep)===referenceKey)??reps[0];
  const current=sample?reps.find(rep=>rep.viewEpoch===sample.viewEpoch&&Number(sample.timestampMs)>=Number(rep.startMs)&&Number(sample.timestampMs)<=Number(rep.endMs)):undefined;
  if(!reference)return null;
  const values=(rep:SavedPoint)=>{
    const feedback=isSavedPoint(rep.feedback)?rep.feedback:null;
    const knee=feedback&&feedback.evidenceTimestampMs===rep.bottomMs&&typeof feedback.measuredKneeFlexionDeg==='number'?feedback.measuredKneeFlexionDeg:null;
    const candidates=(live?.samples??[]).filter(isSavedPoint).filter(point=>point.viewEpoch===rep.viewEpoch&&typeof point.timestampMs==='number'&&Math.abs(point.timestampMs-Number(rep.bottomMs))<=250);
    const nearest=candidates.sort((a,b)=>Math.abs(Number(a.timestampMs)-Number(rep.bottomMs))-Math.abs(Number(b.timestampMs)-Number(rep.bottomMs)))[0];
    const metrics=nearest?.metrics as SavedPoint|undefined,validity=nearest?.metricValidity as Record<string,{status?:string}>|undefined;
    const chest=nearest?.analysisEligible!==false&&typeof metrics?.torsoLeanDeg==='number'&&validity?.torsoLeanDeg?.status!=='unavailable'?metrics.torsoLeanDeg:null;
    return [knee,chest,Number(rep.endMs)-Number(rep.startMs)];
  };
  const a=values(reference),b=current?values(current):[null,null,null],sameView=current?.viewEpoch===reference.viewEpoch;
  const show=(value:number|null,index:number)=>value===null||!Number.isFinite(value)?'Unavailable':index===2?`${(value/1000).toFixed(1)}s`:`${value.toFixed(0)}°`;
  const change=(difference:number|null,index:number)=>{
    if(difference===null)return '—';
    if(difference===0)return 'Same';
    if(Math.abs(difference)<(index===2?100:1))return index===2?'<0.1s':'<1°';
    return `${difference>0?'+':''}${index===2?(difference/1000).toFixed(1):difference.toFixed(0)}${index===2?'s':'°'}`;
  };
  return <section aria-label="Saved personal reference"><h3>Your session reference</h3><label>Reference rep <select aria-label="Saved reference rep" value={key(reference)} onChange={event=>setReferenceKey(event.target.value)}>{reps.map(rep=><option key={key(rep)} value={key(rep)}>{`Rep ${reps.indexOf(rep)+1}`} · View {Number(rep.viewEpoch)+1}</option>)}</select></label>
    <p className="fine">{current?`Rep ${reps.indexOf(current)+1} compared with Rep ${reps.indexOf(reference)+1}.`:'Play or inspect a completed rep to compare.'} Consistency with your own rep, not a universal standard.{current&&!sameView?' View changed; differences are withheld.':''}</p>
    <table style={{width:'100%',fontSize:'.82rem'}}><thead><tr><th scope="col">Measure</th><th scope="col">Reference</th><th scope="col">Current rep</th><th scope="col">Change</th></tr></thead><tbody>{['Bottom knee bend','Bottom chest angle','Rep time'].map((label,index)=>{const difference=a[index]!==null&&b[index]!==null&&sameView?(Number(b[index])-Number(a[index])):null;return <tr key={label}><th scope="row">{label}</th><td>{show(a[index],index)}</td><td>{show(b[index],index)}</td><td>{change(difference,index)}</td></tr>;})}</tbody></table><p className="fine">Knee values come from retained rep evidence; chest values use the nearest saved sample within 250 ms in the same view. Missing values remain unavailable.</p>
  </section>;
}
function LiveReplay({ session, focusRequest, onReturnToList }: { session: SavedSession; focusRequest: number; onReturnToList: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null), video = useRef<HTMLVideoElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({block: 'start'}); }, [focusRequest]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!session.video) { setUrl(null); return; } const own = URL.createObjectURL(session.video); setUrl(own); return () => URL.revokeObjectURL(own); }, [session.video]);
  const poseReplay=useSavedPoseReplay(session,video,url);
  const live = session.live;
  const notes = useMemo(() => (live?.notes ?? []).filter(isSavedPoint), [live]);
  const reps = useMemo(()=>(live?.reps??[]).filter(isSavedPoint).slice().sort((a,b)=>Number(a.startMs??a.bottomMs??0)-Number(b.startMs??b.bottomMs??0)),[live]);
  const noteRep = (note:SavedPoint)=>reps.find(rep=>matchesRep(note,rep,reps));
  const labelRep = (rep:SavedPoint|undefined,fallback:unknown='Session')=>rep?`Rep ${reps.indexOf(rep)+1}`:String(fallback).replace(/^rep-/,'Rep ');
  const reviewedCount = reps.filter(rep=>notes.some(note=>matchesRep(note,rep,reps))).length;
  const momentsByNote = useMemo(()=>notes.map(note=>citedMoments(note,reps.find(rep=>matchesRep(note,rep,reps)))),[notes,reps]);
  const reviews = useMemo(() => (live?.repReviews ?? []).filter(isSavedPoint), [live]);
  const pendingReviews = reviews.filter(review=>review.state==='queued'||review.state==='analyzing').length;
  const heartbeat=live?.queueHeartbeatAt;
  const queueUnconfirmed=pendingReviews>0&&(typeof heartbeat!=='number'||!Number.isFinite(heartbeat)||Date.now()-heartbeat>15000||heartbeat>Date.now()+5000);
  const samples = useMemo(() => (live?.samples ?? []).filter(isSavedPoint), [live]);
  const [seconds, setSeconds] = useState(0), [rate,setRate] = useState(1);
  const [decodeError, setDecodeError] = useState(false);
  const [sampleIndex,setSampleIndex] = useState(0), [selectedNote,setSelectedNote] = useState<number | null>(null);
  const [followVideo,setFollowVideo] = useState(true);
  const [chosenRepKey,setChosenRepKey] = useState<string|null>(null), [showAllNotes,setShowAllNotes] = useState(false);
  const followRef = useRef(true), initialized = useRef(false);
  const [mediaReady,setMediaReady] = useState(false);
  const [decodedDuration,setDecodedDuration] = useState<number | null>(null);
  const declaredDuration = Number(live?.recording?.durationMs)/1000;
  const duration = Number.isFinite(declaredDuration)&&declaredDuration>0 ? Math.min(declaredDuration,decodedDuration??Infinity) : decodedDuration;
  const sample = samples[sampleIndex];
  const mapping = live?.timing?.firstSampleMapping;
  const mappingValid = !!mapping && typeof mapping==='object' && !Array.isArray(mapping) &&
    typeof mapping.analysisTimestampMs==='number' && Number.isFinite(mapping.analysisTimestampMs) && mapping.analysisTimestampMs>=0 &&
    typeof mapping.recordingElapsedMs==='number' && Number.isFinite(mapping.recordingElapsedMs) && mapping.recordingElapsedMs>=0;
  const offsetMs = mappingValid ? Number(mapping.recordingElapsedMs)-Number(mapping.analysisTimestampMs) : null;
  const approximateTime = (timestamp:unknown):number|null => {
    if(typeof timestamp!=='number'||!Number.isFinite(timestamp)||offsetMs===null)return null;
    const target=(timestamp+offsetMs)/1000;
    return Number.isFinite(target)&&target>=0&&duration!==null&&target<=duration ? target : null;
  };
  // Archive samples are sparse. Never interpolate geometry/values or bridge a view change.
  const sampleAt = (time:number) => {
    if(offsetMs===null||!Number.isFinite(time)||time<0||duration===null||time>duration)return -1;
    const timestamp=time*1000-offsetMs;
    const valid=samples.map((item,index)=>({item,index})).filter(({item})=>typeof item.timestampMs==='number'&&Number.isFinite(item.timestampMs));
    if(!valid.length||timestamp<Number(valid[0].item.timestampMs))return -1;
    const before=valid.filter(({item})=>Number(item.timestampMs)<=timestamp).at(-1);
    const after=valid.find(({item})=>Number(item.timestampMs)>=timestamp);
    if(before&&after&&before.index!==after.index&&
      (before.item.viewEpoch!==after.item.viewEpoch||Number(after.item.timestampMs)-Number(before.item.timestampMs)>750))return -1;
    const nearest=!before?after:!after?before:timestamp-Number(before.item.timestampMs)<=Number(after.item.timestampMs)-timestamp?before:after;
    return nearest&&typeof nearest.item.viewEpoch==='number'&&Math.abs(Number(nearest.item.timestampMs)-timestamp)<=250?nearest.index:-1;
  };
  const setFollowing = (value:boolean) => {followRef.current=value;setFollowVideo(value);};
  const syncVideo = (time:number) => {
    setSeconds(time);
    if(!followRef.current)return;
    const mapped=offsetMs===null?null:time*1000-offsetMs;
    const atRep=mapped===null?undefined:reps.find(rep=>timedRep(rep)&&mapped>=Number(rep.startMs)&&mapped<=Number(rep.endMs));
    setChosenRepKey(atRep?repKey(atRep):null);
    const index=sampleAt(time);setSampleIndex(index);
    setSelectedNote(null); // Automatic relevance is derived below from the mapped rep interval, not proximity to a note.
  };
  const jump = (timestamp:unknown) => {
    const target=approximateTime(timestamp);
    if(target!==null&&video.current&&!decodeError){video.current.pause();video.current.currentTime=target;setSeconds(target);return true;}
    return false;
  };
  const inspectSample = (index:number) => {
    const point=samples[index];if(!point)return;
    setSelectedNote(null);setFollowing(false);setSampleIndex(index);
    // A mapped timeline selection moves the video too; outside the prefix it stays explicitly independent.
    if(jump(point.timestampMs)){setFollowing(true);setSampleIndex(index);}
  };
  const inspectNote = (note:SavedPoint,index:number) => {
    const rep=noteRep(note);setChosenRepKey(rep?repKey(rep):null);
    setFollowing(false);setSelectedNote(index);
    if(typeof note.timestampMs==='number'&&samples.length){
      const eligible=samples.map((item,i)=>({item,i})).filter(({item})=>typeof item.timestampMs==='number'&&item.viewEpoch===note.viewEpoch);
      if(eligible.length){const nearest=eligible.reduce((a,b)=>Math.abs(Number(a.item.timestampMs)-Number(note.timestampMs))<=Math.abs(Number(b.item.timestampMs)-Number(note.timestampMs))?a:b);setSampleIndex(Math.abs(Number(nearest.item.timestampMs)-Number(note.timestampMs))<=250?nearest.i:-1);}else setSampleIndex(-1);
    } else setSampleIndex(-1);
    if(jump(note.timestampMs))setFollowing(true);
  };
  // Open near the first completed rep rather than the warm-up/initial tracking gap.
  useEffect(()=>{
    if(initialized.current||!video.current||!mediaReady)return;
    initialized.current=true;
    const reps=(live?.reps??[]).filter(isSavedPoint);
    const firstRep=reps.find(rep=>approximateTime(rep.bottomMs)!==null);
    const firstUsable=samples.find(point=>point.analysisEligible!==false&&approximateTime(point.timestampMs)!==null&&
      metricDefinitions.some(([key])=>{const metrics=point.metrics as SavedPoint|undefined;const validity=point.metricValidity as Record<string,{status?:string}>|undefined;return metrics&&typeof metrics[key]==='number'&&Number.isFinite(metrics[key])&&validity?.[key]?.status!=='unavailable';}));
    const target=firstRep?.bottomMs??firstUsable?.timestampMs;
    if(target!==undefined&&jump(target)){if(firstRep)setChosenRepKey(repKey(firstRep));syncVideo(video.current.currentTime);}
    else if(mappingValid)syncVideo(video.current.currentTime);
    else setFollowing(false);
  },[mediaReady,decodedDuration,live]);
  const analysisTime=offsetMs!==null?seconds*1000-offsetMs:null;
  const playingRep=followVideo&&sample&&sample.analysisEligible!==false&&analysisTime!==null?reps.find(rep=>timedRep(rep)&&rep.viewEpoch===sample.viewEpoch&&analysisTime>=Number(rep.startMs)&&analysisTime<=Number(rep.endMs)):undefined;
  const playingNoteIndex=playingRep?notes.findIndex(note=>matchesRep(note,playingRep,reps)):-1;
  const reviewRep=playingRep??(video.current?.paused?reps.find(rep=>repKey(rep)===chosenRepKey):undefined);
  const highlightedNote=reviewRep?notes.findIndex(note=>matchesRep(note,reviewRep,reps)):followVideo?playingNoteIndex:selectedNote;
  const prominentNote=highlightedNote!==null&&highlightedNote>=0?highlightedNote:!reps.some(timedRep)&&notes.length?0:-1;
  const reviewRepIndex=reviewRep?reps.indexOf(reviewRep):-1;
  // Bottom evidence may be retained between sparse archive samples; use a bounded playhead window.
  const currentPhase=playingRep&&analysisTime!==null?(Math.abs(analysisTime-Number(playingRep.bottomMs))<=Math.min(150,(Number(playingRep.endMs)-Number(playingRep.startMs))/6)?'Bottom':analysisTime<Number(playingRep.bottomMs)?'Descent':'Ascent'):null;
  const activeMoments=playingNoteIndex>=0?momentsByNote[playingNoteIndex].filter(moment=>moment.phase===currentPhase):[];
  const activeMoment=activeMoments.filter(moment=>moment.timestampMs<=Number(analysisTime)+250).at(-1)??activeMoments[0];
  const reviewRows=[...reps.map(rep=>({rep,review:reviews.find(review=>matchesRep(review,rep,reps))})),...reviews.filter(review=>!reps.some(rep=>matchesRep(review,rep,reps))).map(review=>({rep:undefined,review}))];
  const seekRep=(rep:SavedPoint)=>{setChosenRepKey(repKey(rep));setShowAllNotes(false);setFollowing(true);setSelectedNote(null);if(jump(rep.bottomMs)&&video.current)syncVideo(video.current.currentTime);};
  const canReview=(rep:SavedPoint|undefined)=>!!rep&&timedRep(rep)&&approximateTime(rep.bottomMs)!==null&&!!url&&!decodeError;
  return <section className="saved-live replay-reveal" aria-label="Saved live session">
    <div className="replay-heading"><div><p className="eyebrow">SAVED LIVE SESSION</p><h2 ref={heading} tabIndex={-1}>{session.title}</h2><p className="fine">{date(session.createdAt)} · {reps.length} reps detected · {notes.length} saved AI {notes.length===1?'review':'reviews'} · {samples.length} saved samples</p></div><button onClick={onReturnToList}>Back to saved sessions</button></div>
    <div className="replay-workspace">
      <div className="replay-player-column">
        {url ? <div className="stage replay-stage"><video ref={video} src={url} controls playsInline aria-label="Saved live recording" onLoadedMetadata={event=>{const value=event.currentTarget.duration;setDecodedDuration(Number.isFinite(value)?value:null);setMediaReady(true);event.currentTarget.playbackRate=rate;}} onError={() => setDecodeError(true)} onTimeUpdate={event => syncVideo(event.currentTarget.currentTime)} onSeeking={event=>{setFollowing(true);syncVideo(event.currentTarget.currentTime);}} onSeeked={event=>syncVideo(event.currentTarget.currentTime)} onPlay={event=>{setFollowing(true);syncVideo(event.currentTarget.currentTime);}} />{poseReplay.canvas}</div> : <div className="replay-no-video"><h3>Measurements are saved.</h3><p>No video was saved for this session. You can still inspect the notes and measurements below.</p></div>}
        {decodeError && <p role="alert" className="error">This browser cannot play the saved recording. Download the original video to open it in a compatible player; measurements and notes remain available.</p>}
        {poseReplay.controls}
        <div className="replay-controls"><p className="replay-clock">{replayTime(seconds)} <span>/ {duration!==null?replayTime(duration):'—'} recorded</span></p><label>Playback <select aria-label="Saved recording playback speed" value={rate} disabled={!url||decodeError} onChange={event=>{const value=Number(event.target.value);setRate(value);if(video.current)video.current.playbackRate=value;}}><option value={1}>1×</option><option value={0.5}>0.5×</option><option value={0.25}>0.25×</option></select></label></div>
        <p className="fine replay-timing">Live coaching and archived measurements use the original session clock; their recording alignment is approximate. The optional pose overlay is separately analyzed from this saved video.</p>
        <section className="replay-current-cue" aria-label="Saved coaching at playhead"><p className="coaching-stamp">{playingRep?`${labelRep(playingRep)} · ${currentPhase}`:'Replay coaching'} · approximate recording alignment</p>{activeMoment?<><p className="replay-note-focus">{activeMoment.text.length>180?`${activeMoment.text.slice(0,177)}…`:activeMoment.text}</p><p className="fine">Saved observation cites analysis {(activeMoment.timestampMs/1000).toFixed(2)}s{approximateTime(activeMoment.timestampMs)!==null?` · video ≈${approximateTime(activeMoment.timestampMs)!.toFixed(2)}s`:''}. Open Why for full context.</p></>:<p>{!followVideo?'Resume playback to follow saved coaching.':playingRep?playingNoteIndex>=0?'A review is saved for this rep; no cited observation was saved for this phase.':`${labelRep(playingRep)} has no saved AI review. The measurements remain available.`:sample?'Play within a detected rep to follow its saved coaching.':'No reliable saved sample at this video moment; coaching alignment is paused.'}</p>}</section>

      </div>
      <section className="replay-notes" aria-label="Saved coaching notes"><div className="replay-panel-heading"><h3>Saved coaching</h3><span className="replay-count">{notes.length} {notes.length===1?'note':'notes'}</span></div><p className="fine">Review one rep, then open Why for its explanation.</p>{reviewRows.length>0&&<section aria-label="Rep review progress"><p className="replay-coverage" role="status">{reviewedCount} of {reps.length} detected reps have saved coaching.</p>{queueUnconfirmed&&<p role="status">Review progress is unconfirmed. The original live-session page may be closed or paused; these are the last saved states. Return to that tab to check. Automatic resume is not available.</p>}{pendingReviews>0&&<p className="fine">Keep the original live-session page open while reviews finish. Closing it interrupts the queue. This review shows saved progress; it does not start new AI requests.</p>}<div className="replay-rep-navigation" role="group" aria-label="Choose a saved rep"><button disabled={!canReview(reps[reviewRepIndex-1])} onClick={()=>seekRep(reps[reviewRepIndex-1])}>Previous rep</button><span>{reviewRep?`${labelRep(reviewRep)} of ${reps.length}`:'Choose a rep'}</span><button disabled={!canReview(reps[reviewRepIndex+1])} onClick={()=>seekRep(reps[reviewRepIndex+1])}>Next rep</button></div><ol className="replay-rep-list" aria-label="Detected reps and review statuses">{reviewRows.map(({rep,review},index)=>{const savedNote=rep?notes.find(note=>matchesRep(note,rep,reps)):undefined;const state=review?String(review.state):savedNote?'ready':'not-saved';const status=({queued:'Queued',analyzing:'Analyzing',ready:'Ready',failed:'Failed',cancelled:'Cancelled','not-queued':'Not queued','not-saved':'No saved AI review'} as Record<string,string>)[state]??'Status unavailable';return <li key={rep?repKey(rep):String(review?.repKey??index)} data-playing={rep===reviewRep}><button aria-label={`Review ${labelRep(rep,review?.repId)}${rep?` in view ${Number(rep.viewEpoch)+1}`:''}`} aria-pressed={!!rep&&rep===reviewRep} disabled={!canReview(rep)} onClick={()=>rep&&seekRep(rep)}>{labelRep(rep,review?.repId)}</button><span className="fine">{status}</span></li>;})}</ol><details className="replay-review-details"><summary>Review status details</summary>{reviewRows.map(({rep,review},index)=><p key={index}><b>{labelRep(rep,review?.repId)}</b>: {String(review?.message??(rep&&notes.some(note=>matchesRep(note,rep,reps))?'Saved coaching available.':'No reason was saved; older sessions may not include review status.'))}{rep&&timedRep(rep)?` · Analysis ${(Number(rep.startMs)/1000).toFixed(2)}–${(Number(rep.endMs)/1000).toFixed(2)}s · View ${Number(rep.viewEpoch)+1}`:''}</p>)}</details></section>}{!notes.length&&<p>{pendingReviews?'Rep reviews are still processing. Saved measurements are available now.':'No AI review was saved for this session. Detected reps and measurements are still available below.'}</p>}
        {reviewRep&&prominentNote<0&&<p className="replay-selected-empty" role="status">{labelRep(reviewRep)} has no saved coaching yet. Its review status is shown above.</p>}
        {notes.length>1&&<button className="replay-all-notes" aria-expanded={showAllNotes} onClick={()=>setShowAllNotes(value=>!value)}>{showAllNotes?'Show selected rep only':`Show all ${notes.length} saved notes`}</button>}
        <RepFilmstrip images={session.evidenceImages} rep={reviewRep} toVideo={approximateTime} onJump={timestamp=>{setFollowing(true);jump(timestamp);}}/>
        <ol className="coaching-feed">{notes.map((note,i)=><li key={i} hidden={!showAllNotes&&prominentNote!==i} className="coaching-card" data-selected={highlightedNote===i} style={{order:prominentNote===i?-1:0}}><p className="coaching-stamp">{labelRep(noteRep(note),note.repId)}{approximateTime(note.timestampMs)!==null?` · video ≈${replayTime(approximateTime(note.timestampMs)!)}`:' · saved note'}</p><p className="replay-note-focus">{String(note.text??'Saved review').slice(0,177)}{String(note.text??'').length>177?'…':''}</p><button className="replay-note-action" aria-pressed={highlightedNote===i} onClick={()=>inspectNote(note,i)}>{approximateTime(note.timestampMs)!==null?`Review near ${replayTime(approximateTime(note.timestampMs)!)}`:'Inspect saved measurements'}</button>{approximateTime(note.timestampMs)!==null&&<span className="fine"> Approximate video time</span>}<details><summary>Why</summary><p className="fine">Original analysis {typeof note.timestampMs==='number'?`${(note.timestampMs/1000).toFixed(2)}s`:'time unavailable'} · View {typeof note.viewEpoch==='number'?note.viewEpoch+1:'unknown'}. Video alignment is approximate.</p><p>{String(note.text??'')}</p><SavedReason result={note.result}/></details>{momentsByNote[i].length>0&&<details><summary>Cited moments</summary><ol className="replay-cited-moments">{momentsByNote[i].map((moment,index)=><li key={`${moment.observationIndex}:${moment.timestampMs}:${index}`} data-current={highlightedNote===i&&moment.timestampMs===activeMoment?.timestampMs&&moment.observationIndex===activeMoment?.observationIndex}><p><b>{moment.phase}</b> · analysis {(moment.timestampMs/1000).toFixed(2)}s{approximateTime(moment.timestampMs)!==null?` · video ≈${approximateTime(moment.timestampMs)!.toFixed(2)}s`:''}</p><p>{moment.text}</p>{approximateTime(moment.timestampMs)!==null&&<button onClick={()=>{setFollowing(true);jump(moment.timestampMs);}}>See cited moment</button>}</li>)}</ol></details>}<SavedEvidence images={session.evidenceImages.filter(image=>image.repKey===note.repKey&&image.viewEpoch===note.viewEpoch)}/></li>)}</ol>
      </section>
      <div className="replay-trace-section"><SavedTrace samples={samples} reps={reps} cursor={followVideo?analysisTime:sample?Number(sample.timestampMs):null} onInspect={inspectSample}/><RepExampleGraph samples={samples} rep={reviewRep} label={reviewRep?labelRep(reviewRep):''}/></div>
        <section className="replay-metrics" aria-label="Saved measurement inspector"><div className="replay-panel-heading"><h3>Inspect a moment</h3><span className="fine">{followVideo&&mappingValid?'Following video · approximate':'Independent saved-sample inspection'}</span></div>
          {sample ? <><p className="fine">Original analysis {(Number(sample.timestampMs)/1000).toFixed(2)}s · view {typeof sample.viewEpoch==='number'?sample.viewEpoch+1:'—'} · {String(sample.phase??'—')}</p><div className="replay-metric-strip">{metricDefinitions.slice(0,3).map(([key,label,unit])=>{
            const metrics=(sample.metrics??{}) as Record<string,unknown>, validity=(sample.metricValidity??{}) as Record<string,{status?:string;reason?:string}>;
            const value=metrics[key], quality=validity[key];const usable=sample.analysisEligible!==false&&typeof value==='number'&&Number.isFinite(value)&&quality?.status!=='unavailable';
            return <div key={key}><span>{label}</span><strong>{usable?`${(value as number).toFixed(1)}${unit}`:'—'}</strong>{!usable&&<small>{quality?.reason?.replaceAll('_',' ')??'Unavailable'}</small>}</div>;
          })}</div><label className="replay-sample-slider">Saved measurement timeline<input type="range" min={0} max={Math.max(0,samples.length-1)} value={sampleIndex} disabled={samples.length<2} aria-valuetext={`Original analysis ${Number(sample.timestampMs)} milliseconds, sample ${sampleIndex+1} of ${samples.length}`} onChange={event=>inspectSample(Number(event.target.value))} /></label><div className="toolbar"><button disabled={sampleIndex===0} onClick={()=>inspectSample(sampleIndex-1)}>Previous moment</button><button disabled={sampleIndex>=samples.length-1} onClick={()=>inspectSample(sampleIndex+1)}>Next moment</button>{approximateTime(sample.timestampMs)!==null&&<button disabled={!url||decodeError} onClick={()=>inspectSample(sampleIndex)}>Show approximate video moment</button>}</div><p className="fine">{followVideo&&mappingValid?'Nearby saved samples follow playback and seeking using the approximate recording map. Gaps and view changes show no measurement.':'This sample is being inspected independently; no reliable recording-time association is available.'}</p></> : <div><p>{samples.length?(followVideo?'No saved measurement near this video moment in a continuous view.':'No saved measurements are close enough to this note in the same view.'):'No measurement samples were stored. The saved video and notes remain available.'}</p>{samples.length>0&&<button onClick={()=>inspectSample(0)}>Browse saved measurements</button>}</div>}
        </section>
    </div>
    <LiveReference live={live} sample={sample}/>
    <div className="replay-details"><details><summary>Recording details and downloads</summary><p className="fine">{String(live?.timing?.timingNote??'Recording may cover only part of the session.')}{live?.recording?.durationMs?` Recorded duration ${(Number(live.recording.durationMs)/1000).toFixed(1)}s.`:''}{session.metadata?.sessionDurationMs?` Session duration ${(Number(session.metadata.sessionDurationMs)/1000).toFixed(1)}s.`:''}</p><SessionDownloads session={session}/></details>
      {!notes.length&&<SavedEvidence images={session.evidenceImages}/>}
      <details><summary>Saved measurements ({samples.length} samples)</summary><p className="fine">Recorded estimates and validity states, not independently calibrated joint angles.</p><div className="history-table"><table><thead><tr><th>Analysis time</th><th>View / phase</th><th>Measurements</th></tr></thead><tbody>{samples.map((point,i)=><tr key={i}><td><button onClick={()=>inspectSample(i)} aria-label={`Inspect saved sample at ${String(point.timestampMs)} ms`}>{String(point.timestampMs)} ms</button></td><td>{typeof point.viewEpoch==='number'?point.viewEpoch+1:'—'} / {String(point.phase??'—')}</td><td><SavedMetrics sample={point}/></td></tr>)}</tbody></table></div></details>
    </div>
  </section>;
}

export function History({ initialSessionId, onOpenRecorded, onBack, onDelete }: { initialSessionId: string | null; onOpenRecorded: (session: SavedSession) => void; onBack: () => void; onDelete: (id:string) => void }) {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listSessions>>>([]);
  const importInput=useRef<HTMLInputElement>(null),portableRequest=useRef<AbortController|null>(null);
  const [transferStatus,setTransferStatus]=useState(''),[transferError,setTransferError]=useState('');
  const [demoManifest,setDemoManifest]=useState<{bundle:string;title:string}|null>(null);
  useEffect(()=>{const own=new AbortController();void fetch('/demo/session.json',{signal:own.signal,cache:'no-store',redirect:'error'}).then(async response=>{if(!response.ok)return;const manifest=await response.json();if(!own.signal.aborted&&manifest?.version===1&&typeof manifest.bundle==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.moveide\.json$/.test(manifest.bundle))setDemoManifest({bundle:manifest.bundle,title:typeof manifest.title==='string'?manifest.title.slice(0,80):'Recorded demo'});}).catch(()=>{});return()=>{own.abort();portableRequest.current?.abort();};},[]);

  const [selected, setSelected] = useState<SavedSession | null>(null);
  const [search, setSearch] = useState(''); const [kind, setKind] = useState('all');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(true);
  const [confirmation, setConfirmation] = useState<string | null>(null); const [rename, setRename] = useState<string | null>(null); const [title, setTitle] = useState('');
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageStatus>> | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [reviewRefresh,setReviewRefresh] = useState(0), [reviewRefreshStatus,setReviewRefreshStatus] = useState('');
  const selectedRef=useRef(selected);selectedRef.current=selected;
  const preservePlayback = (current:SavedSession|null,incoming:SavedSession) => current?.id===incoming.id&&current.revision>incoming.revision ? current : current?.id===incoming.id&&current.videoSha256===incoming.videoSha256 ? {...incoming,video:current.video} : incoming;
  const requestedSession = useRef<string | null>(initialSessionId);
  const openGeneration = useRef(0);
  const [detailFocus, setDetailFocus] = useState(0);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const openButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusList = () => { requestAnimationFrame(() => { listHeading.current?.focus(); listHeading.current?.scrollIntoView({block: 'start'}); }); };
  const focusSession = (id:string) => requestAnimationFrame(() => openButtons.current.get(id)?.focus());
  const backToList = () => { requestedSession.current=null; openGeneration.current++; setBusy(false); setSelected(null); window.history.replaceState(null,'',`${window.location.pathname}#history`); focusList(); };
  useEffect(() => { if(rename) { renameInput.current?.focus(); renameInput.current?.select(); } }, [rename]);
  const alive = useRef(true); useEffect(() => { alive.current=true; return()=>{alive.current=false;}; }, []);
  useEffect(() => { let disposed=false; setBusy(true); setError(null); Promise.all([listSessions(),storageStatus()]).then(([items,state])=>{if(!disposed){setSessions(items);setStorage(state);}},e=>{if(!disposed)setError(message(e));}).finally(()=>{if(!disposed)setBusy(false);}); return()=>{disposed=true;}; },[refresh]);
  // Metadata-only polling avoids repeatedly reading/hashing recordings when nothing changed.
  // A changed revision is verified through getSession; immutable video bytes keep their existing URL.
  useEffect(()=>{
    const id=selected?.kind==='live'?selected.id:null;if(!id)return;
    let disposed=false, finished=false, inFlight=false, timer:ReturnType<typeof setTimeout>|undefined;
    const deadline=Date.now()+10*60*1000;
    setReviewRefreshStatus('Checking for saved review updates.');
    const poll=async()=>{
      if(disposed||finished||inFlight)return;
      if(Date.now()>=deadline){setReviewRefreshStatus('Automatic refresh paused. Check for updates to continue.');return;}
      if(document.hidden){timer=setTimeout(poll,2000);return;}
      inFlight=true;
      try{
        const items=await listSessions();if(disposed||requestedSession.current!==id)return;
        setSessions(items);
        const summary=items.find(item=>item.id===id);
        if(!summary){finished=true;setReviewRefreshStatus('This session was removed from local history. The open replay remains available temporarily.');return;}
        const current=selectedRef.current;
        if(current?.id===id&&summary.revision>current.revision){
          if(summary.contentRevision===current.contentRevision){
            setSelected(previous=>{
              if(previous?.id!==id||summary.revision<=previous.revision||summary.contentRevision!==previous.contentRevision)return previous;
              const live=previous.live?{...previous.live}:null;
              if(live){if(summary.queueHeartbeatAt===null)delete live.queueHeartbeatAt;else live.queueHeartbeatAt=summary.queueHeartbeatAt;}
              return {...previous,revision:summary.revision,updatedAt:summary.updatedAt,queueHeartbeatAt:summary.queueHeartbeatAt,live};
            });
          }else{
          const updated=await getSession(id);
          if(disposed||requestedSession.current!==id)return;
          if(updated)setSelected(previous=>previous?.id===id&&updated.revision>previous.revision?preservePlayback(previous,updated):previous);
          }
        }
        setReviewRefreshStatus('Saved reviews update automatically while this page is visible.');
      }catch(error){if(!disposed)setReviewRefreshStatus(`Could not refresh saved reviews: ${message(error)}`);}
      finally{inFlight=false;if(!disposed&&!finished&&requestedSession.current===id)timer=setTimeout(poll,2000);}
    };
    const visible=()=>{if(!document.hidden){clearTimeout(timer);void poll();}};
    void poll();document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
  },[selected?.id,reviewRefresh]);
  const open = async (id:string) => {
    requestedSession.current=id; const generation=++openGeneration.current; setError(null); setBusy(true);
    try {
      const item=await getSession(id);
      if(!alive.current || generation!==openGeneration.current)return;
      if(!item)throw Error('This saved session is no longer available.');
      if(item.kind==='recorded'&&item.report&&item.video)onOpenRecorded(item);
      else { setSelected(item); setDetailFocus(value=>value+1); window.history.replaceState(null,'',`?session=${encodeURIComponent(id)}#history`); }
    } catch(e) { if(alive.current && generation===openGeneration.current)setError(message(e)); }
    finally { if(alive.current && generation===openGeneration.current)setBusy(false); }
  };
  const importPortable=async(file?:File)=>{
    portableRequest.current?.abort();const own=new AbortController();portableRequest.current=own;
    openGeneration.current++;requestedSession.current=null;setBusy(true);setTransferError('');setTransferStatus(file?'Checking session file…':'Loading demo session…');
    try{
      let blob:Blob;
      if(file)blob=file;
      else{
        if(!demoManifest)throw Error('The demo session is not available.');
        const response=await fetch(`/demo/${demoManifest.bundle}`,{signal:own.signal,redirect:'error'});
        if(!response.ok)throw Error('The demo session could not be loaded. Please try again.');
        const limit=200*1024*1024,total=Number(response.headers.get('content-length'));
        if(total>limit)throw Error('This demo file is larger than the 200 MiB import limit.');
        if(!response.body)throw Error('This browser could not read the demo file. Import a downloaded session instead.');
        const reader=response.body.getReader(),chunks:Uint8Array<ArrayBuffer>[]= [];let received=0;
        try{while(true){const next=await reader.read();own.signal.throwIfAborted();if(next.done)break;received+=next.value.byteLength;if(received>limit)throw Error('This demo file is larger than the 200 MiB import limit.');chunks.push(next.value as Uint8Array<ArrayBuffer>);if(alive.current)setTransferStatus(`Loading demo session · ${bytes(received)}${total>0?` of ${bytes(total)}`:''}`);}}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
        blob=new Blob(chunks,{type:'application/json'});
      }
      own.signal.throwIfAborted();setTransferStatus('Checking and saving this session on this computer…');
      const id=await importSessionBundle(blob);
      if(own.signal.aborted||!alive.current)return;
      setTransferStatus('Session imported. The original recording and saved notes are ready.');setRefresh(value=>value+1);await open(id);
    }catch(error){if(!own.signal.aborted&&alive.current){setTransferError(message(error));setTransferStatus('');}}
    finally{if(portableRequest.current===own&&alive.current){setBusy(false);portableRequest.current=null;}if(importInput.current)importInput.current.value='';}
  };
  useEffect(() => { if(initialSessionId)void open(initialSessionId); },[initialSessionId]);
  const remove = async (id:string) => {setBusy(true);try{await deleteSession(id);onDelete(id);setConfirmation(null);if(selected?.id===id)backToList();setRefresh(v=>v+1);focusList();}catch(e){setError(message(e));}finally{setBusy(false);}};
  const renameSession = async(id:string) => {if(!title.trim())return;setBusy(true);try{const updated=await saveSession({id,title:title.trim()});if(selected?.id===id)setSelected(previous=>preservePlayback(previous,updated));setRename(null);setRefresh(v=>v+1);focusSession(id);}catch(e){setError(message(e));}finally{setBusy(false);}};
  const matching=sessions.filter(item=>(kind==='all'||item.kind===kind)&&`${item.title} ${date(item.createdAt)} ${item.kind} ${item.repCount} reps`.toLowerCase().includes(search.toLowerCase()));
  return <section className="history" aria-label="Session history"><div className="toolbar"><h1 ref={listHeading} tabIndex={-1}>Saved sessions.</h1><button onClick={onBack}>Back to recording</button></div><p>{privacy}</p>
    <p className="fine">Local storage is not a cloud backup. Private browsing and browser storage limits can prevent saving or remove data.</p>
    {storage && <p className="fine">{storage.available ? `This app uses ${bytes(storage.appBytes)} of its ${bytes(storage.maxAppBytes)} local limit. ${storage.persisted ? 'Browser persistence is enabled.' : 'Browser storage may be cleared under storage pressure.'}` : `Storage unavailable: ${storage.error?.message ?? 'This browser cannot save sessions.'}`}</p>}
    {error && <div role="alert" className="error">{error} <button onClick={()=>{setRefresh(v=>v+1);if(requestedSession.current)void open(requestedSession.current);}}>Retry history</button></div>}
    <div className="toolbar"><button disabled={busy} onClick={()=>importInput.current?.click()}>Import session</button><input ref={importInput} type="file" accept="application/json,.json" aria-label="Choose a MoveIDE session file" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void importPortable(file);}}/>{demoManifest&&<button disabled={busy} onClick={()=>void importPortable()} title={demoManifest.title}>Open demo session</button>}</div><p className="fine">Import a full session file to review its original video and saved coaching. It creates a new copy here; no new AI review is requested.</p>{transferStatus&&<p role="status">{transferStatus}</p>}{transferError&&<p role="alert" className="error">Import failed: {transferError}</p>}
    <div className="toolbar"><label>Search sessions <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title, date or reps" /></label><label>Session type <select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All sessions</option><option value="recorded">Recorded</option><option value="live">Live</option></select></label></div>
    {busy&&<p role="status">Loading saved sessions…</p>}{!busy&&!matching.length&&!error&&<p>No saved sessions match. Start a squat with “Save on this device” enabled.</p>}
    <ul className="history-list">{matching.map(item=><li key={item.id} className="history-card"><h2>{item.title}</h2><p className="fine">{date(item.createdAt)} · {item.kind==='live'?'Live':'Recorded'} · {item.repCount} reps · {item.hasVideo?bytes(item.videoBytes):'No saved video'}{item.durationMs != null ? ` · ${(item.durationMs/1000).toFixed(1)}s video` : ''}{item.model ? ` · ${item.model.replace('mediapipe-pose-landmarker-','MediaPipe ')}` : ''}{item.hasCoaching?' · AI notes saved':''}</p><div className="toolbar"><button ref={node=>{if(node)openButtons.current.set(item.id,node);else openButtons.current.delete(item.id);}} disabled={busy} onClick={()=>void open(item.id)}>Open {item.title}</button><button disabled={busy} onClick={()=>{setRename(item.id);setTitle(item.title);}}>Rename</button><button disabled={busy} onClick={()=>setConfirmation(item.id)}>Delete</button></div>
      {rename===item.id&&<form className="toolbar" onSubmit={e=>{e.preventDefault();void renameSession(item.id);}}><label>Session title <input ref={renameInput} value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required /></label><button disabled={busy} type="submit">Save title</button><button type="button" onClick={()=>{setRename(null);focusSession(item.id);}}>Cancel rename</button></form>}
      {confirmation===item.id&&<div role="group" aria-label="Confirm session deletion"><p>Delete “{item.title}” and its video, measurements and saved notes from this browser?</p><button disabled={busy} onClick={()=>void remove(item.id)}>Delete this session</button> <button autoFocus onClick={()=>{setConfirmation(null);focusSession(item.id);}}>Keep session</button></div>}
    </li>)}</ul>{selected&&<><div className="toolbar"><p className="fine" role="status">{reviewRefreshStatus}</p><button onClick={()=>setReviewRefresh(value=>value+1)}>Check for newer reviews</button></div><LiveReplay key={selected.id} session={selected} focusRequest={detailFocus} onReturnToList={backToList}/></>}</section>;
}
