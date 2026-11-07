import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisReport, Measurement, MotionTraceSample } from '../harness/motion/analyze.mjs';
import { getMotionTrace } from '../harness/motion/analyze.mjs';
import { drawSquatOverlay, overlayFrameAt } from '../harness/motion/overlay.mjs';
import { analyze, type PoseModel } from './analyze.ts';
import { Compare } from './Compare.tsx';
import sampleUrl from '../fixtures/squat/clear-squat.mp4';
import { prepareCoachingBundle, getCoachingSegments, coachingSegmentAt } from '../harness/coaching/index.mjs';
import type { CoachingBundle, CoachingResponse, CoachingSegment } from '../harness/coaching/index.mjs';
import { chatGPTProvider } from '../harness/provider/client.mjs';

type Status = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error';

const METRIC_LABEL: Record<Measurement['metric'], string> = {
  knee_flexion: 'Knee flexion', rep_duration: 'Rep duration', torso_lean: 'Torso lean',
};
const fmt = (m: Measurement & { quality: 'usable' }) => (m.unit === 'deg' ? `${m.value.toFixed(1)}°` : `${m.value} ms`);
const deg = (v: number | null) => (v === null ? 'unavailable' : `${v.toFixed(1)}°`);
const MODEL_LABEL: Record<string, string> = {
  'mediapipe-pose-landmarker-heavy': 'MediaPipe Pose Heavy',
  'mediapipe-pose-landmarker-full': 'MediaPipe Pose Full',
};

export function App() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [clip, setClip] = useState<{ name: string; src: string } | null>(null);
  const [model, setModel] = useState<PoseModel>('heavy');
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
  const [coachStatus, setCoachStatus] = useState('Start a session for local tracking and connected AI coaching.');
  const [coaching, setCoaching] = useState<{ bundle: CoachingBundle; response: CoachingResponse; segments: CoachingSegment[] } | null>(null);
  const sampleRequest = useRef<AbortController | null>(null);
  const sessionRequest = useRef<AbortController | null>(null);

  const clearOverlay = () => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
  };

  const invalidateSession = () => {
    sampleRequest.current?.abort();
    sessionRequest.current?.abort();
    sessionRequest.current = new AbortController();
    clearOverlay();
    setCoaching(null); setMediaMs(0); setReport(null); setSampleMs(null);
  };

  useEffect(() => {
    const ctrl = new AbortController();
    chatGPTProvider.getConnection(ctrl.signal).then((c) => { if (!ctrl.signal.aborted) setConnection(c.state); }, () => { if (!ctrl.signal.aborted) setConnection('service offline'); });
    return () => { ctrl.abort(); sampleRequest.current?.abort(); sessionRequest.current?.abort(); };
  }, []);

  // Release the old clip's object URL whenever the clip changes or the app unmounts.
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.src); }, [clip]);

  // One analysis per clip + model; a newer clip or model aborts the old run so a late result can't land.
  useEffect(() => {
    if (!clip || !active) return;
    const ctrl = new AbortController();
    const signal = AbortSignal.any([ctrl.signal, sessionRequest.current!.signal]);
    setReport(null); setSelected(null); setSampleMs(null); setError(null); setProgress(0);
    setStatus('analyzing');
    analyze(clip.src, { signal, model, onProgress: (p) => !signal.aborted && setProgress(p) }).then(
      (r) => { if (!signal.aborted) { setReport(r); setStatus('ready'); } },
      (e) => { if (!signal.aborted) { setStatus('error'); setError(`Analysis failed: ${e?.message ?? e}`); setCoachStatus('Local analysis failed; no coaching evidence was sent.'); } },
    );
    return () => ctrl.abort();
  }, [clip, model, active]);

  // One bounded interpretation per completed recorded report. Playback never triggers inference.
  useEffect(() => {
    if (!active || !report || !clip) return;
    const ctrl = new AbortController();
    const signal = AbortSignal.any([ctrl.signal, sessionRequest.current!.signal]);
    setCoachStatus('Checking connected coach…');
    void video.current?.play().catch(() => { /* Native Play remains available if autoplay is blocked. */ });
    void (async () => {
      try {
        const state = await chatGPTProvider.getConnection(signal);
        signal.throwIfAborted(); setConnection(state.state);
        if (state.state !== 'connected') { setCoachStatus('Local tracking only — coach disconnected. Connect in setup, then start a new session.'); return; }
        if (!report.reps.length) { setCoachStatus('Local tracking only — a complete tracked rep is needed for AI coaching.'); return; }
        setCoachStatus('Preparing evidence from this recording…');
        const bundle = await prepareCoachingBundle(report, clip.src, { repIds: report.reps.slice(0, 2).map((r) => r.id), signal });
        signal.throwIfAborted();
        if (!bundle.images.length || bundle.unavailableImages.length || !bundle.packet.measurements.length) {
          setCoachStatus('Local tracking only — complete source images and measurements are unavailable.'); return;
        }
        const models = await chatGPTProvider.listModels(signal);
        signal.throwIfAborted();
        const coachModel = models.find((m) => m.id === 'gpt-6.1-sol') ?? models[0];
        if (!coachModel) { setCoachStatus('Local tracking only — no image-capable coach is available.'); return; }
        setCoachStatus(`AI coach reviewing ${bundle.packet.repIds.join(' and ')}… Video and local metrics remain available.`);
        const response = await chatGPTProvider.interpret(bundle.packet, bundle.images, { model: coachModel.id, signal });
        signal.throwIfAborted();
        const segments = getCoachingSegments(response, bundle.packet, report);
        setCoaching({ bundle, response, segments });
        setCoachStatus(`AI analysis ready · ${coachModel.label} · replay a rep to follow its evidence.`);
      } catch (e) {
        if (!signal.aborted) setCoachStatus(`AI coach unavailable — ${e instanceof Error ? e.message : String(e)} Local measurements remain available.`);
      }
    })();
    return () => ctrl.abort();
  }, [active, report, clip]);

  const open = (file: File | undefined) => {
    if (!file) return;
    invalidateSession(); setActive(true); setCoachStatus('Local analysis starting…');
    setClip({ name: file.name, src: URL.createObjectURL(file) });
  };

  const openSample = async () => {
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
    setCoachStatus(coaching ? 'Session stopped. Stored AI analysis remains available for replay.' : 'Session stopped. No more coaching requests will be sent.');
  };

  const connect = async () => {
    stop();
    try {
      const result = await chatGPTProvider.startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (e) { setCoachStatus(`Coach connection unavailable — ${e instanceof Error ? e.message : String(e)}`); }
  };

  // Overlay: one clock (the video's mediaTime). Redraw on every presented frame, on seek, and on resize.
  useEffect(() => {
    const v = video.current, c = canvas.current;
    clearOverlay();
    if (!v || !c || !report) return;
    const ctx = c.getContext('2d')!;
    const draw = (mediaTimeS: number) => {
      const dpr = devicePixelRatio, width = v.clientWidth, height = v.clientHeight;
      if (c.width !== width * dpr || c.height !== height * dpr) { c.width = width * dpr; c.height = height * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame = overlayFrameAt(report.frames, Math.round(mediaTimeS * 1000));
      setMediaMs(Math.round(mediaTimeS * 1000));
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
  }, [report]);

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
    if (!report) return;
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

  return (
    <main>
      <header>
        <h1>MoveIDE</h1>
        <nav aria-label="Session source" className="source-nav">
          <a href="/" aria-current="page">Recorded clip</a>
          <a href="/harness/live/">Live camera</a>
        </nav>
      </header>

      <div className="toolbar">
        <label className="button">
          Start with your clip
          <input type="file" accept="video/*" onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button className="primary" onClick={openSample}>Start coached squat</button>
        {active && <button onClick={stop}>Stop session</button>}
        <label>
          Model{' '}
          <select value={model} onChange={(e) => { invalidateSession(); setModel(e.target.value as PoseModel); }} disabled={active}>
            <option value="heavy">Heavy (default)</option>
            <option value="full">Full (faster)</option>
          </select>
        </label>
        <span role="status">
          {status === 'loading' && 'Loading clip…'}
          {status === 'analyzing' && <>Analyzing <progress value={progress} /> {Math.round(progress * 100)}%</>}
          {status === 'ready' && `Ready · ${clip?.name}`}
        </span>
      </div>
      <p className="muted">Start analyzes your clip on this device. While connected, your coach gets selected rep measurements and up to four frames, never the full video. Stop ends coaching.</p>
      {connection !== 'connected' && <button onClick={connect}>Connect AI coach (one-time setup)</button>}
      <p role="status" aria-live="polite">{coachStatus}</p>

      {error && <p role="alert" className="error">{error} Choose another clip — an H.264 MP4 works in Chrome.</p>}

      <div className="workbench">
        <div className="stage">
          {clip && (
            <video ref={video} key={clip.src} src={clip.src} controls playsInline muted onError={onDecodeError} />
          )}
          {!clip && <p className="empty">Choose a clip or start the coached squat.</p>}
          <canvas ref={canvas} aria-hidden />
          {coaching && cue && <div aria-label="Playback AI cue" className="cue">
            <small>AI observation · {cue.repId} · evidence {cue.evidenceTimestampsMs.join(', ')} ms</small>
            <p>{cue.observationIndices.length ? coaching.response.observations[cue.observationIndices[0]].text : coaching.response.nextFocus.text}</p>
          </div>}
        </div>

        {report && (
          <aside>
            <p className="muted">
              {MODEL_LABEL[report.poseModel.id] ?? report.poseModel.id} (v{report.poseModel.version}) · analyzed at up to 15 Hz ·{' '}
              {tracked}/{report.frames.length} samples tracked
            </p>
            <div className="toolbar">
              <button onClick={() => step(-1)}>◀ Previous analyzed sample</button>
              <button onClick={() => step(1)}>Next analyzed sample ▶</button>
              <label>Speed{' '}
                <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                  {[1, 0.5, 0.25].map((r) => <option key={r} value={r}>{r}×</option>)}
                </select>
              </label>
            </div>
            <p className="muted"><small>← → step analyzed samples</small></p>
            {report.reps.length > 0 && (
              <div className="toolbar">
                {report.reps.map((r) => (
                  <span key={r.id} className="phases">
                    {r.id}:{' '}
                    <button onClick={() => seek(r.startMs)}>start @ {r.startMs} ms</button>
                    <button onClick={() => seek(r.bottomMs)}>bottom @ {r.bottomMs} ms</button>
                    <button onClick={() => seek(r.endMs)}>return @ {r.endMs} ms</button>
                  </span>
                ))}
              </div>
            )}
            <p className="readout">
              {here ? (
                <>
                  Sample @ {here.timestampMs} ms{here.repId && ` · ${here.repId}`}{here.phase && ` · ${here.phase}`}<br />
                  Knee {deg(here.kneeFlexionDeg)} · Hip {deg(here.hipFlexionDeg)} · Torso lean {deg(here.torsoLeanDeg)}
                </>
              ) : 'No analyzed sample within 100 ms of this frame.'}
            </p>

            <Trace trace={trace} reps={report.reps} playheadMs={sampleMs} onSeek={seek} />

            <h2>Local measurements</h2>
            {report.measurements.length === 0 && <p>No measurements in this clip.</p>}
            <ul>
              {report.measurements.map((m) => (
                <li key={m.id}>
                  {m.quality === 'usable' ? (
                    <button aria-pressed={m.id === selected} onClick={() => openEvidence(m)}>
                      {METRIC_LABEL[m.metric]}{m.repId && ` · ${m.repId}`} <b>{fmt(m)}</b>
                      <small> @ {m.evidenceTimestampMs} ms</small>
                    </button>
                  ) : (
                    <span className="muted">{METRIC_LABEL[m.metric]}{m.repId && ` · ${m.repId}`} · unavailable</span>
                  )}
                </li>
              ))}
            </ul>
            {sel?.quality === 'usable' && (
              <p className="readout">
                {METRIC_LABEL[sel.metric]} <b>{fmt(sel)}</b> at {sel.evidenceTimestampMs} ms (estimated, video plane)
              </p>
            )}
            {report.warnings.map((w) => <p key={w.code} className="warning">⚠ {w.message}</p>)}
          </aside>
        )}
      </div>

      {coaching && (
        <section aria-label="AI coaching" className="readout">
          <h2>AI coaching{cue ? ` · ${cue.repId}` : ''}</h2>
          {cue ? <>
            {cue.observationIndices.map((i) => <p key={i}>{coaching.response.observations[i].text}</p>)}
            {cue.hasNextFocus && <p><b>Next focus:</b> {coaching.response.nextFocus.text}</p>}
            {cue.evidenceTimestampsMs.map((ms) => <button key={ms} onClick={() => seek(ms)}>See evidence @ {ms} ms</button>)}
          </> : <p>Play a measured rep to see its AI observation. Choose an evidence point below to review.</p>}
          <p className="muted">{coaching.response.uncertainty}</p>
          <details>
            <summary>All AI observations and evidence</summary>
            {coaching.segments.map((segment) => <div key={segment.repId}>
              <b>{segment.repId}</b>
              {segment.observationIndices.map((i) => <p key={i}>{coaching.response.observations[i].text}</p>)}
              {segment.hasNextFocus && <p>Next focus: {coaching.response.nextFocus.text}</p>}
              {segment.evidenceTimestampsMs.map((ms) => <button key={ms} onClick={() => seek(ms)}>Evidence @ {ms} ms</button>)}
            </div>)}
          </details>
        </section>
      )}

      {report && clip && <Compare key={`${clip.src}|${report.poseModel.id}`} report={report} clipSrc={clip.src} onSeek={seek} />}

      <footer className="muted">
        <small>
          Sample clip: subject 010 from <i>A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels</i> v3,
          Prashanth et al. · <a href="https://doi.org/10.17632/kgbb3yn47p.3">Dataset and DOI</a> ·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · trimmed and re-encoded.
        </small>
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
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Knee flexion and torso lean over time" onClick={click}>
        {reps.map((r) => <rect key={r.id} x={x(r.startMs)} width={x(r.endMs) - x(r.startMs)} y={0} height={H} className="rep" />)}
        {reps.map((r) => <line key={r.id} x1={x(r.bottomMs)} x2={x(r.bottomMs)} y1={0} y2={H} className="bottom" />)}
        <path d={path((s) => s.kneeFlexionDeg)} className="knee" />
        <path d={path((s) => s.torsoLeanDeg)} className="torso" />
        {playheadMs !== null && <line x1={x(playheadMs)} x2={x(playheadMs)} y1={0} y2={H} className="playhead" />}
      </svg>
      <figcaption><span className="knee">— knee flexion</span> · <span className="torso">— torso lean</span> · 0–180° · shaded = reps · gaps = untracked · click to seek</figcaption>
    </figure>
  );
}
