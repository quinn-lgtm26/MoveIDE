/** Video-only local-network transport. The analysis owner consumes onStream(MediaStream). */
const ROOM = /^[a-f0-9]{32}$/;
const INVITE = /^[A-Za-z0-9_-]{43}$/;

async function api(base, path, { token, method = 'GET', body, signal } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, signal, credentials: 'omit', cache: 'no-store',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error((await response.json()).error || `Pairing failed (${response.status}).`);
  return response;
}

function baseUrl(value = location.origin) {
  const url = new URL(value);
  if (url.origin !== location.origin) throw new Error('Signalling must use the same origin as this page.');
  return url.origin;
}

export async function createPairing({ baseUrl: base } = {}) {
  const pairing = await (await api(baseUrl(base), '/rooms', { method: 'POST' })).json();
  const phoneUrl = new URL('/phone', pairing.publicOrigin);
  phoneUrl.hash = new URLSearchParams({ room: pairing.roomId, invite: pairing.senderInvite });
  return { ...pairing, phoneUrl: phoneUrl.href };
}

export function readPhoneInvite(url = location.href) {
  const params = new URLSearchParams(new URL(url).hash.slice(1));
  const roomId = params.get('room'), invite = params.get('invite');
  if (!ROOM.test(roomId ?? '') || !INVITE.test(invite ?? '')) throw new Error('Invalid pairing link. Start a new session on the laptop.');
  return { roomId, invite };
}

export function connectReceiver(pairing, options = {}) {
  return connectPeer({ roomId: pairing.roomId, invite: pairing.receiverInvite }, 'receiver', options);
}

export function connectPhone(invite, options = {}) {
  return connectPeer(invite, 'sender', options);
}

async function connectPeer({ roomId, invite }, role, {
  baseUrl: base, onState = () => {}, onStream = () => {}, signal, stream: suppliedStream,
} = {}) {
  if (!ROOM.test(roomId ?? '') || !INVITE.test(invite ?? '')) throw new Error('Invalid pairing invite.');
  const origin = baseUrl(base), path = `/rooms/${roomId}`;
  const abort = new AbortController();
  let token, peer, stream, connectionTimer, stopped = false, sendTail = Promise.resolve(), eventTail = Promise.resolve();
  const pendingCandidates = [];
  const state = (status, detail = '') => onState({ status, detail });
  const stop = async (reason = 'stopped') => {
    if (stopped) return;
    stopped = true;
    clearTimeout(connectionTimer);
    // Revocation is best effort: disconnecting SSE also revokes server-side.
    const revoke = token ? api(origin, path, { method: 'DELETE', token }).catch(() => {}) : Promise.resolve();
    abort.abort();
    signal?.removeEventListener('abort', externalStop);
    peer?.close();
    for (const track of stream?.getTracks() ?? []) track.stop();
    for (const receiver of peer?.getReceivers() ?? []) receiver.track?.stop();
    onStream(null);
    state('closed', reason);
    await revoke;
  };
  const externalStop = () => { void stop('cancelled'); };
  signal?.addEventListener('abort', externalStop, { once: true });
  if (signal?.aborted) { await stop('cancelled'); throw new DOMException('Cancelled', 'AbortError'); }
  const send = body => {
    sendTail = sendTail.then(() => api(origin, `${path}/signal`, { token, method: 'POST', body, signal: abort.signal }));
    return sendTail;
  };
  const fail = error => { if (!stopped) void stop(error.message || 'Connection failed. Start a new session.'); };
  try {
    state('pairing', role === 'sender' ? 'Connecting to laptop' : 'Waiting for phone');
    ({ token } = await (await api(origin, `${path}/join`, { token: invite, method: 'POST', body: { role }, signal: abort.signal })).json());
    peer = new RTCPeerConnection({ iceServers: [] });
    peer.onicecandidate = event => { if (event.candidate && !stopped) void send({ type: 'candidate', candidate: event.candidate.toJSON() }).catch(fail); };
    peer.ontrack = event => { stream = event.streams[0] ?? new MediaStream([event.track]); onStream(stream); };
    peer.onconnectionstatechange = () => {
      if (stopped) return;
      if (peer.connectionState === 'connected') { clearTimeout(connectionTimer); state('connected', 'Video is streaming'); }
      else if (['failed', 'disconnected'].includes(peer.connectionState)) void stop('Connection lost. Start a new session.');
      else {
        state('connecting', peer.connectionState);
        if (peer.connectionState === 'connecting' && !connectionTimer) connectionTimer = setTimeout(() => {
          void stop('Could not connect devices. Check Wi-Fi isolation and start a new session.');
        }, 25_000);
      }
    };
    const handle = async event => {
      if (stopped) return;
      if (event.type === 'closed') { await stop(event.reason); return; }
      if (event.type === 'candidate') {
        if (!peer.remoteDescription) {
          if (pendingCandidates.length >= 100) throw new Error('Too many pending ICE candidates.');
          pendingCandidates.push(event.candidate);
        } else await peer.addIceCandidate(event.candidate);
        return;
      }
      if ((role === 'receiver' && event.type === 'offer') || (role === 'sender' && event.type === 'answer')) {
        await peer.setRemoteDescription({ type: event.type, sdp: event.sdp });
        for (const candidate of pendingCandidates.splice(0)) await peer.addIceCandidate(candidate);
        if (role === 'receiver') {
          await peer.setLocalDescription(await peer.createAnswer());
          await send({ type: 'answer', sdp: peer.localDescription.sdp });
        }
      }
    };
    const events = await api(origin, `${path}/events`, { token, signal: abort.signal });
    const readEvents = async () => {
      const reader = events.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) { await eventTail; if (!stopped) await stop('Signalling disconnected. Start a new session.'); break; }
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 140_000) throw new Error('Signalling buffer limit exceeded.');
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (frame.startsWith('data: ')) {
            const event = JSON.parse(frame.slice(6));
            eventTail = eventTail.then(() => handle(event));
            await eventTail;
          }
        }
      }
    };
    void readEvents().catch(fail);
    if (role === 'sender') {
      if (!suppliedStream && !navigator.mediaDevices?.getUserMedia) throw new Error('Open the HTTPS phone link to enable the camera.');
      state('permission', 'Allow camera access; microphone stays off');
      stream = suppliedStream ?? await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
      });
      if (stopped) { for (const track of stream.getTracks()) track.stop(); throw new DOMException('Cancelled', 'AbortError'); }
      for (const track of stream.getAudioTracks()) track.stop();
      onStream(stream);
      for (const track of stream.getVideoTracks()) {
        track.addEventListener('ended', () => { void stop('Camera stopped. Start a new session.'); }, { once: true });
        peer.addTrack(track, stream);
      }
      await peer.setLocalDescription(await peer.createOffer());
      await send({ type: 'offer', sdp: peer.localDescription.sdp });
    }
    return { stop, peer, get stream() { return stream; } };
  } catch (error) {
    await stop(error.message);
    throw error;
  }
}
