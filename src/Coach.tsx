// FE-4: connect ChatGPT and request an explanation of the approved bundle. Mounted per bundle
// (Compare keys it), so a clip, pair, or goal change unmounts it and drops any stale request or result.
import { useEffect, useRef, useState } from 'react';
import type { AnalysisReport } from '../harness/motion/analyze.mjs';
import type { CoachingBundle, CoachingResponse } from '../harness/coaching/index.mjs';
import { coachingSegmentAt, getCoachingSegments } from '../harness/coaching/index.mjs';
import { chatGPTProvider, type ConnectionState } from '../harness/provider/client.mjs';

type Props = { report: AnalysisReport; bundle: CoachingBundle; playheadMs: number | null; onSeek: (ms: number) => void };
type Result = { response: CoachingResponse; segments: ReturnType<typeof getCoachingSegments> };

export function Coach({ report, bundle, playheadMs, onSeek }: Props) {
  const [conn, setConn] = useState<ConnectionState['state']>('disconnected');
  const [enabled, setEnabled] = useState(true);
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const request = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = useRef(0);

  const refresh = async () => {
    let c: ConnectionState = await chatGPTProvider.getConnection().catch(() => ({ state: 'unavailable', enabled: false }));
    let list: typeof models = [];
    if (c.state === 'connected') list = await chatGPTProvider.listModels().catch(() => { c = { state: 'unavailable' }; return []; });
    setConn(c.state); setEnabled(c.enabled !== false); setModels(list);
    setModel((m) => (list.some((x) => x.id === m) ? m : list[0]?.id ?? ''));
    return c.state;
  };

  useEffect(() => {
    refresh();
    return () => { clearInterval(poll.current); request.current?.abort(); };
  }, []); // eslint-disable-line

  const connect = async () => {
    const popup = window.open('', '_blank', 'popup');
    if (!popup) { setStatus('Allow the sign-in popup to continue.'); return; }
    popup.opener = null;
    try {
      popup.location = (await chatGPTProvider.startConnection()).authorizationUrl;
      setConn('connecting');
      poll.current = window.setInterval(async () => {
        const s = await refresh();
        if (s !== 'connecting' || popup.closed) {
          clearInterval(poll.current);
          if (s === 'connecting') await chatGPTProvider.cancelConnection();
          popup.close(); refresh();
        }
      }, 1500);
    } catch (e) { popup.close(); setStatus((e as Error).message); }
  };
  const cancelConnect = async () => { clearInterval(poll.current); await chatGPTProvider.cancelConnection().catch(() => {}); refresh(); };
  const disconnect = async () => {
    cancelRequest();
    const r = await chatGPTProvider.disconnect().catch(() => null);
    await refresh();
    if (r?.revocationConfirmed === false) setStatus('Signed out locally. Check ChatGPT settings to confirm remote revocation.');
  };

  const cancelRequest = () => {
    if (!request.current) return;
    request.current.abort(); request.current = null; setBusy(false);
    setStatus('AI request canceled. Local measurements and the copy path remain available.');
  };

  const generate = async () => {
    const ctrl = new AbortController();
    request.current = ctrl; setBusy(true); setResult(null);
    setStatus('Generating AI analysis… You can keep playing the video.');
    try {
      const response = await chatGPTProvider.interpret(bundle.packet, bundle.images, { model, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResult({ response, segments: getCoachingSegments(response, bundle.packet, report) }); // validates evidence IDs
      setStatus('AI analysis ready. Play a rep to follow its notes, or open a cited frame.');
    } catch (e) {
      if (!ctrl.signal.aborted) setStatus(`AI analysis could not complete: ${(e as Error).message} Your local measurements are still available.`);
    } finally {
      if (request.current === ctrl) { request.current = null; setBusy(false); }
    }
  };

  const times = new Map<string, number>([
    ...bundle.packet.measurements.map((m) => [m.id, m.evidenceTimestampMs] as const),
    ...bundle.packet.evidence.map((e) => [e.id, e.timestampMs] as const),
  ]);
  const cites = (ids: string[]) => [...new Set(ids.map((id) => times.get(id)!))].map((t) => (
    <button key={t} onClick={() => onSeek(t)}>Evidence @ {t} ms</button>
  ));
  const seg = result && playheadMs !== null ? coachingSegmentAt(result.segments, playheadMs) : null;
  const canSend = conn === 'connected' && !!model && !busy && bundle.images.length > 0 && bundle.unavailableImages.length === 0;

  return (
    <div className="coach">
      <h3>AI coaching (optional)</h3>
      <div className="toolbar">
        <span>ChatGPT: {conn === 'connected' ? 'using your ChatGPT plan' : conn}</span>
        {conn === 'connecting' ? <button onClick={cancelConnect}>Cancel sign-in</button>
          : conn === 'connected' ? <button onClick={disconnect}>Disconnect</button>
          : <button onClick={connect} disabled={!enabled}>Connect ChatGPT</button>}
        {models.length > 0 && (
          <label>Model{' '}
            <select value={model} disabled={busy} onChange={(e) => { setModel(e.target.value); setResult(null); }}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {!enabled && <p className="muted">Sign-in is off in this build. Use the copy path above.</p>}
      <div className="toolbar">
        <button onClick={generate} disabled={!canSend}>Generate AI analysis</button>
        {busy && <button onClick={cancelRequest}>Cancel request</button>}
        <span role="status">{status}</span>
      </div>
      <p className="muted">Sends only the packet and {bundle.images.length} images previewed above.</p>
      {result && (
        <div className="coaching">
          {seg && <p className="cue">Now playing {seg.repId}: {seg.observationIndices.map((i) => result.response.observations[i].text).join(' ')} <small>(evidence @ {seg.evidenceTimestampsMs.join(', ')} ms)</small></p>}
          <ul>
            {result.response.observations.map((o, i) => <li key={i}><p>{o.text}</p>{cites(o.evidenceIds)}</li>)}
          </ul>
          <p><b>Next focus:</b> {result.response.nextFocus.text} {cites(result.response.nextFocus.evidenceIds)}</p>
          <p className="muted">Limits: {result.response.uncertainty}</p>
        </div>
      )}
    </div>
  );
}
