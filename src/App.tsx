import { useEffect, useMemo, useRef, useState } from 'react';
import { mountCoachConnection } from '../harness/ui/coach-connection.mjs';
import { mountQuickTour } from '../harness/ui/quick-tour.mjs';
import type { AnalysisReport, Measurement, MotionTraceSample } from '../harness/motion/analyze.mjs';
import { getMotionTrace } from '../harness/motion/analyze.mjs';
import { drawSquatOverlay, overlayFrameAt } from '../harness/motion/overlay.mjs';
import { analyze, type PoseModel } from './analyze.ts';
import { Compare } from './Compare.tsx';
import { CompareRecordings } from './CompareRecordings.tsx';
import { History, SessionDownloads, download } from './History.tsx';
import type { SavedSession } from './History.tsx';
import { createSessionId, saveSession } from '../harness/history/index.mjs';
import { bindReportSource } from '../harness/motion/source-identity.mjs';
import sampleUrl from '../fixtures/squat/clear-squat.mp4';
import { prepareCoachingBundle, getCoachingSegments, coachingSegmentAt } from '../harness/coaching/index.mjs';
import type { CoachingBundle, CoachingResponse, CoachingSegment } from '../harness/coaching/index.mjs';
import { chatGPTProvider } from '../harness/provider/client.mjs';
import { Home } from './Home';

type SavedCoach = { packet: CoachingBundle['packet']; response: CoachingResponse; segments: CoachingSegment[] };
type SaveDraft = { id: string; title: string; video: Blob; videoName: string; createdAt: number; report?: AnalysisReport; coaching?: SavedCoach; queue: Promise<unknown>; persisted?: boolean };
type Status = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error';

const METRIC_LABEL: Record<Measurement['metric'], string> = {
  knee_flexion: 'Depth (knee bend)', rep_duration: 'Rep time', torso_lean: 'Chest angle',
};
const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const repName = (id: string) => id.replace(/^rep-/, 'Rep ');
const fmt = (m: Measurement & { quality: 'usable' }) => (m.unit === 'deg' ? `${m.value.toFixed(0)}°` : sec(m.value));
const deg = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}°`);
const shortCue = (segment: CoachingSegment, response: CoachingResponse) => {
  const text = segment.hasNextFocus ? response.nextFocus.text
    : response.observations[segment.observationIndices[0]]?.text ?? 'Review this rep’s cited evidence.';
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
};

export function App() {
  useEffect(() => mountQuickTour({ surface: 'recorded' }), []);
  const coachHeader = useRef<HTMLDivElement>(null);
  const stopForCoach = useRef<() => void>(() => {});
  useEffect(() => coachHeader.current ? mountCoachConnection(coachHeader.current, { onState: setConnection, onDisconnect: () => stopForCoach.current() }) : undefined, []);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [clip, setClip] = useState<{ name: string; src: string; blob: Blob } | null>(null);
  const [model, setModel] = useState<PoseModel>('heavy');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [historyMode, setHistoryMode] = useState(() => window.location.hash === '#history' || new URLSearchParams(window.location.search).has('session'));
  const [homeMode, setHomeMode] = useState(() => !window.location.hash && !new URLSearchParams(window.location.search).has('session'));
  const [historySessionId, setHistorySessionId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('session'));
  const [saveEnabled, setSaveEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const saveDraft = useRef<SaveDraft | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [sampleMs, setSampleMs] = useState<number | null>(null); // analyzed sample under the playhead
  const [rate, setRate] = useState(1);

  useEffect(() => { if (video.current) video.current.playbackRate = rate; }, [rate, clip]);
  const [connection, setConnection] = useState('unknown');
  const [active, setActive] = useState(false);
  const [mediaMs, setMediaMs] = useState(0);
  const [furthestMs, setFurthestMs] = useState(0);
  const [coachStatus, setCoachStatus] = useState('');
  const [coaching, setCoaching] = useState<{ bundle: CoachingBundle; response: CoachingResponse; segments: CoachingSegment[] } | null>(null);
  const sampleRequest = useRef<AbortController | null>(null);
  const sessionRequest = useRef<AbortController | null>(null);
  const playbackGeneration = useRef(0);
  const focusSavedReplay = useRef(false);

  const clearOverlay = () => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
  };

  const invalidateSession = () => {
    playbackGeneration.current++;
    saveDraft.current = null; setSavedSession(null); setSaveStatus(''); setSaveFailed(false);
    sampleRequest.current?.abort();
    sessionRequest.current?.abort();
    sessionRequest.current = new AbortController();
    clearOverlay();
    setCoaching(null); setMediaMs(0); setFurthestMs(0); setReport(null); setSampleMs(null);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    chatGPTProvider.getConnection(ctrl.signal).then((c) => { if (!ctrl.signal.aborted) setConnection(c.state); }, () => { if (!ctrl.signal.aborted) setConnection('service offline'); });
    return () => { ctrl.abort(); sampleRequest.current?.abort(); sessionRequest.current?.abort(); };
  }, []);

  // Release the old clip's object URL whenever the clip changes or the app unmounts.
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.src); }, [clip]);

  const persist = (draft: SaveDraft) => {
    if (!draft.report) return;
    const data = { id: draft.id, kind: 'recorded' as const, title: draft.title, createdAt: draft.createdAt, video: draft.video, report: draft.report,
      coaching: draft.coaching ?? null, metadata: { videoName: draft.videoName, durationMs: draft.report.clip.durationMs, model: draft.report.poseModel.id } };
    if (saveDraft.current === draft) { setSaveStatus('Saving on this device…'); setSaveFailed(false); }
    // Serialize initial report and accepted coaching writes under this immutable source/session ID.
    draft.queue = draft.queue.catch(() => {}).then(() => saveSession(draft.persisted ? { id: draft.id, coaching: data.coaching } : data)).then(saved => {
      draft.persisted = true;
      if (saveDraft.current === draft) { setSavedSession(saved); setSaveStatus('Saved on this device'); setSaveFailed(false); }
    }, failure => {
      if (saveDraft.current === draft) { setSaveStatus(`Could not save locally: ${failure instanceof Error ? failure.message : String(failure)}. Analysis remains available. Download or retry before leaving.`); setSaveFailed(true); }
    });
  };

  // One analysis per clip + model; a newer clip or model aborts the old run so a late result can't land.
  useEffect(() => {
    if (!clip || !active) return;
    const ctrl = new AbortController();
    const signal = AbortSignal.any([ctrl.signal, sessionRequest.current!.signal]);
    setReport(null); setSelected(null); setSampleMs(null); setError(null); setProgress(0);
    setStatus('analyzing');
    analyze(clip.src, { signal, model, onProgress: (p) => !signal.aborted && setProgress(p) }).then(
      (r) => { if (!signal.aborted) { setReport(r); setStatus('ready'); const draft = saveDraft.current; if (draft && draft.video === clip.blob) { draft.report = r; persist(draft); } } },
      (e) => { if (!signal.aborted) { setStatus('error'); setError(`Analysis failed: ${e?.message ?? e}`); setCoachStatus('We couldn’t read this video, so nothing was sent to your coach.'); } },
    );
    return () => ctrl.abort();
  }, [clip, model, active]);

  // One bounded interpretation per completed recorded report. Playback never triggers inference.
  useEffect(() => {
    if (!active || !report || !clip) return;
    const ctrl = new AbortController();
    const signal = AbortSignal.any([ctrl.signal, sessionRequest.current!.signal]);
    setCoachStatus('Checking your ChatGPT coach…');
    void video.current?.play().catch(() => { /* Native Play remains available if autoplay is blocked. */ });
    void (async () => {
      try {
        const state = await chatGPTProvider.getConnection(signal);
        signal.throwIfAborted(); setConnection(state.state);
        if (state.state !== 'connected') { setCoachStatus('Connect ChatGPT for coach notes.'); return; }
        if (!report.reps.length) { setCoachStatus('Coach notes need one full rep.'); return; }
        setCoachStatus('Picking the key moments for your coach…');
        const bundle = await prepareCoachingBundle(report, clip.src, { repIds: report.reps.slice(0, 2).map((r) => r.id), signal });
        signal.throwIfAborted();
        if (!bundle.images.length || bundle.unavailableImages.length || !bundle.packet.measurements.length) {
          setCoachStatus('No clear moments for coach notes.'); return;
        }
        const models = await chatGPTProvider.listModels(signal);
        signal.throwIfAborted();
        const coachModel = models.find((m) => m.id === 'gpt-6.1-sol') ?? models[0];
        if (!coachModel) { setCoachStatus('ChatGPT coach is unavailable right now.'); return; }
        setCoachStatus(`Coach reviewing ${bundle.packet.repIds.map(repName).join(' and ')}… your numbers are already below.`);
        const response = await chatGPTProvider.interpret(bundle.packet, bundle.images, { model: coachModel.id, signal });
        signal.throwIfAborted();
        const segments = getCoachingSegments(response, bundle.packet, report);
        setCoaching({ bundle, response, segments });
        const draft = saveDraft.current; if (draft?.report === report) { draft.coaching = { packet: bundle.packet, response, segments }; persist(draft); }
        setCoachStatus('Coach notes ready · play the video to see each rep’s note.');
      } catch (e) {
        if (!signal.aborted) setCoachStatus('Can’t reach your ChatGPT coach right now. Your numbers are still below.');
      }
    })();
    return () => ctrl.abort();
  }, [active, report, clip]);

  const open = (file: File | undefined) => {
    if (!file) return;
    setComparisonMode(false); setHistoryMode(false); setHistorySessionId(null); enterReview();
    invalidateSession(); setActive(true); setCoachStatus('Reading your squat…');
    if (saveEnabled) saveDraft.current = { id: createSessionId(), title: file.name.replace(/\.[^.]+$/, ''), video: file, videoName: file.name, createdAt: Date.now(), queue: Promise.resolve() };
    setClip({ name: file.name, src: URL.createObjectURL(file), blob: file });
  };

  const enterReview = () => { setHomeMode(false); window.history.replaceState(null, '', `${window.location.pathname}#review`); };
  const openSample = async () => {
    setComparisonMode(false); setHistoryMode(false); enterReview();
    invalidateSession(); setClip(null); setActive(true); setError(null);
    const ctrl = new AbortController(); sampleRequest.current = ctrl;
    setStatus('loading');
    try {
      const response = await fetch(sampleUrl, { signal: ctrl.signal });
      if (!response.ok) throw new Error('Sample unavailable');
      const blob = await response.blob();
      if (ctrl.signal.aborted || sampleRequest.current !== ctrl) return;
      open(new File([blob], 'clear-squat.mp4', { type: 'video/mp4' })); // same path as an import
    } catch {
      if (ctrl.signal.aborted) return;
      setStatus('error'); setError('Couldn’t load the built-in sample.');
    }
  };

  const onDecodeError = () => {
    invalidateSession(); setActive(false);
    setClip(null); setReport(null); setStatus('error');
    setError('This browser can’t decode that video.');
  };

  const stop = () => {
    sampleRequest.current?.abort(); sessionRequest.current?.abort();
    video.current?.pause(); clearOverlay(); setActive(false);
    setStatus(report ? 'ready' : 'idle');
    setCoachStatus(coaching ? 'Stopped · your coach notes stay below.' : 'Stopped · nothing more will be sent to your coach.');
  };

  stopForCoach.current = stop;

  const connect = async () => {
    stop();
    try {
      const result = await chatGPTProvider.startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (e) { setCoachStatus('Couldn’t open ChatGPT setup. Try again in a moment.'); }
  };

  const showHistory = () => { stop(); setComparisonMode(false); setHistorySessionId(null); setHomeMode(false); setHistoryMode(true); window.history.replaceState(null, '', `${window.location.pathname}#history`); };
  const closeHistory = () => { setHistoryMode(false); setHistorySessionId(null); enterReview(); };
  const compareExamples = () => { enterReview(); stop(); invalidateSession(); setClip(null); setStatus('idle'); setError(null); setCoachStatus('Comparing a good-form and a bad-form squat side by side.'); setComparisonMode(true); };
  const openSaved = (saved: SavedSession) => {
    if (!saved.report || !saved.video) return;
    stop(); invalidateSession(); setComparisonMode(false); setHistoryMode(false); setHistorySessionId(null); setHomeMode(false);
    const src = URL.createObjectURL(saved.video);
    focusSavedReplay.current = true;
    bindReportSource(saved.report, src); // getSession verified the persisted original video's SHA before this association.
    setClip({ name: String(saved.metadata?.videoName ?? saved.title), src, blob: saved.video });
    setReport(saved.report); setActive(false); setStatus('ready'); setError(null); setSavedSession(saved); setSaveStatus('Saved on this device');
    setModel(saved.report.poseModel.id.includes('heavy') ? 'heavy' : 'full');
    if (saved.coaching) {
      try { const {packet,response}=saved.coaching; const segments=getCoachingSegments(response,packet,saved.report); setCoaching({bundle:{packet,images:[],unavailableImages:[]},response,segments}); setFurthestMs(saved.report.clip.durationMs); }
      catch { setCoachStatus('Saved video and measurements restored. Stored coaching could not be validated.'); window.history.replaceState(null, '', `?session=${encodeURIComponent(saved.id)}`); return; }
    }
    setCoachStatus('Saved session restored. Replaying stored numbers and notes.');
    window.history.replaceState(null, '', `?session=${encodeURIComponent(saved.id)}`);
  };
  useEffect(() => {
    const route = () => { const hash = window.location.hash; if (!hash && !new URLSearchParams(window.location.search).has('session')) { stop(); setHistoryMode(false); setHomeMode(true); return; } if (hash === '#review') { setHistoryMode(false); setHomeMode(false); return; } setHomeMode(false); if (window.location.hash === '#history' || new URLSearchParams(window.location.search).has('session')) { stop(); setHistorySessionId(new URLSearchParams(window.location.search).get('session')); setHistoryMode(true); } };
    window.addEventListener('hashchange', route); window.addEventListener('popstate', route);
    return () => { window.removeEventListener('hashchange', route); window.removeEventListener('popstate', route); };
  }, []);

  useEffect(() => {
    if (!historyMode && clip && report && focusSavedReplay.current && video.current) {
      focusSavedReplay.current = false;
      video.current.focus(); video.current.scrollIntoView({block: 'start'});
    }
  }, [historyMode, clip, report]);

  // Overlay: one clock (the video's mediaTime). Redraw on every presented frame, on seek, and on resize.
  useEffect(() => {
    const v = video.current, c = canvas.current;
    clearOverlay();
    if (!v || !c || !report) return;
    const ctx = c.getContext('2d')!;
    const generation = playbackGeneration.current;
    const draw = (mediaTimeS: number) => {
      if (generation !== playbackGeneration.current) return;
      const dpr = devicePixelRatio, width = v.clientWidth, height = v.clientHeight;
      if (c.width !== width * dpr || c.height !== height * dpr) { c.width = width * dpr; c.height = height * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame = overlayFrameAt(report.frames, Math.round(mediaTimeS * 1000));
      setMediaMs(Math.round(mediaTimeS * 1000));
      setFurthestMs(previous => Math.max(previous, Math.round(mediaTimeS * 1000)));
      setSampleMs(frame ? frame.timestampMs : null);
      drawSquatOverlay(ctx, frame, { side: report.protocol.side, videoWidth: v.videoWidth, videoHeight: v.videoHeight, width, height });
    };
    let handle = 0;
    const onFrame = (_: number, meta: VideoFrameCallbackMetadata) => { draw(meta.mediaTime); handle = v.requestVideoFrameCallback(onFrame); };
    handle = v.requestVideoFrameCallback(onFrame);
    const redraw = () => draw(v.currentTime);
    const ro = new ResizeObserver(redraw);
    ro.observe(v);
    v.addEventListener('seeked', redraw);
    v.addEventListener('loadeddata', redraw);
    redraw();
    return () => { v.cancelVideoFrameCallback(handle); ro.disconnect(); v.removeEventListener('seeked', redraw); v.removeEventListener('loadeddata', redraw); clearOverlay(); };
  }, [report, historyMode, comparisonMode]);

  const trace = useMemo(() => (report ? getMotionTrace(report) : []), [report]);
  const here: MotionTraceSample | undefined = trace.find((s) => s.timestampMs === sampleMs);

  const seek = (ms: number) => {
    const v = video.current;
    if (v) { v.pause(); v.currentTime = ms / 1000; }
  };
  const step = (dir: -1 | 1) => {
    const v = video.current;
    if (!v || !report) return;
    const now = Math.round(v.currentTime * 1000);
    const ts = report.frames.map((f) => f.timestampMs);
    const next = dir > 0 ? ts.find((t) => t > now) : ts.filter((t) => t < now).pop();
    if (next !== undefined) seek(next);
  };
  // Arrow keys step analyzed samples (overriding the native 5 s seek) unless a form control has focus.
  useEffect(() => {
    if (!report || historyMode || comparisonMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if ((e.target as HTMLElement).closest?.('input, select, textarea')) return;
      e.preventDefault(); e.stopPropagation();
      step(e.key === 'ArrowLeft' ? -1 : 1);
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }); // re-bind each render so step sees the current report

  const openEvidence = (m: Measurement) => {
    setSelected(m.id);
    if (m.quality === 'usable') seek(m.evidenceTimestampMs);
  };

  const sel = report?.measurements.find((m) => m.id === selected);
  const tracked = report?.frames.filter((f) => f.quality === 'usable').length ?? 0;
  const cue = coaching ? coachingSegmentAt(coaching.segments, mediaMs) : null;
  // Keep reviews encountered in source order, including when AI arrives after playback.
  // A backward seek/replay cannot remove or duplicate an already accepted card.
  const acceptedCues = coaching?.segments.filter(segment => segment.startMs <= furthestMs) ?? [];
  const displayedCue = cue ?? acceptedCues.at(-1) ?? null;
  const citationTimes = new Map(coaching ? [
    ...coaching.bundle.packet.measurements.map(item => [item.id, item.evidenceTimestampMs] as const),
    ...coaching.bundle.packet.evidence.map(item => [item.id, item.timestampMs] as const),
  ] : []);
  const citedTimes = (ids: string[]) => [...new Set(ids.map(id => citationTimes.get(id)).filter((time): time is number => time !== undefined))].sort((a, b) => a - b);

  return (
    <main>
      <header className="moveide-header">
        <a className="wordmark" href="/" aria-label="MoveIDE home" onClick={event => { event.preventDefault(); stop(); setHistoryMode(false); setHomeMode(true); window.history.replaceState(null, '', window.location.pathname); }}><img className="moveide-mark" src="/moveide-mark.svg" width="36" height="36" alt="" aria-hidden="true" />MOVE<span>IDE</span></a>
        <nav aria-label="Session source" className="source-nav">
          <a href="#review" aria-current={!historyMode && !homeMode ? "page" : undefined} onClick={event => { event.preventDefault(); closeHistory(); }}>Recorded clip</a>
          <a href="/harness/live/">Live camera</a>
          <a href="#history" aria-current={historyMode ? "page" : undefined} onClick={event => { event.preventDefault(); showHistory(); }}>History</a>
        </nav>
        <div ref={coachHeader} />
      </header>

      {homeMode ? <Home onSample={openSample} onCompare={compareExamples} /> : historyMode ? <History initialSessionId={historySessionId} onOpenRecorded={openSaved} onBack={closeHistory} onDelete={id => { if(savedSession?.id===id) { setSavedSession(null); setSaveStatus('Deleted from history. Current video and analysis remain available until you replace them.'); } }} /> : <>
      <section className="intro">
        <div>
          <h1>Review a recorded squat.</h1>
        </div>
        <div className="actions">
          <div className="toolbar">
            <label className="button">
              Upload a video
              <input type="file" accept="video/*" onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {!active && <label className="model-select">
              Analysis{' '}
              <select value={model} onChange={(e) => { invalidateSession(); setModel(e.target.value as PoseModel); }} disabled={active}>
                <option value="heavy">Detailed</option>
                <option value="full">Faster</option>
              </select>
            </label>}
          </div>
          {!active && <><label className="save-preference"><input type="checkbox" checked={saveEnabled} onChange={event => setSaveEnabled(event.target.checked)} /> Save on this device</label>
          <p className="start-disclosure">ChatGPT sees stills and numbers, not the video.</p></>}
          <div className="toolbar">
            <button className="primary" onClick={openSample}>Try a sample squat</button>
            <button onClick={compareExamples}>Compare examples</button>
            {active && <button onClick={stop}>Stop session</button>}
            {clip && connection !== 'connected' && <button onClick={connect}>Connect ChatGPT coach</button>}
          </div>
          <span role="status" className="fine">
            {status === 'loading' && 'Loading video…'}
            {status === 'analyzing' && <>Reading your squat <progress value={progress} /> {Math.round(progress * 100)}%</>}
            {status === 'ready' && `Ready: ${clip?.name === 'clear-squat.mp4' ? 'sample squat' : clip?.name}`}
          </span>
        </div>
      </section>
      <p role="status" aria-live="polite" className="fine">{coachStatus}</p>

      {saveStatus && <div className="save-status" role="status"><p>{saveStatus}</p>{saveFailed && <div className="toolbar"><button onClick={() => { if(saveDraft.current) persist(saveDraft.current); }}>Retry save</button>{clip && <button onClick={() => download(clip.blob, clip.name)}>Download unsaved video</button>}{report && <button onClick={() => download(new Blob([JSON.stringify({report,coaching:coaching ? {packet:coaching.bundle.packet,response:coaching.response,segments:coaching.segments}:null},null,2)],{type:'application/json'}),'unsaved-analysis.json')}>Download unsaved analysis</button>}</div>}{savedSession && !active && <SessionDownloads session={savedSession} />}</div>}
      {error && <p role="alert" className="error">{error} Try another video — an MP4 from your phone usually works.</p>}

      {comparisonMode ? <CompareRecordings model={model} onClose={() => { setComparisonMode(false); setCoachStatus(''); }} /> : <>
      <div className="workbench">
        <div className="stage">
          {clip && (
            <video ref={video} key={clip.src} src={clip.src} aria-label={`Squat replay: ${clip.name}`} controls playsInline muted onError={onDecodeError} />
          )}
          
          <canvas ref={canvas} aria-hidden />
          {coaching && displayedCue && <div aria-label="Playback AI cue" className="cue">
            <small>{cue ? 'Coach note · this rep' : 'Coach note · earlier rep'} · {repName(displayedCue.repId)}</small>
            <p>{shortCue(displayedCue, coaching.response)}</p>
          </div>}
        </div>

        {report && (
          <aside>
            <details><summary className="muted">{tracked === report.frames.length ? 'Tracking clear ✓'
                : `⚠ Lost sight of you in ${report.frames.length - tracked} of ${report.frames.length} samples. Those numbers are skipped.`}</summary><p>{tracked}/{report.frames.length} analyzed samples tracked · up to 15 Hz · {report.poseModel.id} v{report.poseModel.version}. Sampling coverage is not joint-angle accuracy.</p></details>
            <div className="toolbar">
              <button title="Or press ←" onClick={() => step(-1)}>◀ Frame</button>
              <button title="Or press →" onClick={() => step(1)}>Frame ▶</button>
              <label>Speed{' '}
                <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  {[1, 0.5, 0.25].map((r) => <option key={r} value={r}>{r}×</option>)}
                </select>
              </label>
            </div>
            {report.reps.length > 0 && (
              <div className="toolbar">
                {report.reps.map((r) => (
                  <span key={r.id} className="phases">
                    {repName(r.id)} ▸{' '}
                    <button aria-label={`${repName(r.id)} start at ${sec(r.startMs)}`} onClick={() => seek(r.startMs)}>Start</button>
                    <button aria-label={`${repName(r.id)} bottom at ${sec(r.bottomMs)}`} onClick={() => seek(r.bottomMs)}>Bottom</button>
                    <button aria-label={`${repName(r.id)} stand at ${sec(r.endMs)}`} onClick={() => seek(r.endMs)}>Stand</button>
                  </span>
                ))}
              </div>
            )}
            <p className="readout">
              {here ? (
                <>
                  {here.repId ? repName(here.repId) : 'Between reps'}{here.phase && `, ${({ descent: 'going down', bottom: 'bottom', ascent: 'coming up' })[here.phase]}`}, {sec(here.timestampMs)}<br />
                  Knee bend {deg(here.kneeFlexionDeg)}, hip hinge {deg(here.hipFlexionDeg)}, chest angle {deg(here.torsoLeanDeg)}
                </>
              ) : 'No reliable measurement for this moment.'}
            </p>

            <Trace trace={trace} reps={report.reps} playheadMs={sampleMs} onSeek={seek} />
            <PersonalReference key={`${report.clip.id}|${report.poseModel.id}`} report={report} currentRepId={here?.repId ?? sel?.repId ?? null} onSeek={seek} />

            <details open={report.reps.length < 2}><summary><h2>Your numbers</h2></summary>
            {report.measurements.length === 0 && <p>We didn’t find a full squat rep in this video.</p>}
            <ul>
              {report.measurements.map((m) => (
                <li key={m.id}>
                  {m.quality === 'usable' ? (
                    <button aria-pressed={m.id === selected} onClick={() => openEvidence(m)}>
                      {m.repId && `${repName(m.repId)}: `}{METRIC_LABEL[m.metric]} <b>{fmt(m)}</b>
                      <small> ▸ See the moment</small>
                    </button>
                  ) : (
                    <span className="muted">{m.repId && `${repName(m.repId)}: `}{METRIC_LABEL[m.metric]}, couldn’t measure</span>
                  )}
                </li>
              ))}
            </ul></details>
            {sel?.quality === 'usable' && (
              <p className="readout">
                {METRIC_LABEL[sel.metric]} <b>{fmt(sel)}</b> at {sec(sel.evidenceTimestampMs)} <span className="muted" title="Estimated from one camera angle; not a clinical measurement.">ⓘ estimate</span>
              </p>
            )}
            {report.warnings.map((w) => <p key={w.code} className="warning">⚠ {w.message}</p>)}
          </aside>
        )}
      </div>

      {coaching && (
        <section aria-label="Coach notes" className="readout">
          <h2>Coach notes</h2>
          <p className="muted">One tip per rep. Open Why to see what it’s based on.</p>
          {!acceptedCues.length && <p>Play the video. Each rep’s note appears here as you reach it.</p>}
          <ol className="coaching-feed" aria-label="Coach notes" aria-live="polite">
            {acceptedCues.map(segment => <li key={segment.repId} data-rep-id={segment.repId} className="coaching-card">
              <p className="coaching-stamp">{repName(segment.repId)} · {(segment.startMs / 1000).toFixed(1)}–{(segment.endMs / 1000).toFixed(1)} s{cue?.repId === segment.repId ? ' · playing now' : ''}</p>
              <p className="coaching-focus">{shortCue(segment, coaching.response)}</p>
              <details>
                <summary>Why</summary>
                {segment.observationIndices.map(i => <p key={i}>{coaching.response.observations[i].text} <small className="muted">[Seen at {citedTimes(coaching.response.observations[i].evidenceIds).map(sec).join(', ')}]</small></p>)}
                {segment.hasNextFocus && <p><b>Next focus:</b> {coaching.response.nextFocus.text} <small className="muted">[Seen at {citedTimes(coaching.response.nextFocus.evidenceIds).map(sec).join(', ')}]</small></p>}
                <p className="muted">What the coach couldn’t tell: {coaching.response.uncertainty}</p>
                <div className="toolbar">{citedTimes([
                  ...segment.observationIndices.flatMap(i => coaching.response.observations[i].evidenceIds),
                  ...(segment.hasNextFocus ? coaching.response.nextFocus.evidenceIds : []),
                ]).map(ms => <button key={ms} aria-label={`See the moment at ${sec(ms)}`} onClick={() => seek(ms)}>▸ See the moment · {sec(ms)}</button>)}</div>
              </details>
            </li>)}
          </ol>
        </section>
      )}

      {report && clip && <Compare key={`${clip.src}|${report.poseModel.id}`} report={report} clipSrc={clip.src} onSeek={seek} />}
      </>}

      </>}
      <footer>
        {(comparisonMode || clip?.name === 'clear-squat.mp4') && <details className="fine">
          <summary>Sample video source</summary>
          <small>
            Subjects 010 and 004 from <i>A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels</i> v3,
            Prashanth et al. <a href="https://doi.org/10.17632/kgbb3yn47p.3">Dataset</a>. Licensed{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Trimmed and re-encoded.
          </small>
        </details>}
      </footer>
    </main>
  );
}

// Knee-flexion and torso-lean traces over analyzed samples. Untracked samples break the line, so gaps stay visible.
function Trace({ trace, reps, playheadMs, onSeek }: {
  trace: MotionTraceSample[]; reps: AnalysisReport['reps']; playheadMs: number | null; onSeek: (ms: number) => void;
}) {
  if (trace.length < 2) return null;
  const W = 320, H = 120, t0 = trace[0].timestampMs, t1 = trace[trace.length - 1].timestampMs;
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
  const y = (deg: number) => H - (Math.max(0, Math.min(180, deg)) / 180) * H;
  const path = (get: (s: MotionTraceSample) => number | null) => {
    let d = '', pen = false;
    for (const s of trace) {
      const v = get(s);
      if (v === null) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${x(s.timestampMs).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    }
    return d;
  };
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), t = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0);
    const near = trace.reduce((a, b) => (Math.abs(b.timestampMs - t) < Math.abs(a.timestampMs - t) ? b : a));
    onSeek(near.timestampMs);
  };
  return (
    <figure className="trace">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Knee bend and chest angle over time" onClick={click}>
        {reps.map((r) => <rect key={r.id} x={x(r.startMs)} width={x(r.endMs) - x(r.startMs)} y={0} height={H} className="rep" />)}
        {reps.map((r) => <line key={r.id} x1={x(r.bottomMs)} x2={x(r.bottomMs)} y1={0} y2={H} className="bottom" />)}
        <path d={path((s) => s.kneeFlexionDeg)} className="knee" />
        <path d={path((s) => s.torsoLeanDeg)} className="torso" />
        {playheadMs !== null && <line x1={x(playheadMs)} x2={x(playheadMs)} y1={0} y2={H} className="playhead" />}
      </svg>
      <figcaption><span className="knee">— knee bend</span>, <span className="torso">— chest angle</span>. Shaded areas are reps. Tap to jump.</figcaption>
    </figure>
  );
}


function PersonalReference({report,currentRepId,onSeek}:{report:AnalysisReport;currentRepId:string|null;onSeek:(ms:number)=>void}) {
  const [referenceId,setReferenceId]=useState(report.reps[0]?.id??'');
  const [chosenId,setChosenId]=useState('');
  const reference=report.reps.find(rep=>rep.id===referenceId)??report.reps[0];
  const compared=report.reps.find(rep=>rep.id===(chosenId||currentRepId))??report.reps[0];
  if(!reference||!compared)return <p className="muted">A complete rep is needed for a personal reference.</p>;
  const rows=[['knee_flexion','Bottom knee bend'],['torso_lean','Bottom chest angle'],['rep_duration','Rep time']] as const;
  const value=(rep:AnalysisReport['reps'][number],metric:Measurement['metric'])=>{
    const item=report.measurements.find(measure=>measure.repId===rep.id&&measure.metric===metric);
    if(item?.quality!=='usable'||!Number.isFinite(item.value))return null;
    if(metric!=='rep_duration'&&(item.evidenceTimestampMs!==rep.bottomMs||report.frames.find(frame=>frame.timestampMs===rep.bottomMs)?.quality!=='usable'))return null;
    return item.value;
  };
  const show=(number:number|null,metric:Measurement['metric'])=>number===null?'Unavailable':metric==='rep_duration'?`${(number/1000).toFixed(1)}s`:`${number.toFixed(0)}°`;
  const change=(a:number|null,b:number|null,metric:Measurement['metric'])=>{
    if(a===null||b===null)return '—';
    const raw=b-a;
    if(raw===0)return 'Same';
    if(Math.abs(raw)<(metric==='rep_duration'?100:1))return metric==='rep_duration'?'<0.1s':'<1°';
    const difference=metric==='rep_duration'?Math.round(raw/100)/10:Math.round(raw);
    return `${difference>0?'+':''}${difference}${metric==='rep_duration'?'s':'°'}`;
  };
  return <section className="readout" aria-label="Personal rep reference"><h3>Your reference</h3><div className="reference-choices"><div className="recording-reps" role="group" aria-label="Reference rep"><span className="recording-reps-label">Reference rep</span>{report.reps.map(rep=><button type="button" key={rep.id} aria-pressed={reference.id===rep.id} onClick={()=>setReferenceId(rep.id)}>{repName(rep.id)}</button>)}</div><div className="recording-reps" role="group" aria-label="Compare reference with rep"><span className="recording-reps-label">Compare rep</span><button type="button" aria-pressed={chosenId===''} onClick={()=>setChosenId('')}>Playing rep</button>{report.reps.map(rep=><button type="button" key={rep.id} aria-pressed={chosenId===rep.id} onClick={()=>setChosenId(rep.id)}>{repName(rep.id)}</button>)}</div></div>
    <table style={{width:'100%',fontSize:'.82rem'}}><thead><tr><th scope="col">Measure</th><th scope="col">{repName(reference.id)} reference</th><th scope="col">{repName(compared.id)} comparison</th><th scope="col">Change</th></tr></thead><tbody>{rows.map(([metric,label])=>{const a=value(reference,metric),b=value(compared,metric);return <tr key={metric}><th scope="row">{label}</th><td>{show(a,metric)}</td><td>{show(b,metric)}</td><td>{change(a,b,metric)}</td></tr>;})}</tbody></table>
    <p className="muted">The first complete rep is the default reference. This compares consistency within this video, not a universal good squat. Small changes may reflect measurement noise.</p><button onClick={()=>onSeek(reference.bottomMs)}>See reference bottom</button>
  </section>;
}
