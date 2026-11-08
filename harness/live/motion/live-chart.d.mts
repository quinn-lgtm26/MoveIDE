import type { LiveSample, LiveRep } from './index.mjs';
/** Local projected metrics only. Stop retains the graph; reset clears and starts a new session. */
export function createLiveChart(element: HTMLElement, options?: { targetKneeFlexionDeg?: number | null }): {
  push(sample: LiveSample): void;
  rep(event: LiveRep): void;
  reset(): void;
  stop(): void;
};
