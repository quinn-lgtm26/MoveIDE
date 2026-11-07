import type { IncomingMessage, ServerResponse } from 'node:http';

/** Private same-origin bridge; defaults to port4176. An override must be an exact loopback origin. */
export function createReceiverProxy(options: { origin: string; upstreamOrigin?: string }): (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) => void;
