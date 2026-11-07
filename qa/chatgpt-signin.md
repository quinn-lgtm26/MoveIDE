# BE-3 · ChatGPT plan sign-in outcome

Local result, kept separate from the Seldon ledger. No tokens are recorded here or in logs.

## 2026-11-07 · blocked at token exchange

- **Flow** · `server/chatgpt.ts`, following OpenAI's [local open-source sign-in docs](https://developers.openai.com/siwc/token-sharing-open-source/sign-in): loopback redirect `http://127.0.0.1:8788/auth/callback`, PKCE S256, state, nonce, and `resource=https://api.openai.com/v1`. The first authorize request used `client_id=dynamic_agent_client` with `agent_name_hint=MoveIDE`.
- **Attempts** · two live sign-ins by the account owner in the browser. Both reached the callback with a valid state and an issued `client_id`. Both token exchanges returned `400 invalid_grant` with no `error_description`. The connection state was `unavailable`.
- **Not tried** · a third sign-in that reuses the saved issued client ID. This is the recovery the docs prescribe. The service now keeps that ID, so the retry is one click: open `/api/auth/start`.
- **Likely cause (unconfirmed)** · OpenAI says Sign in with ChatGPT is [offered to select partners](https://developers.openai.com/siwc/request-client-id) with a waitlist. The request matches the documented fields.
- **Not verified** · plan scope grant, the Responses test request with the fixture frame, and image-capable model selection.

## Demo path

The **manual coaching handoff** (FE-3 copy packet) is the demo path, as BE-3 allows. Measurement, rep comparison, and both Seldon cases need no account. The UI reads `GET /api/connection` and treats any state other than `connected` as copy-only.

## Retry

```bash
PORT=8788 npm run server
```

Open `http://127.0.0.1:8788/api/auth/start`. If it connects, run `curl -s -X POST http://127.0.0.1:8788/api/chatgpt/test` and append the outcome here.
