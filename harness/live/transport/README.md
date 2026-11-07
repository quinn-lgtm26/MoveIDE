# Phone → laptop video transport

This optional prototype sends rear-camera **video only** through WebRTC and gives the receiver a `MediaStream`. The existing live-analysis module owns pose inference, overlays and coaching. These standalone pages exercise transport; they do not claim to analyze posture.

## Run locally

```sh
node harness/live/transport/server.mjs
# Open http://127.0.0.1:4176/ on the Mac.
```

This server is intentionally separate from the native ChatGPT/provider server on port 4173. It has no provider, OAuth, filesystem-browsing, account, or credential routes. Do not expose port 4173 through a tunnel.

## iPhone + MacBook on the same Wi-Fi

The phone camera needs a secure origin. HTTP on a LAN IP is insufficient; localhost's secure-context exception applies only on the device itself. After deployment is authorized, use either:

1. A trusted HTTPS reverse proxy/tunnel pointing **only at this dedicated 4176 server**. Set `MOVEIDE_STREAM_PUBLIC_ORIGIN=https://your-exact-host.example` to its origin, restart this server, and open the local receiver at `http://127.0.0.1:4176/`. Its pairing link uses the HTTPS origin. Configure the proxy to preserve that public Host or use the upstream `127.0.0.1:4176` Host, disable SSE buffering and allow long-lived responses. Do not attach an app directory or existing provider server to the proxy.
2. A local HTTPS proxy with a certificate trusted by both devices, hostname resolving to the Mac, and the same `MOVEIDE_STREAM_PUBLIC_ORIGIN` setting. Install/trust the development CA on the iPhone explicitly; do not share its private key. An untrusted self-signed certificate is not a reliable iOS camera setup.

The Node server binds loopback by default. `MOVEIDE_STREAM_HOST` and `MOVEIDE_STREAM_PORT` are optional, but a tunnel/proxy can keep the upstream loopback-only. No public tunnel is launched by these scripts. The local and public receiver pages use their own origin for signalling; the phone link crosses devices, not cross-origin fetches.

Start on the Mac → copy the private link (or render `phoneUrl` as a QR in the owning frontend) → open it on iPhone → tap **Start camera** → approve camera access. Browser camera permission is an unavoidable user interaction. Stop on either device closes both peers and revokes the room. Keep the phone page in the foreground and the display awake for the demo. Refreshing/rejoining needs a new Mac session. Each session expires after 10 minutes, including active streaming.

No external STUN/TURN servers are configured, so the normal path is direct local-network video. Same Wi-Fi does not guarantee connectivity: client isolation, mDNS filtering and browser/network differences can prevent ICE from connecting. A production deployment needs a separately provisioned, authenticated TURN service and short-lived credentials for those networks. This prototype does not promise connectivity on isolated venue Wi-Fi. First verify an actual iPhone/Safari ↔ Mac pair at the venue.

## Frontend contract

```js
import { createPairing, connectReceiver, connectPhone, readPhoneInvite } from './client.mjs';

const pairing = await createPairing(); // roomId, invites, expiresAt, publicOrigin, phoneUrl
const receiver = await connectReceiver(pairing, {
  signal: cancellation.signal,
  onStream(stream) {
    video.srcObject = stream; // null when stopped; hand non-null stream to local inference
  },
  onState({ status, detail }) { renderConnectionStatus(status, detail); },
});
// The phone page reads only the fragment, which HTTP servers do not receive.
const phone = await connectPhone(readPhoneInvite(), { onStream, onState });
await receiver.stop(); // or phone.stop(); both sides stop
```

Callbacks use `pairing`, `permission`, `connecting`, `connected`, `closed` states. `closed.detail` explains expiry, cancellation or connection loss; display **Start new session**, rather than silently retrying an old token. Each controller exposes `peer` for diagnostic `getStats()` and `stream` for integration. Callback functions should not throw. `connectPhone` accepts an optional `stream` only for controlled test/input integration; it stops those supplied tracks on cleanup too. Receiver processing should use `requestVideoFrameCallback` or a bounded frame loop and avoid overlapping inference.

All browser requests are same-origin and omit cookies. Importing this module from another origin is not a substitute for serving/proxying its signalling endpoints on the frontend origin. For a credential-free combined live demo, `createTransportServer({staticFiles})` can expose an **explicit** URL allowlist, with entries `{ '/motion.mjs': {path: absolutePath, contentType: 'text/javascript'} }`. Only allow reviewed browser modules/model assets; never mount the repository, native provider routes or a directory catch-all. This integration is intentionally opt-in.

## Controls and boundaries

- Random 128-bit room identifiers and separate 256-bit sender/receiver invites; one peer of each role. Sender gets only its fragment invite, not receiver access.
- Invite is exchanged for a separate Bearer session token. No tokens in URL queries or access logs; do not log/copy pairing secrets into analytics. The UI link itself is a bearer secret.
- 16 concurrent rooms; 10-minute maximum lifetime; 70 KB request, 65 KB SDP, 2 KB ICE-candidate, 128 pending event, 100 client candidate and 256 room signalling limits.
- Host and Origin checks, cross-site rejection, fixed static routes, restrictive CSP, no cookies, no audio permission. Signalling only passes SDP/ICE; video is peer-to-peer. No recording or media upload is implemented.
- Stopping or losing SSE revokes the room, ends event streams, stops tracks and closes peers. Server shutdown and expiry notify connected peers. An abandoned join that never opens SSE expires automatically.
- This is a bounded prototype, not an internet service hardened against distributed abuse. A deployed service still needs ingress limits, operational monitoring and configured TURN before claiming general connectivity.

## Verification

```sh
node --test harness/live/transport/server.test.mjs
# From a workspace with harness dependencies installed; Chrome must be installed:
node harness/live/transport/browser.test.mjs
```

`PLAYWRIGHT_MODULE` can point at an installed Playwright `index.mjs`; `PLAYWRIGHT_CHANNEL` selects a browser channel (default `chrome`). The browser test opens two independent contexts, sends a generated canvas through actual `RTCPeerConnection`, checks decoded green pixels and decoded-frame stats, then checks track and receiver cleanup. This is real local browser transport, not an iPhone/network validation or a pose-accuracy benchmark. The server test covers malformed/unauthorized joins, duplicate sender rejection, origin isolation, size/shape validation, revocation, expiry and shutdown.

Verified on 2026-11-07: both Node tests passed; real Chrome WebRTC test decoded the generated green video and passed stop cleanup. Physical iPhone and venue Wi-Fi verification remains pending.

Primary references: [MDN getUserMedia secure contexts and permissions](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [WebRTC peer connections, signalling and ICE](https://webrtc.org/getting-started/peer-connections), [MDN RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection).
