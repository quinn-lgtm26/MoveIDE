import type { LiveSample, LiveRep } from './index.mjs';
/** Local projected metrics only, rolling 30s / 450 samples. The default knee trace has optional
 * hip/chest controls. Completed source-bound rep events add descent/bottom/return and timing;
 * they never generate an ideal curve. Stop retains the graph; reset clears for a new session. */
export function createLiveChart(element: HTMLElement, options?: { targetKneeFlexionDeg?: number | null }): {
  push(sample: LiveSample): void;
  rep(event: LiveRep): void;
  reset(): void;
  stop(): void;
};
