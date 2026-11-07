// FE-3: compare two reps and hand off the evidence manually. Works with no provider connected.
import { useEffect, useMemo, useState } from 'react';
import type { AnalysisReport, SquatMetrics, SquatRepProfile } from '../harness/motion/analyze.mjs';
import { getSquatProfile } from '../harness/motion/analyze.mjs';
import { formatManualHandoff, prepareCoachingBundle } from '../harness/coaching/index.mjs';
import type { CoachingBundle } from '../harness/coaching/index.mjs';
import { Coach } from './Coach.tsx';

type Row = { label: string; unit: '°' | ' ms' | ' leg lengths'; get: (r: SquatRepProfile) => number | null };
const bottom = (k: keyof SquatMetrics) => (r: SquatRepProfile) => r.bottom[k];
const PRIMARY: Row[] = [
  { label: 'Knee flexion (bottom)', unit: '°', get: bottom('kneeFlexionDeg') },
  { label: 'Hip flexion (bottom)', unit: '°', get: bottom('hipFlexionDeg') },
  { label: 'Torso lean (bottom)', unit: '°', get: bottom('torsoLeanDeg') },
  { label: 'Descent', unit: ' ms', get: (r) => r.descentMs },
  { label: 'Ascent', unit: ' ms', get: (r) => r.ascentMs },
];
const DETAILS: Row[] = [
  { label: 'Shin inclination (bottom)', unit: '°', get: bottom('shinInclinationDeg') },
  { label: 'Ankle closure change', unit: '°', get: bottom('ankleClosureChangeDeg') },
  { label: 'Hip descent', unit: ' leg lengths', get: bottom('hipDescentLegLengths') },
  { label: 'Hip above knee', unit: ' leg lengths', get: bottom('hipAboveKneeLegLengths') },
];

const val = (v: number | null, unit: string) => (v === null ? <span className="muted">unavailable</span> : `${unit === ' ms' ? Math.round(v) : v.toFixed(unit === '°' ? 1 : 2)}${unit}`);
const diff = (a: number | null, b: number | null, unit: string) => {
  if (a === null || b === null) return <span className="muted">—</span>;
  const d = b - a;
  return `${d > 0 ? '+' : ''}${unit === ' ms' ? Math.round(d) : d.toFixed(unit === '°' ? 1 : 2)}${unit}`;
};

type Shots = { bundle: CoachingBundle; urls: Record<string, string> };

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href; a.download = name; a.click();
}

type Props = { report: AnalysisReport; clipSrc: string; playheadMs: number | null; onSeek: (ms: number) => void };

export function Compare({ report, clipSrc, playheadMs, onSeek }: Props) {
  const profile = useMemo(() => getSquatProfile(report), [report]);
  const ids = profile.reps.map((r) => r.repId);
  const [pair, setPair] = useState<[string, string]>([ids[0], ids[1]]);
  const [preview, setPreview] = useState(false);
  const [draftGoal, setDraftGoal] = useState('');
  const [goal, setGoal] = useState('');
  const [shots, setShots] = useState<Shots | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const distinct = !!pair[0] && !!pair[1] && pair[0] !== pair[1];

  // One request generation per (clip, pair, goal) while the preview is open. A newer one aborts the
  // old capture and frees its image URLs, so stale JPEGs never show against a new packet.
  useEffect(() => {
    if (!preview || !distinct) return;
    const ctrl = new AbortController();
    let urls: Record<string, string> = {};
    setShots(null); setFailure(null); setCopied(null);
    prepareCoachingBundle(report, clipSrc, { repIds: pair, userGoal: goal || undefined, signal: ctrl.signal }).then(
      (bundle) => {
        if (ctrl.signal.aborted) return;
        urls = Object.fromEntries(bundle.images.map((i) => [i.id, URL.createObjectURL(i.blob)]));
        setShots({ bundle, urls });
      },
      (e) => { if (!ctrl.signal.aborted) setFailure(e?.message ?? String(e)); },
    );
    return () => { ctrl.abort(); Object.values(urls).forEach(URL.revokeObjectURL); };
  }, [preview, distinct, report, clipSrc, pair[0], pair[1], goal]); // eslint-disable-line

  const text = useMemo(() => shots && formatManualHandoff(shots.bundle.packet, shots.bundle.images), [shots]);

  if (ids.length < 2) {
    return <section className="compare"><h2>Compare reps</h2><p className="muted">Comparison needs two complete reps; this clip has {ids.length}.</p></section>;
  }

  const a = profile.reps.find((r) => r.repId === pair[0])!, b = profile.reps.find((r) => r.repId === pair[1])!;
  const rows = (list: Row[]) => list.map((row) => (
    <tr key={row.label}><th>{row.label}</th><td>{val(row.get(a), row.unit)}</td><td>{val(row.get(b), row.unit)}</td><td>{distinct ? diff(row.get(a), row.get(b), row.unit) : '—'}</td></tr>
  ));

  const copy = async () => {
    try { await navigator.clipboard.writeText(text!); setCopied('Copied the Magna Carta and packet.'); }
    catch { setCopied('Copy was blocked. Select the packet text below and copy it manually.'); }
  };
  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    download(url, `${report.clip.id}-report.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const packet = shots?.bundle.packet;
  const missing = shots?.bundle.unavailableImages ?? [];

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
      {!distinct && <p className="warning">Pick two different reps to compare.</p>}

      <table>
        <thead><tr><th /><th>{a.repId}</th><th>{b.repId}</th><th>B − A</th></tr></thead>
        <tbody>
          {rows(PRIMARY)}
          <tr>
            <th>Evidence</th>
            {[a, b].map((r, i) => <td key={i}><button onClick={() => onSeek(r.bottomMs)}>Bottom frame @ {r.bottomMs} ms</button></td>)}
            <td />
          </tr>
        </tbody>
      </table>
      <details>
        <summary>More measurements</summary>
        <table><tbody>{rows(DETAILS)}</tbody></table>
        <p className="muted">Estimated in the video plane from a single side view. Depth proxies are in leg lengths, not centimetres. No overall score.</p>
      </details>

      <details>
      <summary>Developer tools: report and coaching packet</summary>
      <div className="toolbar">
        <button aria-expanded={preview} onClick={() => setPreview((p) => !p)} disabled={!distinct}>
          {preview ? 'Hide coaching packet' : 'Preview coaching packet'}
        </button>
        <button onClick={exportReport}>Export report JSON</button>
      </div>

      {preview && distinct && (
        <div className="packet">
          <p className="muted">Developer tools: inspect or copy this selected bundle. The manual AI controls below send only when you explicitly request them; the normal session coaches automatically.</p>
          <label>
            Goal (optional){' '}
            <input value={draftGoal} onChange={(e) => setDraftGoal(e.target.value)} onBlur={() => setGoal(draftGoal.trim())}
              onKeyDown={(e) => e.key === 'Enter' && setGoal(draftGoal.trim())} placeholder="e.g. squat deeper" />
          </label>
          {failure && <p role="alert" className="error">Couldn’t prepare the packet: {failure}</p>}
          {!shots && !failure && <p className="muted">Preparing packet and capturing source frames…</p>}
          {packet && (
            <>
              <p><b>Summary:</b> {packet.summary}</p>
              <div className="frames">
                {packet.evidence.map((e) => {
                  const url = shots.urls[e.id];
                  const miss = missing.find((m) => m.id === e.id);
                  return (
                    <figure key={e.id}>
                      {url ? <img className="thumb" src={url} alt={`Source frame at ${e.timestampMs} ms`} />
                        : <div className="thumb error">Image unavailable{miss && `: ${miss.message}`}</div>}
                      <figcaption>{e.id} · {e.timestampMs} ms</figcaption>
                    </figure>
                  );
                })}
              </div>
              {missing.length > 0 && (
                <p role="alert" className="warning">⚠ {missing.length} of {packet.evidence.length} images are missing. The packet text lists them as unavailable; attach the rest manually.</p>
              )}
              <div className="toolbar">
                <button onClick={copy}>Copy Magna Carta + packet</button>
                <button disabled={shots.bundle.images.length === 0}
                  onClick={() => shots.bundle.images.forEach((i) => download(shots.urls[i.id], i.imageName))}>
                  Download images
                </button>
                <span role="status">{copied}</span>
              </div>
              <details>
                <summary>Packet text</summary>
                <pre>{text}</pre>
              </details>
              <Coach report={report} bundle={shots.bundle} playheadMs={playheadMs} onSeek={onSeek} />
            </>
          )}
        </div>
      )}
      </details>
    </section>
  );
}
