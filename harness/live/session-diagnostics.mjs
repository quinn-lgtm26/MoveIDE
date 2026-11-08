// Local, bounded operational events. Never accept packets, images, URLs or provider text.
const numeric = new Set(['epoch', 'latencyMs', 'fps', 'processed', 'dropped', 'queued', 'running', 'completed', 'width', 'height', 'rep']);
const words = new Set(['source', 'tracking', 'reason', 'state']);
export function createDiagnosticLog({ limit = 240, now = () => performance.now() } = {}) {
  let began = now(); const events = [];
  return {
    reset() { began = now(); events.length = 0; },
    append(event, fields = {}) {
      const entry = { elapsedMs: Math.round(Math.max(0, now() - began)), event: String(event).replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 48) };
      for (const [key, value] of Object.entries(fields)) {
        if (numeric.has(key) && Number.isFinite(value)) entry[key] = Math.round(value * 10) / 10;
        if (words.has(key) && typeof value === 'string' && /^[a-zA-Z0-9 _-]{1,64}$/.test(value)) entry[key] = value;
      }
      events.push(entry); if (events.length > limit) events.splice(0, events.length - limit);
      return { ...entry };
    },
    snapshot: () => events.map(event => ({ ...event })),
  };
}
export function createSessionDiagnostics(element, button) {
  const log = createDiagnosticLog();
  const render = () => {
    const items = log.snapshot().slice(-40).reverse().map(event => {
      const row = document.createElement('li');
      const { elapsedMs, event: name, ...fields } = event;
      row.textContent = `${(elapsedMs / 1000).toFixed(1)}s · ${name} · ${Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join(' · ')}`;
      return row;
    });
    element?.replaceChildren(...items);
  };
  button?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ version: 1, scope: 'Local session operational diagnostics; no media or credentials', events: log.snapshot() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'moveide-session-diagnostics.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return { reset() { log.reset(); render(); }, append(event, fields) { log.append(event, fields); render(); } };
}
