import { createPairing, connectReceiver, connectPhone, readPhoneInvite } from './client.mjs';
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
const status = document.querySelector('#status'), video = document.querySelector('#video');
let session, cancellation;
export function renderFeedback(feedback) {
  const local = document.querySelector('#feedback'), ai = document.querySelector('#ai-feedback');
  if (!feedback) { if (local) local.textContent = ''; if (ai) ai.textContent = ''; return; }
  const timestamp = feedback.sourceTimestampMs === null ? '' : ` · ${(feedback.sourceTimestampMs / 1000).toFixed(1)}s`;
  if (feedback.kind === 'ai') {
    if (ai) ai.textContent = `Delayed AI review · last completed rep${timestamp}: ${feedback.text}`;
  } else if (local) local.textContent = `${feedback.kind === 'local' ? 'Local movement feedback' : 'Session status'}${timestamp}: ${feedback.text}`;
}
const options = () => ({
  signal: cancellation.signal,
  onState: ({ status: state, detail }) => {
    status.textContent = detail || state;
    if (state === 'closed') { start.disabled = false; stop.disabled = true; }
  },
  onStream: stream => { video.srcObject = stream; if (stream) void video.play().catch(() => {}); },
  onFeedback: renderFeedback,
});
start.onclick = async () => {
  start.disabled = true; stop.disabled = false; cancellation = new AbortController();
  try {
    if (location.pathname === '/phone') session = await connectPhone(readPhoneInvite(), options());
    else {
      const pairing = await createPairing();
      document.querySelector('#link').value = pairing.phoneUrl;
      session = await connectReceiver(pairing, options());
    }
  } catch (error) { status.textContent = error.message; start.disabled = false; stop.disabled = true; }
};
stop.onclick = () => { cancellation?.abort(); void session?.stop(); };
window.addEventListener('pagehide', () => { cancellation?.abort(); void session?.stop(); });
