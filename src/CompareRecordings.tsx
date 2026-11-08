import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, type PoseModel } from './analyze.ts';
import type { AnalysisReport } from '../harness/motion/analyze.mjs';
import { drawSquatOverlay, overlayFrameAt } from '../harness/motion/overlay.mjs';
import { compareRecordings } from '../harness/motion/compare-recordings.mjs';
import firstUrl from '../fixtures/squat/clear-squat.mp4';
import secondUrl from '../fixtures/squat/supported-squat.mp4';

type Recording = { label: string; source: string; sourceSha256: string; report: AnalysisReport };
type Anchor = { timestampMs: number; generation: number };
const examples = [{ label: 'Example A', url: firstUrl }, { label: 'Example B', url: secondUrl }];
const displayValue = (value: number | null, unit: string) => value === null ? 'Unavailable' : unit === 'ms' ? `${(value / 1000).toFixed(1)} s` : `${value.toFixed(unit === 'leg_lengths' ? 2 : 0)}${unit === 'deg' ? '°' : ' leg lengths'}`;
const plainLabel: Record<string, string> = { kneeFlexionDeg: 'Knee bend at bottom', torsoLeanDeg: 'Chest angle at bottom', repDurationMs: 'Rep time' };
const primaryMetrics = new Set(['kneeFlexionDeg', 'torsoLeanDeg', 'repDurationMs']);

function RecordingPlayer({ recording, repId, onRep, anchor, slot }: {
  recording: Recording; repId: string; onRep: (repId: string) => void; anchor: Anchor | null; slot: string;
}) {
  const video = useRef<HTMLVideoElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const desiredAnchor = useRef(anchor); desiredAnchor.current = anchor;
  const [time, setTime] = useState(0);
  const [decodeError, setDecodeError] = useState(false);
  const { report } = recording;
  const seek = () => { const v = video.current; if (v && v.readyState >= 1 && desiredAnchor.current) { v.pause(); v.currentTime = desiredAnchor.current.timestampMs / 1000; } };
  useEffect(seek, [anchor]);
  useEffect(() => {
    const v = video.current, c = canvas.current;
    if (!v || !c) return;
    const context = c.getContext('2d')!;
    let frameHandle = 0, disposed = false;
    const draw = (seconds: number) => {
      if (disposed) return;
      if (v.error) { context.clearRect(0, 0, c.width, c.height); return; }
      const width = v.clientWidth, height = v.clientHeight, dpr = devicePixelRatio || 1;
      if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) { c.width = Math.round(width * dpr); c.height = Math.round(height * dpr); }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ms = Math.round(seconds * 1000); setTime(ms);
      drawSquatOverlay(context, overlayFrameAt(report.frames, ms), { side: report.protocol.side, videoWidth: v.videoWidth, videoHeight: v.videoHeight, width, height });
    };
    const onFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => { draw(metadata.mediaTime); frameHandle = v.requestVideoFrameCallback(onFrame); };
    const redraw = () => draw(v.currentTime);
    frameHandle = v.requestVideoFrameCallback(onFrame);
    v.addEventListener('seeked', redraw); v.addEventListener('loadeddata', redraw);
    const resize = new ResizeObserver(redraw); resize.observe(v); redraw();
    return () => { disposed = true; v.cancelVideoFrameCallback(frameHandle); v.removeEventListener('seeked', redraw); v.removeEventListener('loadeddata', redraw); resize.disconnect(); context.clearRect(0, 0, c.width, c.height); };
  }, [report]);
  return <article className="recording-card" data-slot={slot} data-source-sha256={recording.sourceSha256}>
    <div className="toolbar"><h3>{recording.label}</h3><div className="recording-reps" role="group" aria-label={`Recording ${slot.toUpperCase()} rep`}>
      <span className="recording-reps-label">Choose rep</span>
      {report.reps.map((rep, index) => <button type="button" key={rep.id} aria-pressed={repId === rep.id} onClick={() => onRep(rep.id)}>Rep {index + 1}</button>)}
    </div></div>
    <div className="stage recording-stage"><video ref={video} src={recording.source} controls muted playsInline onLoadedMetadata={seek}
      aria-label={`Recording ${slot.toUpperCase()}`} onError={() => { setDecodeError(true); const c = canvas.current; if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height); }} /><canvas ref={canvas} aria-hidden /></div>
    <p className="fine" data-source-time={time}>{(time / 1000).toFixed(2)} s, {report.frames.filter(frame => frame.quality === 'usable').length}/{report.frames.length} frames tracked</p>
    {decodeError && <p role="alert">This recording could not be decoded. Start the comparison again.</p>}
  </article>;
}

/** One action analyzes two distinct byte-verified sources. Playback never starts inference. */
export function CompareRecordings({ model, onClose }: { model: PoseModel; onClose: () => void }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [partial, setPartial] = useState<Recording[]>([]);
  const [repIds, setRepIds] = useState<[string, string]>(['', '']);
  const [anchors, setAnchors] = useState<[Anchor | null, Anchor | null]>([null, null]);
  const [status, setStatus] = useState('Preparing two recordings…');
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const request = useRef<AbortController | null>(null), anchorGeneration = useRef(0);
  const cached = useRef<Recording[]>([]), sourceUrls = useRef<string[]>([]);
  // Successful sources survive a retry, but never a model change or unmount.
  useEffect(() => () => {
    request.current?.abort(); cached.current = [];
    sourceUrls.current.forEach(url => URL.revokeObjectURL(url)); sourceUrls.current = [];
  }, [model]);
  useEffect(() => {
    const own = new AbortController(); request.current = own;
    setPartial(cached.current.slice());
    setRecordings(null); setError(null); setRepIds(['', '']); setAnchors([null, null]);
    void (async () => {
      try {
        const finished: Recording[] = cached.current.slice();
        for (const [index, example] of examples.entries()) {
          if (finished[index]) continue;
          setStatus(`Loading recording ${index + 1} of 2…`);
          const response = await fetch(example.url, { signal: own.signal });
          if (!response.ok) throw new Error(`Recording ${index + 1} could not be loaded.`);
          const blob = await response.blob(); own.signal.throwIfAborted();
          const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()); own.signal.throwIfAborted();
          const sourceSha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
          const source = URL.createObjectURL(blob); sourceUrls.current.push(source);
          let report: AnalysisReport;
          try {
            report = await analyze(source, { model, signal: own.signal, onProgress: progress => {
              if (!own.signal.aborted) setStatus(`Analyzing recording ${index + 1} of 2 · ${Math.round(progress * 100)}%`);
            } });
            if (!report.reps.length) throw new Error(`Recording ${index + 1} has no complete tracked rep. This is unavailable evidence, not a posture verdict.`);
          } catch (failure) {
            URL.revokeObjectURL(source);
            sourceUrls.current = sourceUrls.current.filter(url => url !== source);
            throw failure;
          }
          own.signal.throwIfAborted();
          finished.push({ label: example.label, source, sourceSha256, report });
          cached.current = finished.slice(); setPartial(finished.slice());
        }
        own.signal.throwIfAborted();
        const selected: [string, string] = [finished[0].report.reps[0].id, finished[1].report.reps[0].id];
        compareRecordings({ ...finished[0], repId: selected[0] }, { ...finished[1], repId: selected[1] });
        setRecordings(finished); setRepIds(selected);
        setAnchors(finished.map(recording => ({ timestampMs: recording.report.reps[0].bottomMs, generation: ++anchorGeneration.current })) as [Anchor, Anchor]);
        setStatus('Two recordings ready');
      } catch (failure) {
        if (!own.signal.aborted) { setError(failure instanceof Error ? failure.message : String(failure)); setStatus('Comparison unavailable'); }
      }
    })();
    return () => { own.abort(); };
  }, [model, generation]);
  const comparison = useMemo(() => recordings ? compareRecordings({ ...recordings[0], repId: repIds[0] }, { ...recordings[1], repId: repIds[1] }) : null, [recordings, repIds]);
  const jump = (phase: 'startMs' | 'bottomMs' | 'endMs') => {
    if (!recordings) return;
    setAnchors(recordings.map((recording, index) => ({ timestampMs: recording.report.reps.find(rep => rep.id === repIds[index])![phase], generation: ++anchorGeneration.current })) as [Anchor, Anchor]);
  };
  const selectRep = (slot: number, repId: string) => {
    setRepIds(previous => slot === 0 ? [repId, previous[1]] : [previous[0], repId]);
    setAnchors(previous => previous.map((anchor, index) => index === slot ? { timestampMs: (recordings ?? partial)[slot].report.reps.find(rep => rep.id === repId)!.bottomMs, generation: ++anchorGeneration.current } : anchor) as [Anchor | null, Anchor | null]);
  };
  const close = () => { request.current?.abort(); onClose(); };
  return <section className="recordings-comparison" aria-label="Compare two recordings">
    <div className="toolbar"><h2>Compare two recordings</h2><button onClick={close}>{recordings || error ? 'Back to one recording' : 'Cancel comparison'}</button></div>
    <p className="fine">Different people and cameras: a guide, not a score.</p>
    <p role="status">{status}</p>
    {error && <><div role="alert"><p>{error}</p><button onClick={() => setGeneration(value => value + 1)}>Retry unavailable recording</button></div>
      {partial.length > 0 && <><p className="fine">Completed recording retained. Retry analyzes only the unavailable recording.</p><div className="recording-pair">{partial.map((recording, index) => <RecordingPlayer key={recording.sourceSha256} recording={recording} repId={repIds[index] || recording.report.reps[0].id} onRep={repId => selectRep(index, repId)} anchor={anchors[index]} slot={index === 0 ? 'a' : 'b'} />)}</div></>}
    </>}
    {recordings && comparison && <>
      <div className="toolbar" role="group" aria-label="Line up both videos at">Line up at{' '}<button aria-label="Compare starts" onClick={() => jump('startMs')}>Start</button><button className="primary" aria-label="Compare bottoms" onClick={() => jump('bottomMs')}>Bottom</button><button aria-label="Compare returns" onClick={() => jump('endMs')}>Stand</button></div>
      <div className="recording-pair">{recordings.map((recording, index) => <RecordingPlayer key={recording.sourceSha256} recording={recording} repId={repIds[index]} onRep={repId => selectRep(index, repId)} anchor={anchors[index]} slot={index === 0 ? 'a' : 'b'} />)}</div>
      <section className="compare"><h3>Rep measurements</h3>
        <table><thead><tr><th>Measurement</th><th>Example A</th><th>Example B</th><th>Change</th></tr></thead><tbody>
          {comparison.metrics.filter(metric => primaryMetrics.has(metric.key)).map(metric => <tr key={metric.key}><th>{plainLabel[metric.key] ?? metric.label}</th><td>{displayValue(metric.a.value, metric.unit)}</td><td>{displayValue(metric.b.value, metric.unit)}</td><td>{metric.delta === null ? 'Not comparable' : `${metric.delta > 0 ? '+' : ''}${displayValue(metric.delta, metric.unit)}`}</td></tr>)}
        </tbody></table>
        <details><summary>More measurements</summary><table><thead><tr><th>Measurement</th><th>Example A</th><th>Example B</th><th>Change</th></tr></thead><tbody>{comparison.metrics.filter(metric => !primaryMetrics.has(metric.key)).map(metric => <tr key={metric.key}><th>{plainLabel[metric.key] ?? metric.label}</th><td>{displayValue(metric.a.value, metric.unit)}</td><td>{displayValue(metric.b.value, metric.unit)}</td><td>{metric.delta === null ? 'Not comparable' : `${metric.delta > 0 ? '+' : ''}${displayValue(metric.delta, metric.unit)}`}</td></tr>)}</tbody></table></details>
        <details><summary>Sources and limits</summary><p>Analyzed on this device with {model === 'heavy' ? 'MediaPipe Heavy' : 'MediaPipe Full'} for both recordings. Same model and measurement protocol; distinct source bytes verified. Both clips retain independent timestamps and selected rep identities.</p><ul>{recordings.map(recording => <li key={recording.sourceSha256}>{recording.label}: {recording.report.clip.id} · SHA-256 <code>{recording.sourceSha256}</code></li>)}</ul><p>Projected angles depend on framing and body proportions. Neither recording supplies a calibrated angle reference or a universal technique target.</p></details>
      </section>
    </>}
  </section>;
}
