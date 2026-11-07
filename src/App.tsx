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
  const [connection, setConnection] = useState('unknown');

  useEffect(() => {
    fetch('/api/connection').then((r) => r.json()).then((c) => setConnection(c.state), () => setConnection('service offline'));
  }, []);

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
        <small>ChatGPT: {connection}</small>
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
            </div>
            {report.reps.length > 0 && (
              <div className="toolbar">
                {report.reps.map((r) => <button key={r.id} onClick={() => seek(r.bottomMs)}>{r.id} bottom @ {r.bottomMs} ms</button>)}
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
