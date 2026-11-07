// Frontend ↔ BE-1 seam. The workbench calls this for every clip (imported or built-in sample).
// BE-1 replaces the body: decode frames from `src`, post them to pose.worker.ts, assemble an
// AnalysisReport v1. Report progress in [0, 1]; reject with AbortError when `signal` aborts.
import type { AnalysisReport } from './contract.ts';
import synthetic from '../_bmad-output/specs/shared/analysis-report-v1.example.json';

export type AnalyzeOptions = { signal: AbortSignal; onProgress: (fraction: number) => void };

// ponytail: synthetic stub so the UI builds before BE-1 lands; delete when the real pipeline does.
export async function analyze(_src: string, { signal, onProgress }: AnalyzeOptions): Promise<AnalysisReport> {
  for (let i = 1; i <= 10; i++) {
    await new Promise((r) => setTimeout(r, 60));
    signal.throwIfAborted();
    onProgress(i / 10);
  }
  return synthetic as AnalysisReport;
}
