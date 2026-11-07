import { createPairing, connectReceiver, connectPhone, readPhoneInvite } from './client.mjs';
const start = document.querySelector('#start'), stop = document.querySelector('#stop');
const status = document.querySelector('#status'), video = document.querySelector('#video');
let session, cancellation;
const options = () => ({
  signal: cancellation.signal,
  onState: ({ status: state, detail }) => {
    status.textContent = detail || state;
    if (state === 'closed') { start.disabled = false; stop.disabled = true; }
  },
  onStream: stream => { video.srcObject = stream; if (stream) void video.play().catch(() => {}); },
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
