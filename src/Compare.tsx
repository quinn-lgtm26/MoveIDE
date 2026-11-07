// FE-3: compare two reps and hand off the evidence manually. Works with no provider connected.
import { useEffect, useMemo, useState } from 'react';
import type { AnalysisReport, EvidenceRef, Measurement } from './contract.ts';
import { buildPacket, delta, fmtValue, packetText, repRow } from './coach.ts';

type Shot = { url: string } | { error: string };

/** Grab unannotated JPEGs of the source clip at each evidence timestamp, on a private video element. */
async function captureFrames(src: string, refs: EvidenceRef[], signal: AbortSignal): Promise<Record<string, Shot>> {
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.src = src;
  const wait = (ev: string) => new Promise<void>((ok, fail) => {
    const off = () => { v.removeEventListener(ev, done); v.removeEventListener('error', err); };
    const done = () => { off(); ok(); };
    const err = () => { off(); fail(new Error('video could not be decoded')); };
    v.addEventListener(ev, done); v.addEventListener('error', err);
  });
  const out: Record<string, Shot> = {};
  try {
    await wait('loadedmetadata');
    for (const r of refs) {
      if (signal.aborted) break;
      try {
        if (r.timestampMs > v.duration * 1000) throw new Error('timestamp is past the end of the clip');
        const seeked = wait('seeked');
        v.currentTime = r.timestampMs / 1000;
        await seeked;
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d')!.drawImage(v, 0, 0);
        const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
        if (!blob) throw new Error('JPEG encoding failed');
        out[r.id] = { url: URL.createObjectURL(blob) };
      } catch (e) {
        out[r.id] = { error: (e as Error).message };
      }
    }
  } catch (e) {
    for (const r of refs) out[r.id] ??= { error: (e as Error).message };
  } finally {
    v.removeAttribute('src'); v.load();
  }
  return out;
}

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href; a.download = name; a.click();
}

type Props = { report: AnalysisReport; clipSrc: string; selected: string | null; onOpen: (m: Measurement) => void; onSeek: (ms: number) => void };

export function Compare({ report, clipSrc, selected, onOpen, onSeek }: Props) {
  const ids = report.reps.map((r) => r.id);
  const [pair, setPair] = useState<[string, string]>([ids[0], ids[1]]);
  const [preview, setPreview] = useState(false);
  const [goal, setGoal] = useState('');
  const [shots, setShots] = useState<Record<string, Shot> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const a = repRow(report, pair[0]), b = repRow(report, pair[1]);
  const packet = useMemo(() => (a && b ? buildPacket(report, a, b, goal) : null), [report, pair, goal]); // eslint-disable-line
  const evidenceKey = packet?.evidence.map((e) => e.id).join() ?? '';

  // Capture only while the preview is open; a newer pair or clip cancels the old capture and frees its images.
  useEffect(() => {
    if (!preview || !packet) return;
    const ctrl = new AbortController();
    let got: Record<string, Shot> = {};
    setShots(null);
    captureFrames(clipSrc, packet.evidence, ctrl.signal).then((s) => {
      got = s;
      if (ctrl.signal.aborted) revoke(s); else setShots(s);
    });
    return () => { ctrl.abort(); revoke(got); };
  }, [preview, clipSrc, evidenceKey]); // eslint-disable-line

  if (ids.length < 2) {
    return <section className="compare"><h2>Compare reps</h2><p className="muted">Comparison needs two complete reps; this clip has {ids.length}.</p></section>;
  }

  const cell = (m?: Measurement) =>
    m && m.quality === 'usable' && m.evidenceTimestampMs !== null
      ? <button aria-pressed={m.id === selected} onClick={() => onOpen(m)}>{fmtValue(m)} <small>@ {m.evidenceTimestampMs} ms</small></button>
      : <span className="muted">unavailable</span>;
  const d = (x?: Measurement, y?: Measurement) => {
    const v = delta(x, y);
    return v === null ? '—' : `${v > 0 ? '+' : ''}${v}${x!.unit === 'deg' ? '°' : ' ms'}`;
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(packetText(packet!)); setCopied('Copied the Magna Carta and packet.'); }
    catch { setCopied('Copy was blocked. Select the packet text below and copy it manually.'); }
  };
  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    download(url, `${report.clip.id}-report.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const missing = packet?.evidence.filter((e) => shots && 'error' in (shots[e.id] ?? { error: '' })) ?? [];

  return (
    <section className="compare">
      <h2>Compare reps</h2>
      <div className="toolbar">
        {(['Rep A', 'Rep B'] as const).map((label, i) => (
          <label key={label}>
            {label}{' '}
            <select value={pair[i]} onChange={(e) => setPair((p) => (i ? [p[0], e.target.value] : [e.target.value, p[1]]))}>
              {ids.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
        ))}
      </div>

      {a && b && (
        <table>
          <thead><tr><th /><th>{a.rep.id}</th><th>{b.rep.id}</th><th>B − A</th></tr></thead>
          <tbody>
            <tr><th>Knee flexion</th><td>{cell(a.knee)}</td><td>{cell(b.knee)}</td><td>{d(a.knee, b.knee)}</td></tr>
            <tr><th>Duration</th><td>{cell(a.duration)}</td><td>{cell(b.duration)}</td><td>{d(a.duration, b.duration)}</td></tr>
            <tr>
              <th>Evidence</th>
              {[a, b].map((r) => (
                <td key={r.rep.id}><button onClick={() => onSeek(r.rep.bottomMs)}>Bottom frame @ {r.rep.bottomMs} ms</button></td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <div className="toolbar">
        <button aria-expanded={preview} onClick={() => setPreview((p) => !p)} disabled={!packet}>
          {preview ? 'Hide coaching packet' : 'Preview coaching packet'}
        </button>
        <button onClick={exportReport}>Export report JSON</button>
      </div>

      {preview && packet && (
        <div className="packet">
          <p className="muted">Nothing is sent from here. This is exactly what you copy and attach to your AI tool.</p>
          <label>Goal (optional) <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. squat deeper" /></label>
          <p><b>Reps:</b> {packet.repIds.join(', ')}</p>
          <p><b>Summary:</b> {packet.summary}</p>
          <ul>
            {packet.measurements.map((m) => <li key={m.id}>{m.id} · {m.repId} · {m.metric} = {m.value} {m.unit} @ {m.evidenceTimestampMs} ms</li>)}
          </ul>
          <div className="frames">
            {packet.evidence.map((e) => {
              const s = shots?.[e.id];
              return (
                <figure key={e.id}>
                  {!s ? <div className="thumb muted">Capturing…</div>
                    : 'url' in s ? <img className="thumb" src={s.url} alt={`Source frame at ${e.timestampMs} ms`} />
                    : <div className="thumb error">Image unavailable: {s.error}</div>}
                  <figcaption>{e.id} · {e.timestampMs} ms</figcaption>
                </figure>
              );
            })}
          </div>
          {missing.length > 0 && (
            <p role="alert" className="warning">⚠ {missing.length} of {packet.evidence.length} images are missing. The comparison and packet text are unaffected; attach the rest manually.</p>
          )}
          <div className="toolbar">
            <button onClick={copy}>Copy Magna Carta + packet</button>
            <button
              disabled={!shots || missing.length === packet.evidence.length}
              onClick={() => packet.evidence.forEach((e) => { const s = shots?.[e.id]; if (s && 'url' in s) download(s.url, e.imageName); })}
            >
              Download images
            </button>
            <span role="status">{copied}</span>
          </div>
          <details>
            <summary>Packet text</summary>
            <pre>{packetText(packet)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}

function revoke(s: Record<string, Shot>) {
  for (const v of Object.values(s)) if ('url' in v) URL.revokeObjectURL(v.url);
}
