import { useEffect, useRef, useState } from 'react';
import type { AnalysisReport, Measurement } from './contract.ts';
import { analyze } from './analyze.ts';
import { Compare } from './Compare.tsx';
import { withSyntheticReps } from './coach.ts';
import { contentRect, drawFrame, frameAt } from './overlay.ts';
import sampleUrl from '../fixtures/squat/sample-squat.mp4';

// ?synthetic: stand-in reps on the real clip until BE-2's segmentation lands.
const SYNTHETIC = new URLSearchParams(location.search).has('synthetic');

type Status = 'idle' | 'loading' | 'analyzing' | 'ready' | 'error';

const METRIC_LABEL: Record<Measurement['metric'], string> = {
  knee_flexion: 'Knee flexion', rep_duration: 'Rep duration', torso_lean: 'Torso lean',
};
const fmt = (m: Measurement) => (m.unit === 'deg' ? `${m.value!.toFixed(1)}°` : `${m.value} ms`);

export function App() {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const job = useRef<AbortController | null>(null);
  const [clip, setClip] = useState<{ name: string; src: string } | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [poseHere, setPoseHere] = useState(false);
  const [connection, setConnection] = useState('unknown');

  useEffect(() => {
    fetch('/api/connection').then((r) => r.json()).then((c) => setConnection(c.state), () => setConnection('service offline'));
  }, []);

  // Release the old clip's object URL whenever the clip changes or the app unmounts.
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.src); }, [clip]);

  const open = (file: File | undefined) => {
    if (!file) return;
    job.current?.abort(); // a late result from the previous clip must not land on this one
    job.current = null;
    setReport(null); setSelected(null); setError(null); setProgress(0);
    setStatus('loading');
    setClip({ name: file.name, src: URL.createObjectURL(file) });
  };

  const openSample = async () => {
    setStatus('loading');
    try {
      const blob = await (await fetch(sampleUrl)).blob();
      open(new File([blob], 'sample-squat.mp4', { type: 'video/mp4' })); // same path as an import
    } catch {
      setStatus('error'); setError('Couldn’t load the built-in sample.');
    }
  };

  const startAnalysis = () => {
    if (!clip) return;
    const ctrl = new AbortController();
    job.current = ctrl;
    setStatus('analyzing');
    analyze(clip.src, { signal: ctrl.signal, onProgress: (p) => !ctrl.signal.aborted && setProgress(p) }).then(
      (r) => { if (job.current === ctrl) { setReport(SYNTHETIC ? withSyntheticReps(r) : r); setStatus('ready'); } },
      (e) => { if (job.current === ctrl && e?.name !== 'AbortError') { setStatus('error'); setError(`Analysis failed: ${e?.message ?? e}`); } },
    );
  };

  const onDecodeError = () => {
    job.current?.abort();
    setClip(null); setReport(null); setStatus('error');
    setError('This browser can’t decode that video.');
  };

  // Overlay: redraw on every presented frame, on seek, and on resize.
  useEffect(() => {
    const v = video.current, c = canvas.current;
    if (!v || !c || !report) return;
    const ctx = c.getContext('2d')!;
    const draw = (mediaTimeS: number) => {
      const dpr = devicePixelRatio, bw = v.clientWidth, bh = v.clientHeight;
      if (c.width !== bw * dpr || c.height !== bh * dpr) { c.width = bw * dpr; c.height = bh * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, bw, bh);
      const frame = frameAt(report.frames, Math.round(mediaTimeS * 1000));
      setPoseHere(!!frame);
      if (!frame || !v.videoWidth) return;
      drawFrame(ctx, frame, contentRect(v.videoWidth, v.videoHeight, bw, bh), report.protocol.side, report.clip.widthPx, report.clip.heightPx);
    };
    let handle = 0;
    const onFrame = (_: number, meta: VideoFrameCallbackMetadata) => { draw(meta.mediaTime); handle = v.requestVideoFrameCallback(onFrame); };
    handle = v.requestVideoFrameCallback(onFrame);
    const redraw = () => draw(v.currentTime);
    const ro = new ResizeObserver(redraw);
    ro.observe(v);
    v.addEventListener('seeked', redraw);
    redraw();
    return () => { v.cancelVideoFrameCallback(handle); ro.disconnect(); v.removeEventListener('seeked', redraw); };
  }, [report]);

  const seek = (ms: number) => {
    const v = video.current;
    if (v) { v.pause(); v.currentTime = ms / 1000; }
  };
  const openEvidence = (m: Measurement) => {
    setSelected(m.id);
    if (m.evidenceTimestampMs !== null) seek(m.evidenceTimestampMs);
  };

  const sel = report?.measurements.find((m) => m.id === selected);

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
            <video
              ref={video}
              key={clip.src}
              src={clip.src}
              controls
              playsInline
              muted
              onLoadedMetadata={startAnalysis}
              onError={onDecodeError}
            />
          )}
          <canvas ref={canvas} aria-hidden />
        </div>

        {report && (
          <aside>
            <h2>Measurements</h2>
            {report.measurements.length === 0 && <p>No measurements in this clip.</p>}
            <ul>
              {report.measurements.map((m) => (
                <li key={m.id}>
                  {m.quality === 'usable' && m.evidenceTimestampMs !== null ? (
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
            {sel && (
              <p className="readout">
                {METRIC_LABEL[sel.metric]} <b>{fmt(sel)}</b> at {sel.evidenceTimestampMs} ms (estimated, video plane)
              </p>
            )}
            <p className="muted">{poseHere ? 'Pose tracked at this frame.' : 'Pose unavailable at this frame.'}</p>
            {report.warnings.map((w) => <p key={w.code} className="warning">⚠ {w.message}</p>)}
          </aside>
        )}
      </div>

      {report && clip && <Compare key={clip.src} report={report} clipSrc={clip.src} selected={selected} onOpen={openEvidence} onSeek={seek} />}
    </main>
  );
}
