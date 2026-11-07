import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisReport, Measurement, MotionTraceSample } from '../harness/motion/analyze.mjs';
import { getMotionTrace } from '../harness/motion/analyze.mjs';
import { drawSquatOverlay, overlayFrameAt } from '../harness/motion/overlay.mjs';
import { analyze, type PoseModel } from './analyze.ts';
import { Compare } from './Compare.tsx';
import sampleUrl from '../fixtures/squat/clear-squat.mp4';

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

  // Release the old clip's object URL whenever the clip changes or the app unmounts.
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.src); }, [clip]);

  // One analysis per clip + model; a newer clip or model aborts the old run so a late result can't land.
  useEffect(() => {
    if (!clip) return;
    const ctrl = new AbortController();
    setReport(null); setSelected(null); setSampleMs(null); setError(null); setProgress(0);
    setStatus('analyzing');
    analyze(clip.src, { signal: ctrl.signal, model, onProgress: (p) => !ctrl.signal.aborted && setProgress(p) }).then(
      (r) => { if (!ctrl.signal.aborted) { setReport(r); setStatus('ready'); } },
      (e) => { if (!ctrl.signal.aborted) { setStatus('error'); setError(`Analysis failed: ${e?.message ?? e}`); } },
    );
    return () => ctrl.abort();
  }, [clip, model]);

  const open = (file: File | undefined) => {
    if (!file) return;
    setClip({ name: file.name, src: URL.createObjectURL(file) });
  };

  const openSample = async () => {
    setStatus('loading');
    try {
      const blob = await (await fetch(sampleUrl)).blob();
      open(new File([blob], 'clear-squat.mp4', { type: 'video/mp4' })); // same path as an import
    } catch {
      setStatus('error'); setError('Couldn’t load the built-in sample.');
    }
  };

  const onDecodeError = () => {
    setClip(null); setReport(null); setStatus('error');
    setError('This browser can’t decode that video.');
  };

  // Overlay: one clock (the video's mediaTime). Redraw on every presented frame, on seek, and on resize.
  useEffect(() => {
    const v = video.current, c = canvas.current;
    if (!v || !c || !report) return;
    const ctx = c.getContext('2d')!;
    const draw = (mediaTimeS: number) => {
      const dpr = devicePixelRatio, width = v.clientWidth, height = v.clientHeight;
      if (c.width !== width * dpr || c.height !== height * dpr) { c.width = width * dpr; c.height = height * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const frame = overlayFrameAt(report.frames, Math.round(mediaTimeS * 1000));
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
    return () => { v.cancelVideoFrameCallback(handle); ro.disconnect(); v.removeEventListener('seeked', redraw); v.removeEventListener('loadeddata', redraw); };
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

  return (
    <main>
      <header>
        <h1>MoveIDE</h1>
      </header>

      <div className="toolbar">
        <label className="button">
          Open clip
          <input type="file" accept="video/*" onChange={(e) => { open(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button onClick={openSample}>Open sample squat</button>
        <label>
          Model{' '}
          <select value={model} onChange={(e) => setModel(e.target.value as PoseModel)} disabled={status === 'analyzing'}>
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

      {error && <p role="alert" className="error">{error} Choose another clip — an H.264 MP4 works in Chrome.</p>}

      <div className="workbench">
        <div className="stage">
          {clip && (
            <video ref={video} key={clip.src} src={clip.src} controls playsInline muted onError={onDecodeError} />
          )}
          <canvas ref={canvas} aria-hidden />
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
                    <button onClick={() => seek(r.bottomMs)}>{r.id} bottom @ {r.bottomMs} ms</button>
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

            <h2>Measurements</h2>
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

      {report && clip && <Compare key={`${clip.src}|${report.poseModel.id}`} report={report} clipSrc={clip.src} playheadMs={sampleMs} onSeek={seek} />}

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
