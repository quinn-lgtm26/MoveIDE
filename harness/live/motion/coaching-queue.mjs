const failureMessages = Object.freeze({
  provider_disconnected: 'Connect ChatGPT to review this rep; local measurements remain available.',
  reauthorize: 'Reconnect ChatGPT before the next session. This rep could not be reviewed.',
  usage_limit: 'ChatGPT plan usage was reached. This rep remains measured but has no coach note.',
  plan_unavailable: 'ChatGPT plan access is unavailable. This rep remains measured but has no coach note.',
  model_unavailable: 'The selected coach model is unavailable. Reconnect before your next session.',
  invalid_response: 'The coach reply could not be linked to this rep’s evidence, so no note was accepted.',
  incomplete: 'The coach response ended early. No complete note was accepted for this rep.',
});

/** Session-bounded FIFO. Capture Stop does not abort it; source/session cancellation does. */
export function createCoachingQueue({ review, prepare = async () => undefined, onState = () => {}, onResult = () => {}, signal,
  maxReviews = 6, intervalMs = 8000, now = () => performance.now(), schedule = setTimeout, cancelTimer = clearTimeout } = {}) {
  if (typeof review !== 'function' || !Number.isInteger(maxReviews) || maxReviews < 1 || maxReviews > 6 || !Number.isFinite(intervalMs) || intervalMs < 0) throw new TypeError('Invalid bounded review queue.');
  const waiting = [], seen = new Set(); let running = null, timer, nextAt = 0, cancelled = false;
  const state = (item, value, message) => onState(item, value, message);
  const pump = () => {
    if (cancelled || running || !waiting.length) return;
    if (now() < nextAt) { timer = schedule(pump, nextAt - now()); return; }
    const item = waiting.shift(); running = item; state(item, 'analyzing', 'Reviewing this completed rep.');
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const prepared = await prepare(signal);
      if (cancelled) return;
      nextAt = now() + intervalMs;
      return review(item, signal, prepared);
    }).then(result => {
      if (cancelled) return;
      onResult(item, result); state(item, 'ready', 'Coach note ready.');
    }).catch(error => {
      if (!cancelled) state(item, 'failed', Object.hasOwn(failureMessages, error?.code) ? failureMessages[error.code] : 'The rep review failed. Check your coach connection; local measurements remain available.');
    }).finally(() => { running = null; pump(); });
  };
  const cancel = () => {
    if (cancelled) return;
    cancelled = true; cancelTimer(timer);
    for (const item of [...(running ? [running] : []), ...waiting]) state(item, 'cancelled', 'Review cancelled when the session ended or a new session started.');
    waiting.length = 0;
  };
  if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
  return {
    enqueue(item) {
      if (cancelled || seen.has(item.key)) return false;
      if (seen.size >= maxReviews) { state(item, 'not-queued', 'Six-review limit reached. Local measurements remain available.'); return false; }
      seen.add(item.key); waiting.push(item); state(item, 'queued', 'Waiting for its turn. Keep this page open.'); pump(); return true;
    },
    snapshot: () => ({ accepted: seen.size, queued: waiting.length, running: running ? 1 : 0, cancelled }),
    cancel,
  };
}
