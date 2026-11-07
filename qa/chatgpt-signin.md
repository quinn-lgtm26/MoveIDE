# BE-3 · ChatGPT plan sign-in outcome

Local result, kept separate from the Seldon ledger. No tokens are recorded here or in logs.

## 2026-11-07 · passed through the harness provider

- **Flow** · `harness/provider/` (`session.mjs`, `local-server.mjs`): loopback redirect `http://127.0.0.1:4173/api/auth/callback`, PKCE S256, state, nonce, JWKS-verified tokens, refresh and revoke. Credentials stay under `~/.config/moveide/` with owner-only permissions. The browser sees connection state only.
- **Live result** · eligible-account sign-in, model discovery, and a `gpt-6.1-sol` request with the six fixture measurements and two fixture JPEGs returned 200. All observation evidence IDs validated. [Evidence](../harness/results/live-chatgpt-verification.json).
- **Root app** · the workbench now mounts the same provider in Vite (`vite.config.ts`). Run it with:

```bash
npm run build && MOVEIDE_ENABLE_CHATGPT=1 npm run preview
```

Open `http://127.0.0.1:4173`. The dev server on 5173 always reports `unavailable`.

## Superseded · `server/chatgpt.ts` attempt

An earlier separate loopback service on port 8788 got two `400 invalid_grant` responses at the token exchange. We guessed partner-only access, but the harness provider later passed with the same account, so the guess was wrong. That service was removed in favor of the harness provider.

## Fallback

The manual coaching handoff (FE-3 copy packet) still works without an account. The UI treats any state other than `connected` as copy-only.
