import { chatGPTProvider } from '../provider/client.mjs';
/** Read-only status until the user explicitly chooses Connect or Disconnect. */
export function mountCoachConnection(host, { provider = chatGPTProvider, onState = () => {}, onDisconnect = () => {} } = {}) {
  const doc = host.ownerDocument, win = doc.defaultView, abort = new AbortController();
  const style = doc.createElement('style'); style.textContent = `
.moveide-coach-account{position:relative;display:flex;align-items:center;gap:8px;font:12px/1.4 system-ui,sans-serif;max-width:100%;color:#193e30}
.moveide-coach-account [hidden]{display:none!important}.moveide-coach-account .coach-state{display:inline-flex;align-items:center;gap:6px;border:1px solid #d5dfd2;background:#f1f5ed;border-radius:24px;min-height:32px;padding:6px 10px;max-width:230px}
.moveide-coach-account .coach-state[data-state=connected]::before{content:'';height:6px;width:6px;flex:none;border-radius:50%;background:#39845b}
.moveide-coach-account button,.moveide-coach-account summary{font:600 12px/1.3 system-ui,sans-serif;min-height:44px;min-width:44px;border:1px solid #cdd9c7;border-radius:12px;background:#fffdf7;color:#193e30;padding:9px 12px;cursor:pointer;letter-spacing:0;text-transform:none}
.moveide-coach-account button:focus-visible,.moveide-coach-account summary:focus-visible{outline:3px solid #58ac76;outline-offset:3px}.moveide-coach-account details{position:relative;flex:none}.moveide-coach-account summary{display:flex;align-items:center;gap:6px;list-style:none}.moveide-coach-account summary::-webkit-details-marker{display:none}.moveide-coach-account summary::after{content:'⌄';font-size:14px}.moveide-coach-account img{width:20px;height:20px;margin:0;flex:none}
.moveide-coach-account .coach-account-panel{position:absolute;right:0;top:calc(100% + 8px);width:272px;max-width:calc(100vw - 24px);z-index:120;display:grid;gap:8px;padding:14px;border:1px solid #d4decf;border-radius:16px;background:#fffdf7;box-shadow:0 12px 36px #183d3020;text-align:left}
.moveide-coach-account .coach-account-panel small{font-size:12px;line-height:1.5;color:#62715e;padding:0 2px 4px}.moveide-coach-account .coach-account-panel button{text-align:left;width:100%;border-radius:10px}.moveide-coach-account .coach-account-panel button:last-child{background:#f4eee6;border-color:#e2d7ca}.moveide-coach-account button:disabled{opacity:.6;cursor:wait}
`;
  doc.head.append(style); host.classList.add('moveide-coach-account'); host.setAttribute('aria-label', 'ChatGPT connection');
  const status = doc.createElement('span'); status.className = 'coach-state'; status.setAttribute('role', 'status');
  const connect = doc.createElement('button'); connect.type = 'button'; connect.textContent = 'Connect ChatGPT';
  const details = doc.createElement('details'), summary = doc.createElement('summary'), disconnect = doc.createElement('button');
  const icon = doc.createElement('img'); icon.src = '/icons/material/account_circle.svg'; icon.alt = ''; icon.setAttribute('aria-hidden','true');
  summary.append(icon, doc.createTextNode('Account')); summary.setAttribute('aria-label', 'Account options'); disconnect.type = 'button'; disconnect.textContent = 'Disconnect ChatGPT';
  const reconnect = doc.createElement('button'); reconnect.type = 'button'; reconnect.textContent = 'Reconnect ChatGPT';
  const note = doc.createElement('small'); note.textContent = 'Requires an eligible ChatGPT account. Local analysis works without it.';
  const panel = doc.createElement('div'); panel.className = 'coach-account-panel'; panel.append(note, reconnect, disconnect);
  details.append(summary, panel); host.append(status, connect, details);
  const placePanel = () => {
    const pageZoom = Number.parseFloat(win.getComputedStyle(doc.documentElement).zoom) || 1;
    host.style.zoom = String(1 / pageZoom);
    if (!details.open) return;
    panel.style.transform = '';
    const bounds = panel.getBoundingClientRect();
    const shift = bounds.left < 12 ? 12 - bounds.left : bounds.right > win.innerWidth - 12 ? win.innerWidth - 12 - bounds.right : 0;
    panel.style.transform = `translateX(${shift}px)`;
  };
  const closeMenu = () => { details.open = false; };
  const outside = event => { if (!details.contains(event.target)) closeMenu(); };
  const leave = event => { if (event.relatedTarget && !details.contains(event.relatedTarget)) closeMenu(); };
  const escape = event => { if (event.key === 'Escape' && details.open) { event.preventDefault(); closeMenu(); summary.focus(); } };
  details.addEventListener('toggle', placePanel); details.addEventListener('focusout', leave);
  doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', escape); win.addEventListener('resize', placePanel); placePanel();
  let state = 'checking', pending = false, popup, timer, polls = 0, lastCheck = -Infinity, disposed = false;
  const render = message => { status.dataset.state = state; status.textContent = message ?? `ChatGPT · ${state === 'connected' ? 'Connected' : state === 'connecting' ? 'Finish sign-in' : state === 'checking' ? 'Checking…' : state === 'unavailable' ? 'Unavailable here' : 'Not connected'}`; connect.hidden = state === 'connected'; connect.disabled = pending; details.hidden = state !== 'connected'; if (details.hidden) closeMenu(); };
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
  return () => { disposed = true; abort.abort(); clearInterval(timer); win.removeEventListener('focus', focus); doc.removeEventListener('visibilitychange', focus); doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', escape); win.removeEventListener('resize', placePanel); style.remove(); host.classList.remove('moveide-coach-account'); host.replaceChildren(); };
}
