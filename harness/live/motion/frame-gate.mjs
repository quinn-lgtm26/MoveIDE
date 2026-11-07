/** One in-flight operation, no pending queue. New callbacks are dropped while busy. */
export function createFrameGate({ maxHz = 15 } = {}) {
  if (!Number.isFinite(maxHz) || maxHz <= 0 || maxHz > 60) throw new RangeError('maxHz must be in (0, 60].');
  let busy = false, stopped = false, lastTime = -Infinity, generation = 0;
  const counts = { presentedFrames: 0, acceptedFrames: 0, droppedBusy: 0, droppedCadence: 0, droppedNonMonotonic: 0 };
  return {
    async offer(timestampMs, operation, deliver, fail) {
      if (stopped) return false;
      counts.presentedFrames++;
      if (!Number.isFinite(timestampMs) || timestampMs <= lastTime) { counts.droppedNonMonotonic++; return false; }
      if (busy) { counts.droppedBusy++; return false; }
      if (timestampMs - lastTime < 1000 / maxHz - .5) { counts.droppedCadence++; return false; }
      lastTime = timestampMs; busy = true; counts.acceptedFrames++;
      const current = generation;
      try {
        const value = await operation();
        if (!stopped && current === generation) deliver(value);
      } catch (error) {
        if (!stopped && current === generation) fail(error);
      } finally { busy = false; }
      return true;
    },
    stop() { stopped = true; generation++; },
    stats() { return { ...counts, inFlight: busy, stopped, lastAcceptedTimestampMs: Number.isFinite(lastTime) ? lastTime : null }; },
  };
}
