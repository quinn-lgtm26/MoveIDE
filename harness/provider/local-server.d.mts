import type { IncomingMessage, ServerResponse } from 'node:http';

export function createProviderMiddleware(options: {
  origin: string;
  returnPath?: string;
  enabled?: boolean;
  directory?: string;
  fetcher?: typeof fetch;
  jwks?: unknown;
}): (request: IncomingMessage, response: ServerResponse, next: () => void) => Promise<void>;
