import type { Session } from './index.mjs';
export const PORTABLE_SESSION_LIMITS: Readonly<{fileBytes:number;metadataBytes:number}>;
/** Original video and all saved JPEGs included. Checks integrity; no credentials or network. */
export function exportSessionBundle(session: Session): Promise<Blob>;
/** Validates before one atomic save, returns a fresh ID; never overwrites. Unfinished reviews become cancelled. */
export function importSessionBundle(blob: Blob): Promise<string>;
