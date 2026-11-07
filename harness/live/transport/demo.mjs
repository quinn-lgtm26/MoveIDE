import { createPairing, connectReceiver, connectPhone, readPhoneInvite, revokePairing } from './client.mjs';
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
const status = document.querySelector('#status'), video = document.querySelector('#video');
let session, cancellation, pairing;
export function renderFeedback(feedback) {
  const local = document.querySelector('#feedback'), ai = document.querySelector('#ai-feedback');
  if (!feedback) { if (local) local.textContent = ''; if (ai) ai.textContent = ''; return; }
  const timestamp = feedback.sourceTimestampMs === null ? '' : ` · ${(feedback.sourceTimestampMs / 1000).toFixed(1)}s`;
  if (feedback.kind === 'ai') {
    if (ai) ai.textContent = `Delayed AI review · last completed rep${timestamp}: ${feedback.text}`;
  } else if (local) local.textContent = `${feedback.kind === 'local' ? 'Local movement feedback' : 'Session status'}${timestamp}: ${feedback.text}`;
}
function endSession(detail = 'Session stopped. Start a new pairing from the laptop.') {
  const previous = cancellation, active = session, invite = pairing;
  cancellation = null; session = null; pairing = null;
  previous?.abort();
  if (active) void active.stop().catch(() => {});
  else if (invite) void revokePairing(invite).catch(() => {});
  video.srcObject = null; renderFeedback(null);
  const link = document.querySelector('#link'); if (link) link.value = '';
  status.textContent = detail; start.disabled = false; stop.disabled = true;
}
const options = own => ({
  signal: own.signal,
  onState: ({ status: state, detail }) => {
    if (cancellation !== own) return;
    status.textContent = detail || state;
    if (state === 'closed') endSession(detail);
  },
  onStream: stream => { if (cancellation !== own) return; video.srcObject = stream; if (stream) void video.play().catch(() => {}); },
  onFeedback: feedback => { if (cancellation === own) renderFeedback(feedback); },
});
start.onclick = async () => {
  if (cancellation) return;
  const own = new AbortController(); cancellation = own;
  start.disabled = true; stop.disabled = false;
  try {
    let active;
    if (location.pathname === '/phone') active = await connectPhone(readPhoneInvite(), options(own));
    else {
      const created = await createPairing({ signal: own.signal });
      if (cancellation !== own || own.signal.aborted) { void revokePairing(created).catch(() => {}); return; }
      pairing = created;
      document.querySelector('#link').value = pairing.phoneUrl;
      active = await connectReceiver(pairing, options(own));
    }
    if (cancellation !== own || own.signal.aborted) { void active.stop(); return; }
    session = active;
  } catch (error) { if (cancellation === own) endSession(error.message); }
};
stop.onclick = () => endSession();
window.addEventListener('pagehide', () => endSession());
