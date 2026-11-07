import { useEffect, useRef, useState } from 'react';
import type { AnalysisReport } from './contract.ts';
import sample from '../_bmad-output/specs/shared/analysis-report-v1.example.json';

// Shell only: import → play → report list with click-to-seek. Overlay (FE-2), compare (FE-3)
// and connect (FE-4) build on this.
const sampleReport = sample as AnalysisReport;

export function App() {
  const video = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [connection, setConnection] = useState('unknown');

  useEffect(() => {
    fetch('/api/connection').then((r) => r.json()).then((c) => setConnection(c.state), () => setConnection('service offline'));
  }, []);

  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);

  const open = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setReport(null); // new clip invalidates the old report
    setSrc(URL.createObjectURL(file));
  };

  return (
    <main style={{ fontFamily: 'system-ui', padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1>MoveIDE</h1>
      <p>
        <label>
          Open clip <input type="file" accept="video/*" onChange={(e) => open(e.target.files?.[0])} />
        </label>{' '}
        <button onClick={() => setReport(sampleReport)}>Load sample report</button>{' '}
        <small>ChatGPT: {connection}</small>
      </p>

      {error && <p role="alert">{error} Choose another clip — an H.264 MP4 works in Chrome.</p>}

      {src && (
        <video
          ref={video}
          src={src}
          controls
          style={{ width: '100%' }}
          onLoadedMetadata={() => setReport(sampleReport)}
          onError={() => { setError('This browser can’t decode that video.'); setSrc(null); }}
        />
      )}

      {report && (
        <section>
          <h2>Measurements · {report.clip.id}</h2>
          <ul>
            {report.measurements.map((m) => (
              <li key={m.id}>
                {m.quality === 'usable' && m.evidenceTimestampMs !== null ? (
                  <button onClick={() => video.current && (video.current.currentTime = m.evidenceTimestampMs! / 1000)}>
                    {m.metric}: {m.unit === 'deg' ? m.value!.toFixed(1) : m.value} {m.unit} @ {m.evidenceTimestampMs} ms
                  </button>
                ) : (
                  <span>{m.metric}: unavailable</span>
                )}
              </li>
            ))}
          </ul>
          {report.warnings.map((w) => <p key={w.code}>⚠ {w.message}</p>)}
        </section>
      )}
    </main>
  );
}
