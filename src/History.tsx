import { useEffect, useRef, useState } from 'react';
import './index.css';
import { deleteSession, exportSessionData, getSession, listSessions, saveSession, storageStatus } from '../harness/history/index.mjs';
export type SavedSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
const privacy = 'Saved only in this browser on this computer and this app address. Phone sessions are stored on the receiving computer. Clearing site data removes history; downloads are your backup.';
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const date = (value: number) => new Date(value).toLocaleString();
const bytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MB`;
export function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function SessionDownloads({ session }: { session: SavedSession }) {
  return <div className="toolbar"><button disabled={!session.video} onClick={() => session.video && download(session.video, String(session.metadata?.videoName ?? `${session.title}.${session.video.type.includes('mp4') ? 'mp4' : 'webm'}`))}>Download original video</button><button onClick={() => { const data = exportSessionData(session); download(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}), `${session.title}-analysis.json`); }}>Download analysis JSON</button></div>;
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
function LiveReplay({ session, focusRequest, onReturnToList }: { session: SavedSession; focusRequest: number; onReturnToList: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null), video = useRef<HTMLVideoElement>(null);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({block: 'start'}); }, [focusRequest]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!session.video) { setUrl(null); return; } const own = URL.createObjectURL(session.video); setUrl(own); return () => URL.revokeObjectURL(own); }, [session.video]);
  const live = session.live;
  const notes = (live?.notes ?? []).filter(isSavedPoint);
  const samples = (live?.samples ?? []).filter(isSavedPoint);
  const [seconds, setSeconds] = useState(0), [rate,setRate] = useState(1);
  const [decodeError, setDecodeError] = useState(false);
  const [sampleIndex,setSampleIndex] = useState(0), [selectedNote,setSelectedNote] = useState<number | null>(null);
  const [decodedDuration,setDecodedDuration] = useState<number | null>(null);
  const declaredDuration = Number(live?.recording?.durationMs)/1000;
  const duration = Number.isFinite(declaredDuration)&&declaredDuration>0 ? Math.min(declaredDuration,decodedDuration??Infinity) : decodedDuration;
  const sample = samples[sampleIndex];
  const mapping = live?.timing?.firstSampleMapping;
  const approximateTime = (timestamp:unknown):number|null => {
    if(typeof timestamp!=='number'||!Number.isFinite(timestamp)||!mapping||typeof mapping!=='object'||Array.isArray(mapping))return null;
    if(typeof mapping.analysisTimestampMs!=='number'||typeof mapping.recordingElapsedMs!=='number')return null;
    const target=(timestamp-mapping.analysisTimestampMs+mapping.recordingElapsedMs)/1000;
    return Number.isFinite(target)&&target>=0&&duration!==null&&target<=duration ? target : null;
  };
  const jump = (timestamp:unknown) => { const target=approximateTime(timestamp); if(target!==null&&video.current&&!decodeError){ video.current.pause(); video.current.currentTime=target; setSeconds(target); } };
  const inspectNote = (note:SavedPoint,index:number) => {
    setSelectedNote(index);
    if(typeof note.timestampMs==='number'&&samples.length){
      const eligible=samples.map((item,i)=>({item,i})).filter(({item})=>typeof item.timestampMs==='number'&&item.viewEpoch===note.viewEpoch);
      if(eligible.length){const nearest=eligible.reduce((a,b)=>Math.abs(Number(a.item.timestampMs)-Number(note.timestampMs))<=Math.abs(Number(b.item.timestampMs)-Number(note.timestampMs))?a:b);setSampleIndex(Math.abs(Number(nearest.item.timestampMs)-Number(note.timestampMs))<=500?nearest.i:-1);}else setSampleIndex(-1);
    } else setSampleIndex(-1);
    jump(note.timestampMs);
  };
  return <section className="saved-live replay-reveal" aria-label="Saved live session">
    <div className="replay-heading"><div><p className="eyebrow">SAVED LIVE SESSION</p><h2 ref={heading} tabIndex={-1}>{session.title}</h2><p className="fine">{date(session.createdAt)} · {live?.reps?.length ?? 0} completed reps · {samples.length} saved samples</p></div><button onClick={onReturnToList}>Back to saved sessions</button></div>
    <div className="replay-workspace">
      <div className="replay-player-column">
        {url ? <div className="stage replay-stage"><video ref={video} src={url} controls playsInline aria-label="Saved live recording" onLoadedMetadata={event=>{const value=event.currentTarget.duration;setDecodedDuration(Number.isFinite(value)?value:null);event.currentTarget.playbackRate=rate;}} onError={() => setDecodeError(true)} onTimeUpdate={event => setSeconds(event.currentTarget.currentTime)} /></div> : <div className="replay-no-video"><h3>Measurements are saved.</h3><p>No video was saved for this session. You can still inspect the notes and measurements below.</p></div>}
        {decodeError && <p role="alert" className="error">This browser cannot play the saved recording. Download the original video to open it in a compatible player; measurements and notes remain available.</p>}
        <div className="replay-controls"><p className="replay-clock">{replayTime(seconds)} <span>/ {duration!==null?replayTime(duration):'—'} recorded</span></p><label>Playback <select aria-label="Saved recording playback speed" value={rate} disabled={!url||decodeError} onChange={event=>{const value=Number(event.target.value);setRate(value);if(video.current)video.current.playbackRate=value;}}><option value={1}>1×</option><option value={0.5}>0.5×</option><option value={0.25}>0.25×</option></select></label></div>
        <p className="fine replay-timing">Live analysis times use the original session clock; recording alignment is approximate. No frame-exact overlay is applied.</p>

      </div>
      <section className="replay-notes" aria-label="Saved coaching notes"><div className="replay-panel-heading"><h3>Saved coaching</h3><span className="replay-count">{notes.length} {notes.length===1?'note':'notes'}</span></div><p className="fine">Review one rep, then open Why for its explanation.</p>{!notes.length&&<p>No AI review was accepted in this session.</p>}
        <ol className="coaching-feed">{notes.map((note,i)=><li key={i} className="coaching-card" data-selected={selectedNote===i}><p className="coaching-stamp">{String(note.repId??'Session').replace(/^rep-/,'Rep ')} · Observed at {typeof note.timestampMs==='number'?`${(note.timestampMs/1000).toFixed(1)}s`:'an unavailable time'} · View {typeof note.viewEpoch==='number'?note.viewEpoch+1:'unknown'}</p><p className="replay-note-focus">{String(note.text??'Saved review').slice(0,177)}{String(note.text??'').length>177?'…':''}</p><button className="replay-note-action" aria-pressed={selectedNote===i} onClick={()=>inspectNote(note,i)}>{approximateTime(note.timestampMs)!==null?`Review near ${replayTime(approximateTime(note.timestampMs)!)}`:'Inspect saved measurements'}</button>{approximateTime(note.timestampMs)!==null&&<span className="fine"> Approximate video time</span>}<details><summary>Why</summary><p>{String(note.text??'')}</p><SavedReason result={note.result}/></details><SavedEvidence images={session.evidenceImages.filter(image=>image.repKey===note.repKey&&image.viewEpoch===note.viewEpoch)}/></li>)}</ol>
      </section>
        <section className="replay-metrics" aria-label="Saved measurement inspector"><div className="replay-panel-heading"><h3>Inspect a moment</h3><span className="fine">Saved estimates</span></div>
          {sample ? <><p className="fine">Original analysis {(Number(sample.timestampMs)/1000).toFixed(2)}s · view {typeof sample.viewEpoch==='number'?sample.viewEpoch+1:'—'} · {String(sample.phase??'—')}</p><div className="replay-metric-strip">{metricDefinitions.slice(0,3).map(([key,label,unit])=>{
            const metrics=(sample.metrics??{}) as Record<string,unknown>, validity=(sample.metricValidity??{}) as Record<string,{status?:string;reason?:string}>;
            const value=metrics[key], quality=validity[key];const usable=sample.analysisEligible!==false&&typeof value==='number'&&Number.isFinite(value)&&quality?.status!=='unavailable';
            return <div key={key}><span>{label}</span><strong>{usable?`${(value as number).toFixed(1)}${unit}`:'—'}</strong>{!usable&&<small>{quality?.reason?.replaceAll('_',' ')??'Unavailable'}</small>}</div>;
          })}</div><label className="replay-sample-slider">Saved measurement timeline<input type="range" min={0} max={Math.max(0,samples.length-1)} value={sampleIndex} disabled={samples.length<2} aria-valuetext={`Original analysis ${Number(sample.timestampMs)} milliseconds, sample ${sampleIndex+1} of ${samples.length}`} onChange={event=>{setSampleIndex(Number(event.target.value));setSelectedNote(null);}} /></label><div className="toolbar"><button disabled={sampleIndex===0} onClick={()=>{setSampleIndex(value=>value-1);setSelectedNote(null);}}>Previous moment</button><button disabled={sampleIndex>=samples.length-1} onClick={()=>{setSampleIndex(value=>value+1);setSelectedNote(null);}}>Next moment</button>{approximateTime(sample.timestampMs)!==null&&<button disabled={!url||decodeError} onClick={()=>jump(sample.timestampMs)}>Show approximate video moment</button>}</div><p className="fine">Selecting a saved measurement does not imply it matches the current video frame.</p></> : <div><p>{samples.length?'No saved measurements are close enough to this note in the same view.':'No measurement samples were stored. The saved video and notes remain available.'}</p>{samples.length>0&&<button onClick={()=>{setSampleIndex(0);setSelectedNote(null);}}>Browse saved measurements</button>}</div>}
        </section>
    </div>
    <div className="replay-details"><details><summary>Recording details and downloads</summary><p className="fine">{String(live?.timing?.timingNote??'Recording may cover only part of the session.')}{live?.recording?.durationMs?` Recorded duration ${(Number(live.recording.durationMs)/1000).toFixed(1)}s.`:''}{session.metadata?.sessionDurationMs?` Session duration ${(Number(session.metadata.sessionDurationMs)/1000).toFixed(1)}s.`:''}</p><SessionDownloads session={session}/></details>
      {!notes.length&&<SavedEvidence images={session.evidenceImages}/>}
      <details><summary>Saved measurements ({samples.length} samples)</summary><p className="fine">Recorded estimates and validity states, not independently calibrated joint angles.</p><div className="history-table"><table><thead><tr><th>Analysis time</th><th>View / phase</th><th>Measurements</th></tr></thead><tbody>{samples.map((point,i)=><tr key={i}><td><button onClick={()=>{setSampleIndex(i);setSelectedNote(null);}} aria-label={`Inspect saved sample at ${String(point.timestampMs)} ms`}>{String(point.timestampMs)} ms</button></td><td>{typeof point.viewEpoch==='number'?point.viewEpoch+1:'—'} / {String(point.phase??'—')}</td><td><SavedMetrics sample={point}/></td></tr>)}</tbody></table></div></details>
    </div>
  </section>;
}

export function History({ initialSessionId, onOpenRecorded, onBack, onDelete }: { initialSessionId: string | null; onOpenRecorded: (session: SavedSession) => void; onBack: () => void; onDelete: (id:string) => void }) {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listSessions>>>([]);
  const [selected, setSelected] = useState<SavedSession | null>(null);
  const [search, setSearch] = useState(''); const [kind, setKind] = useState('all');
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(true);
  const [confirmation, setConfirmation] = useState<string | null>(null); const [rename, setRename] = useState<string | null>(null); const [title, setTitle] = useState('');
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageStatus>> | null>(null);
  const [refresh, setRefresh] = useState(0);
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
  useEffect(() => { if(initialSessionId)void open(initialSessionId); },[initialSessionId]);
  const remove = async (id:string) => {setBusy(true);try{await deleteSession(id);onDelete(id);setConfirmation(null);if(selected?.id===id)backToList();setRefresh(v=>v+1);focusList();}catch(e){setError(message(e));}finally{setBusy(false);}};
  const renameSession = async(id:string) => {if(!title.trim())return;setBusy(true);try{const updated=await saveSession({id,title:title.trim()});if(selected?.id===id)setSelected(updated);setRename(null);setRefresh(v=>v+1);focusSession(id);}catch(e){setError(message(e));}finally{setBusy(false);}};
  const matching=sessions.filter(item=>(kind==='all'||item.kind===kind)&&`${item.title} ${date(item.createdAt)} ${item.kind} ${item.repCount} reps`.toLowerCase().includes(search.toLowerCase()));
  return <section className="history" aria-label="Session history"><div className="toolbar"><h1 ref={listHeading} tabIndex={-1}>Saved sessions.</h1><button onClick={onBack}>Back to recording</button></div><p>{privacy}</p>
    <p className="fine">Local storage is not a cloud backup. Private browsing and browser storage limits can prevent saving or remove data.</p>
    {storage && <p className="fine">{storage.available ? `This app uses ${bytes(storage.appBytes)} of its ${bytes(storage.maxAppBytes)} local limit. ${storage.persisted ? 'Browser persistence is enabled.' : 'Browser storage may be cleared under storage pressure.'}` : `Storage unavailable: ${storage.error?.message ?? 'This browser cannot save sessions.'}`}</p>}
    {error && <div role="alert" className="error">{error} <button onClick={()=>{setRefresh(v=>v+1);if(requestedSession.current)void open(requestedSession.current);}}>Retry history</button></div>}
    <div className="toolbar"><label>Search sessions <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title, date or reps" /></label><label>Session type <select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All sessions</option><option value="recorded">Recorded</option><option value="live">Live</option></select></label></div>
    {busy&&<p role="status">Loading saved sessions…</p>}{!busy&&!matching.length&&!error&&<p>No saved sessions match. Start a squat with “Save on this device” enabled.</p>}
    <ul className="history-list">{matching.map(item=><li key={item.id} className="history-card"><h2>{item.title}</h2><p className="fine">{date(item.createdAt)} · {item.kind==='live'?'Live':'Recorded'} · {item.repCount} reps · {item.hasVideo?bytes(item.videoBytes):'No saved video'}{item.durationMs != null ? ` · ${(item.durationMs/1000).toFixed(1)}s video` : ''}{item.model ? ` · ${item.model.replace('mediapipe-pose-landmarker-','MediaPipe ')}` : ''}{item.hasCoaching?' · AI notes saved':''}</p><div className="toolbar"><button ref={node=>{if(node)openButtons.current.set(item.id,node);else openButtons.current.delete(item.id);}} disabled={busy} onClick={()=>void open(item.id)}>Open {item.title}</button><button disabled={busy} onClick={()=>{setRename(item.id);setTitle(item.title);}}>Rename</button><button disabled={busy} onClick={()=>setConfirmation(item.id)}>Delete</button></div>
      {rename===item.id&&<form className="toolbar" onSubmit={e=>{e.preventDefault();void renameSession(item.id);}}><label>Session title <input ref={renameInput} value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} required /></label><button disabled={busy} type="submit">Save title</button><button type="button" onClick={()=>{setRename(null);focusSession(item.id);}}>Cancel rename</button></form>}
      {confirmation===item.id&&<div role="group" aria-label="Confirm session deletion"><p>Delete “{item.title}” and its video, measurements and saved notes from this browser?</p><button disabled={busy} onClick={()=>void remove(item.id)}>Delete this session</button> <button autoFocus onClick={()=>{setConfirmation(null);focusSession(item.id);}}>Keep session</button></div>}
    </li>)}</ul>{selected&&<LiveReplay key={selected.id} session={selected} focusRequest={detailFocus} onReturnToList={backToList}/>}</section>;
}
