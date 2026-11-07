// Adapter over the shared harness engine. Pose assets are served same-origin from harness/public/pose.
import { analyzeSquat } from '../harness/motion/analyze.mjs';
import type { AnalysisReport } from '../harness/motion/analyze.mjs';

export type PoseModel = 'full' | 'heavy';

export function analyze(
  source: string,
  { signal, onProgress, model = 'heavy' }: { signal: AbortSignal; onProgress: (value: number) => void; model?: PoseModel },
): Promise<AnalysisReport> {
  return analyzeSquat(source, { signal, model, onProgress: ({ progress }) => onProgress(progress) });
}
