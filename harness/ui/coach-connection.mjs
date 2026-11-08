import { chatGPTProvider } from '../provider/client.mjs';
/** Read-only status until the user explicitly chooses Connect or Disconnect. */
export function mountCoachConnection(host, { provider = chatGPTProvider, onState = () => {}, onDisconnect = () => {} } = {}) {
  const doc = host.ownerDocument, win = doc.defaultView, abort = new AbortController();
  host.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;max-width:100%;';
  host.setAttribute('aria-label', 'ChatGPT connection');
  const status = doc.createElement('span'); status.setAttribute('role', 'status');
  const connect = doc.createElement('button'); connect.type = 'button'; connect.textContent = 'Connect ChatGPT';
  const details = doc.createElement('details'), summary = doc.createElement('summary'), disconnect = doc.createElement('button');
  summary.textContent = 'Account options'; disconnect.type = 'button'; disconnect.textContent = 'Disconnect ChatGPT';
  const reconnect = doc.createElement('button'); reconnect.type = 'button'; reconnect.textContent = 'Reconnect ChatGPT';
  const note = doc.createElement('small'); note.textContent = 'Requires an eligible ChatGPT account. Local analysis works without it.';
  details.append(summary, note, reconnect, disconnect); host.append(status, connect, details);
  for (const button of [connect, reconnect, disconnect]) button.style.cssText = 'min-height:44px;padding:8px 12px;cursor:pointer;';
  let state = 'checking', pending = false, popup, timer, polls = 0, lastCheck = -Infinity, disposed = false;
  const render = message => { status.textContent = message ?? `ChatGPT · ${state === 'connected' ? 'Connected' : state === 'connecting' ? 'Finish sign-in' : state === 'checking' ? 'Checking…' : state === 'unavailable' ? 'Unavailable here' : 'Not connected'}`; connect.hidden = state === 'connected'; connect.disabled = pending; details.hidden = state !== 'connected'; };
  const refresh = async (force = false) => {
    if (disposed || pending || (!force && Date.now() - lastCheck < 2000)) return;
    lastCheck = Date.now(); pending = true; render();
    try { const result = await provider.getConnection(abort.signal); if (disposed) return; state = result.state; onState(state); }
    catch { if (!disposed) { state = 'unavailable'; onState(state); } }
    finally { pending = false; if (!disposed) render(); }
    if (state === 'connected') { clearInterval(timer); timer = null; }
  };
  connect.onclick = async () => {
    if (pending || disposed) return;
    popup = win.open('', '_blank', 'popup,width=540,height=720');
    if (!popup) { render('Allow the sign-in popup, then try Connect again.'); return; }
    popup.opener = null; pending = true; render('Opening ChatGPT sign-in…');
    try {
      const result = await provider.startConnection();
      if (disposed) { popup.close(); return; }
      popup.location = result.authorizationUrl; state = 'connecting'; onState(state); pending = false; render();
      clearInterval(timer); polls = 0;
      timer = setInterval(() => { if (++polls >= 60 || popup.closed) { clearInterval(timer); timer = null; } void refresh(true); }, 2000);
    } catch { popup.close(); pending = false; state = 'unavailable'; onState(state); render('ChatGPT setup is unavailable here. Use the local demo and try again.'); }
  };
  reconnect.onclick = () => connect.onclick();
  disconnect.onclick = async () => {
    if (pending || disposed) return;
    onDisconnect(); pending = true; disconnect.disabled = true; clearInterval(timer);
    let failed = false;
    try { const result = await provider.disconnect(); if (!disposed) { state = result.state; onState(state); } }
    catch { failed = true; }
    finally { pending = false; disconnect.disabled = false; if (!disposed) render(failed ? 'Could not disconnect. Try again.' : undefined); }
  };
  const focus = () => { if (!doc.hidden) void refresh(); };
  win.addEventListener('focus', focus); doc.addEventListener('visibilitychange', focus); render(); void refresh(true);
  return () => { disposed = true; abort.abort(); clearInterval(timer); win.removeEventListener('focus', focus); doc.removeEventListener('visibilitychange', focus); host.replaceChildren(); };
}
