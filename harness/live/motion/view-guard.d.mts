import type { Landmark } from '../../motion/analyze.mjs';
export type ViewGuardReason = 'initializing' | 'stable-window' | 'tracking-unavailable' | 'invalid-frame'
  | 'non-monotonic-time' | 'tracking-gap' | 'image-size-changed' | 'abrupt-translation'
  | 'abrupt-scale-change' | 'landmark-identity-change' | 'abrupt-joint-jump' | 'tracking-restored' | 'manual-reset';
export interface ViewGuardResult {
  /** Heuristic pose-geometry continuity only; stable does not prove a static camera or a valid view. */
  state: 'reacquiring' | 'stable' | 'unavailable'; reason: ViewGuardReason;
  /** Clear all front/side relative baselines when this changes; never compare across epochs. */
  epoch: number;
}
export interface ViewGuardOptions {
  /** Continuous, adequately sampled dwell; defaults 500. */
  stableForMs?: number;
  /** Base valid sample gap; defaults 250ms, enlarged only by bounded observed cadence. */
  maxGapMs?: number;
  /** Learn observed valid sample cadence (8 intervals) rather than resetting perpetually below 4Hz. Default true. */
  cadenceAware?: boolean;
  /** Hard ceiling for cadence-aware continuity, default1000ms. Does not relax rep evidence gap limits. */
  maxCadenceGapMs?: number;
  minVisibility?: number;
  /** Jump distances are measured in units of the pixel-corrected image diagonal. */
  translationJump?: number; jointJump?: number; minSideSeparation?: number; minTorsoScale?: number;
  /** Ratio >=1 between successive projected torso scales; defaults 1.25. */
  scaleRatioJump?: number;
  /** Swapped-assignment cost must be less than this fraction of ordinary assignment cost. */
  identityFlipRatio?: number;
}
export function createViewGuard(options?: ViewGuardOptions): {
  update(sample: { landmarks: (Landmark | null)[]; timestampMs: number; widthPx: number; heightPx: number }): ViewGuardResult;
  /** Required after source/session/protocol/front/side changes, even when projected geometry looks similar. */
  reset(): ViewGuardResult;
};
