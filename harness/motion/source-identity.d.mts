import type { AnalysisReport, ClipSource } from './analyze.mjs';
export function bindReportSource(report: AnalysisReport, source: ClipSource): void;
export function reportSourceMatches(report: AnalysisReport, source: ClipSource): boolean;
export function sourceBindingStatus(report: AnalysisReport): 'live-bound' | 'unverified-import' | 'invalid-binding';
