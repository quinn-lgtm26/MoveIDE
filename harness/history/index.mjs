/** Local-only history. No fetch, provider connection, credentials, or automatic deletion. */
import { validateCoachPacket, validateCoachingResponse } from '../coaching/packet.mjs';
import { getCoachingSegments } from '../coaching/playback.mjs';
import { validateHistoryReport } from './report-validation.mjs';
export const HISTORY_LIMITS = Object.freeze({ videoBytes: 100 * 1024 ** 2, appBytes: 500 * 1024 ** 2,
  metadataBytes: 8 * 1024 ** 2, evidenceImages: 18, evidenceImageBytes: 1024 ** 2,
  liveSamples: 10_000, liveNotes: 512, liveReps: 2000, liveRepReviews: 150 });
const DB_NAME = 'moveide-history-v1';
let databasePromise;
export class HistoryError extends Error {
  constructor(code, message) { super(message); this.name = 'HistoryError'; this.code = code; }
}
const fail = (code, message) => { throw new HistoryError(code, message); };
function translate(error) {
  if (error instanceof HistoryError) return error;
  if (error?.name === 'QuotaExceededError') return new HistoryError('quota_exceeded', 'Browser storage is full. Export or delete an older session, then save again. Nothing was automatically deleted.');
  return new HistoryError('storage_unavailable', 'Local history storage is unavailable. Check browser storage permissions or private browsing, then retry.');
}
function validateId(id) { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,96}$/.test(id)) fail('invalid_input', 'Choose a valid local session ID.'); }
function plain(value, depth = 0) {
  if (depth > 32) fail('invalid_input', 'History data is nested too deeply.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) { for (const item of value) plain(item, depth + 1); return; }
  if (typeof value === 'object' && value && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    for (const [key, item] of Object.entries(value)) {
      if (/^(accessToken|refreshToken|authorization|apiKey|providerCredentials|oauthCredentials|__proto__|constructor|prototype)$/i.test(key)) fail('invalid_input', 'Do not put credentials or executable data in local history.');
      plain(item, depth + 1);
    }
    return;
  }
  fail('invalid_input', 'Session data must contain only finite JSON values; put video and JPEG blobs in their dedicated fields.');
}
function boundedObject(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('invalid_input', `${label} must be a plain object.`);
  plain(value);
}
async function hash(blob) {
  if (!globalThis.crypto?.subtle) fail('storage_unavailable', 'Saving verified recordings requires a secure browser context (HTTPS or localhost).');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
}
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new HistoryError('storage_unavailable', 'This browser does not provide local history storage. Try a normal browser window with storage enabled.'));
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    let settled = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['sessions', 'assets', 'accounting']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
    };
    request.onblocked = () => { settled = true; databasePromise = undefined; reject(new HistoryError('blocked', 'History storage is blocked by another MoveIDE tab. Close older tabs and retry.')); };
    request.onerror = () => { settled = true; databasePromise = undefined; reject(translate(request.error)); };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      const db = request.result;
      db.onversionchange = () => { db.close(); databasePromise = undefined; };
      db.onclose = () => { databasePromise = undefined; };
      resolve(db);
    };
  });
  return databasePromise;
}
function transaction(db, mode, action) {
  return new Promise((resolve, reject) => {
    let result, failure;
    const tx = db.transaction(['sessions', 'assets', 'accounting'], mode);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => { /* onabort handles the final transactional failure. */ };
    tx.onabort = () => reject(failure ?? translate(tx.error));
    const finish = value => { result = value; };
    const abort = error => { failure = translate(error); tx.abort(); };
    try { action(tx, finish, abort); } catch (error) { abort(error); }
  });
}
function readRow(tx, store, id, callback, abort) {
  const request = tx.objectStore(store).get(id);
  request.onsuccess = () => { try { callback(request.result); } catch (error) { abort(error); } };
}
// Heartbeats update liveness only. All other session data and asset identities advance contentRevision.
function contentSnapshot(row, assets) {
  const live = row.live ? { ...row.live } : null;
  if (live) delete live.queueHeartbeatAt;
  return JSON.stringify({ kind: row.kind, title: row.title, createdAt: row.createdAt,
    report: row.report, coaching: row.coaching, live, metadata: row.metadata,
    videoSha256: assets?.videoSha256 ?? null, videoBytes: assets?.video?.size ?? 0,
    evidence: (assets?.evidenceImages ?? []).map(({timestampMs,viewEpoch,phase,repKey,imageSha256,blob}) =>
      ({timestampMs,viewEpoch,phase,repKey,imageSha256,bytes:blob.size,mimeType:blob.type})) });
}
function summary(row) {
  const duration = row.report?.clip?.durationMs ?? row.live?.recording?.durationMs ?? row.metadata?.durationMs;
  const model = row.report?.poseModel?.id ?? row.metadata?.model;
  return { id: row.id, kind: row.kind, title: row.title, createdAt: row.createdAt, updatedAt: row.updatedAt,
    revision: row.revision, contentRevision: row.contentRevision ?? row.revision,
    queueHeartbeatAt: Number.isSafeInteger(row.live?.queueHeartbeatAt) && row.live.queueHeartbeatAt >= 0 ? row.live.queueHeartbeatAt : null, hasVideo: row.videoBytes > 0, videoBytes: row.videoBytes,
    videoSha256: row.videoSha256, evidenceImageCount: row.evidenceImageCount,
    repCount: row.report?.reps?.length ?? row.live?.reps?.length ?? 0,
    durationMs: Number.isFinite(duration) && duration >= 0 ? duration : null,
    model: typeof model === 'string' ? model : null,
    hasCoaching: Boolean(row.coaching || row.live?.notes?.length) };
}
function full(row, assets) {
  return { ...summary(row), schemaVersion: 1, video: assets?.video ?? null, evidenceImages: assets?.evidenceImages ?? [],
    report: row.report, coaching: row.coaching, live: row.live, metadata: row.metadata };
}
function validCoaching(coaching, report) {
  if (!coaching?.packet || !coaching?.response || !Array.isArray(coaching.segments) || !report) return false;
  try {
    validateCoachPacket(coaching.packet); validateCoachingResponse(coaching.response, coaching.packet);
    return JSON.stringify(coaching.segments) === JSON.stringify(getCoachingSegments(coaching.response, coaching.packet, report));
  } catch { return false; }
}
export function createSessionId() { return crypto.randomUUID(); }

/** Create or patch a session. Use patchSession for late responses that must never recreate deleted data. */
export async function saveSession(input) { return writeSession(input, false); }

/** Transactional update only: a deleted/missing session cannot be resurrected by an asynchronous reply. */
export async function patchSession(input) { return writeSession(input, true); }

async function writeSession(input, requireExisting) {
  validateId(input?.id);
  const allowed = new Set(['id', 'kind', 'title', 'createdAt', 'video', 'evidenceImages', 'report', 'coaching', 'live', 'metadata', 'expectedRevision']);
  if (Object.keys(input).some(key => !allowed.has(key))) fail('invalid_input', 'Unknown session field. Put additional plain data in metadata.');
  if (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)) fail('invalid_input', 'expectedRevision must be a nonnegative integer.');
  const hasVideo = Object.hasOwn(input, 'video') && input.video !== undefined, hasEvidence = Object.hasOwn(input, 'evidenceImages') && input.evidenceImages !== undefined;
  let videoHash, preparedImages;
  if (hasVideo) {
    if (input.video !== null && (!(input.video instanceof Blob) || input.video.size === 0)) fail('invalid_input', 'A recording must be a nonempty video Blob or null.');
    if (input.video?.size > HISTORY_LIMITS.videoBytes) fail('limit_exceeded', 'This recording exceeds the 100 MiB video limit. Save a shorter recording or export it instead.');
    videoHash = input.video ? await hash(input.video) : null;
  }
  if (hasEvidence) {
    if (!Array.isArray(input.evidenceImages) || input.evidenceImages.length > HISTORY_LIMITS.evidenceImages) fail('limit_exceeded', 'Keep at most 18 saved evidence JPEGs per session.');
    const keys = new Set();
    preparedImages = await Promise.all(input.evidenceImages.map(async image => {
      if (!image || !Number.isSafeInteger(image.timestampMs) || image.timestampMs < 0 || !Number.isSafeInteger(image.viewEpoch) || image.viewEpoch < 0 ||
          typeof image.phase !== 'string' || image.phase.length > 40 || typeof image.repKey !== 'string' || image.repKey.length > 200 ||
          !(image.blob instanceof Blob) || image.blob.type !== 'image/jpeg' || image.blob.size === 0 || image.blob.size > HISTORY_LIMITS.evidenceImageBytes) fail('invalid_input', 'Evidence needs a timestamp, epoch, rep key and a JPEG of at most 1 MiB.');
      const key = `${image.repKey}:${image.viewEpoch}:${image.timestampMs}`;
      if (keys.has(key)) fail('invalid_input', 'Duplicate evidence image for the same rep, epoch and timestamp.');
      keys.add(key);
      return { timestampMs: image.timestampMs, viewEpoch: image.viewEpoch, phase: image.phase, repKey: image.repKey, blob: image.blob, imageSha256: await hash(image.blob) };
    }));
  }
  for (const key of ['report', 'coaching', 'live', 'metadata']) if (Object.hasOwn(input, key) && input[key] !== undefined) plain(input[key]);
  try {
    const db = await openDatabase();
    return await transaction(db, 'readwrite', (tx, finish, abort) => {
      readRow(tx, 'sessions', input.id, previous => {
        if (requireExisting && !previous) fail('not_found', 'This saved session was deleted or is no longer available. Its late coaching was not saved.');
        if (input.expectedRevision !== undefined && input.expectedRevision !== (previous?.revision ?? 0)) fail('conflict', 'This session changed in another tab. Reopen it before applying your update.');
        const row = { id: input.id, schemaVersion: 1, kind: previous?.kind, title: previous?.title,
          createdAt: previous?.createdAt ?? input.createdAt ?? Date.now(), updatedAt: Date.now(), revision: (previous?.revision ?? 0) + 1,
          report: previous?.report ?? null, coaching: previous?.coaching ?? null, live: previous?.live ?? null, metadata: previous?.metadata ?? {} };
        for (const key of ['kind', 'title', 'report', 'coaching', 'live', 'metadata']) if (Object.hasOwn(input, key) && input[key] !== undefined) row[key] = input[key];
        if (!['recorded', 'live'].includes(row.kind) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 240 || !Number.isSafeInteger(row.createdAt) || row.createdAt < 0) fail('invalid_input', 'A new session needs a kind, a short title and a valid creation time.');
        if (previous && row.kind !== previous.kind) fail('invalid_input', 'A saved session cannot change its recording kind.');
        boundedObject(row.metadata, 'metadata');
        if (previous?.report && JSON.stringify(row.report) !== JSON.stringify(previous.report)) fail('source_changed', 'A saved analysis cannot be replaced or cleared. Create a new session for a new analysis.');
        if (row.report !== null && !validateHistoryReport(row.report)) fail('invalid_input', 'Use a complete AnalysisReport v1 with valid source timestamps, landmarks and measurement references.');
        if (row.coaching !== null && !validCoaching(row.coaching, row.report)) fail('invalid_input', 'Saved coaching and its replay segments must cite the measurements and evidence in this saved report.');
        if (row.live !== null) {
          if (!Array.isArray(row.live.samples) || !Array.isArray(row.live.notes) || row.live.samples.length > HISTORY_LIMITS.liveSamples || row.live.notes.length > HISTORY_LIMITS.liveNotes ||
            (row.live.reps !== undefined && (!Array.isArray(row.live.reps) || row.live.reps.length > HISTORY_LIMITS.liveReps))) fail('limit_exceeded', 'Live history supports 10,000 samples, 512 notes and 2,000 reps per session; export or finish this recording first.');
          boundedObject(row.live.timing, 'live.timing');
          if (row.live.queueHeartbeatAt !== undefined && (!Number.isSafeInteger(row.live.queueHeartbeatAt) || row.live.queueHeartbeatAt < 0)) fail('invalid_input', 'Queue heartbeat must be a nonnegative wall-clock timestamp.');
          if (row.live.repReviews !== undefined) {
            if (!Array.isArray(row.live.repReviews) || row.live.repReviews.length > HISTORY_LIMITS.liveRepReviews) fail('limit_exceeded', 'Live history supports at most 150 rep review statuses.');
            const keys = new Set();
            for (const review of row.live.repReviews) {
              if (!review || typeof review.repKey !== 'string' || !review.repKey || review.repKey.length > 200 || keys.has(review.repKey) ||
                  typeof review.repId !== 'string' || !review.repId || review.repId.length > 200 ||
                  !['viewEpoch', 'timestampMs', 'updatedAt'].every(key => Number.isSafeInteger(review[key]) && review[key] >= 0) ||
                  !['queued', 'analyzing', 'ready', 'failed', 'cancelled', 'not-queued'].includes(review.state) ||
                  typeof review.message !== 'string' || review.message.length > 512) fail('invalid_input', 'Saved rep review statuses need unique rep keys, valid times and a bounded status message.');
              keys.add(review.repKey);
            }
          }
        }
        readRow(tx, 'assets', input.id, oldAssets => {
          if (hasVideo && previous?.videoSha256 && videoHash !== previous.videoSha256) fail('source_changed', 'A saved recording cannot change its video bytes. Create a new session for a different recording, or delete this session to remove it.');
          const assets = { id: input.id, video: hasVideo ? input.video : oldAssets?.video ?? null,
            videoSha256: hasVideo ? videoHash : oldAssets?.videoSha256 ?? null,
            evidenceImages: hasEvidence ? preparedImages : oldAssets?.evidenceImages ?? [] };
          row.videoBytes = assets.video?.size ?? 0; row.videoSha256 = assets.videoSha256;
          row.evidenceImageCount = assets.evidenceImages.length;
          const contentChanged = !previous || contentSnapshot(row, assets) !== contentSnapshot(previous, oldAssets);
          row.contentRevision = (previous?.contentRevision ?? previous?.revision ?? 0) + (contentChanged ? 1 : 0);
          const evidenceBytes = assets.evidenceImages.reduce((sum, image) => sum + image.blob.size, 0);
          const metadataBytes = new TextEncoder().encode(JSON.stringify(row)).byteLength + 1024;
          if (metadataBytes > HISTORY_LIMITS.metadataBytes) fail('limit_exceeded', 'Session data exceeds the 8 MiB metadata limit. Export the session instead of discarding samples.');
          row.storageBytes = row.videoBytes + evidenceBytes + metadataBytes;
          readRow(tx, 'accounting', 'storage', accounting => {
            const bytes = (accounting?.bytes ?? 0) - (previous?.storageBytes ?? 0) + row.storageBytes;
            if (bytes > HISTORY_LIMITS.appBytes) fail('limit_exceeded', 'MoveIDE history reached its 500 MiB limit. Export or delete a session before saving more; nothing was deleted.');
            tx.objectStore('sessions').put(row);
            if (hasVideo || hasEvidence || !previous) tx.objectStore('assets').put(assets);
            tx.objectStore('accounting').put({ id: 'storage', bytes });
            finish(full(row, assets));
          }, abort);
        }, abort);
      }, abort);
    });
  } catch (error) { throw translate(error); }
}

export async function getSession(id) {
  validateId(id);
  try {
    const db = await openDatabase();
    const saved = await transaction(db, 'readonly', (tx, finish, abort) => {
      readRow(tx, 'sessions', id, row => {
        if (!row) { finish(null); return; }
        readRow(tx, 'assets', id, assets => finish({ row, assets }), abort);
      }, abort);
    });
    if (!saved) return null;
    const { row, assets } = saved;
    if (row.report !== null && !validateHistoryReport(row.report)) fail('integrity_error', 'The saved analysis is malformed. Restore your exported session before reviewing its measurements.');
    if (row.coaching !== null && !validCoaching(row.coaching, row.report)) fail('integrity_error', 'Saved coaching does not match this analysis. Restore your exported session before reviewing its advice.');
    if ((row.videoBytes > 0 && (!assets?.video || assets.video.size !== row.videoBytes || await hash(assets.video) !== row.videoSha256)) ||
        (row.videoBytes === 0 && assets?.video)) fail('integrity_error', 'The saved video no longer matches its original bytes. Do not replay this session as verified; restore your exported original.');
    if ((assets?.evidenceImages?.length ?? 0) !== row.evidenceImageCount) fail('integrity_error', 'Saved evidence images are missing. Restore the exported session.');
    for (const image of assets?.evidenceImages ?? []) if (await hash(image.blob) !== image.imageSha256) fail('integrity_error', 'A saved evidence JPEG failed its integrity check. Restore the exported session.');
    return full(row, assets);
  } catch (error) { throw translate(error); }
}
export async function listSessions() {
  try {
    const db = await openDatabase();
    return await transaction(db, 'readonly', (tx, finish) => {
      const request = tx.objectStore('sessions').getAll();
      request.onsuccess = () => finish(request.result.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.id.localeCompare(b.id)).map(summary));
    });
  } catch (error) { throw translate(error); }
}
export async function deleteSession(id) {
  validateId(id);
  try {
    const db = await openDatabase();
    return await transaction(db, 'readwrite', (tx, finish, abort) => {
      readRow(tx, 'sessions', id, row => {
        if (!row) { finish(false); return; }
        readRow(tx, 'accounting', 'storage', accounting => {
          tx.objectStore('sessions').delete(id); tx.objectStore('assets').delete(id);
          tx.objectStore('accounting').put({ id: 'storage', bytes: Math.max(0, (accounting?.bytes ?? 0) - row.storageBytes) });
          finish(true);
        }, abort);
      }, abort);
    });
  } catch (error) { throw translate(error); }
}
export async function storageStatus() {
  const status = { available: false, persisted: null, usageBytes: null, quotaBytes: null, appBytes: 0,
    maxAppBytes: HISTORY_LIMITS.appBytes, maxVideoBytes: HISTORY_LIMITS.videoBytes, localOnly: true };
  try {
    const db = await openDatabase();
    status.appBytes = await transaction(db, 'readonly', (tx, finish, abort) => readRow(tx, 'accounting', 'storage', value => finish(value?.bytes ?? 0), abort));
    status.available = true;
    if (globalThis.navigator?.storage?.estimate) {
      const estimate = await navigator.storage.estimate(); status.usageBytes = estimate.usage ?? null; status.quotaBytes = estimate.quota ?? null;
    }
    if (globalThis.navigator?.storage?.persisted) status.persisted = await navigator.storage.persisted();
  } catch (error) { const failure = translate(error); status.error = { code: failure.code, message: failure.message }; }
  return status;
}

/** JSON-safe export. Video/JPEG byte downloads are separate, named artifacts. */
export function exportSessionData(session) {
  const { video, evidenceImages, ...data } = session;
  return { ...data, video: video ? { bytes: video.size, mimeType: video.type, sha256: session.videoSha256, storedSeparately: true } : null,
    evidenceImages: evidenceImages.map(({ blob, ...image }) => ({ ...image, bytes: blob.size, mimeType: blob.type, storedSeparately: true })) };
}
