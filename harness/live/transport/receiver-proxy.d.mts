import type { IncomingMessage, ServerResponse } from 'node:http';

/** Private same-origin receiver bridge to fixed loopback signalling on port 4176. */
export function createReceiverProxy(options: { origin: string }): (
  request: IncomingMessage,
  response: ServerResponse,
  next: (error?: unknown) => void,
) => void;
