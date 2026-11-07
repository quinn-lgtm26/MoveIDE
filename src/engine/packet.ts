// BE-2: the coaching packet. Selected numbers, a short summary, and timestamped evidence refs whose JPEGs are
// captured separately (captureFrames in analyze.ts). Never the clip, the landmark trace, or credentials.
import type { AnalysisReport, CoachPacket } from '../contract.ts';

export const MAX_EVIDENCE = 4;

export function buildPacket(
  report: AnalysisReport,
  repIds: string[],
  { charterVersion, goal }: { charterVersion: string; goal?: string },
): CoachPacket {
  const reps = repIds.map((id) => report.reps.find((r) => r.id === id) ?? fail(`Unknown rep ${id}`));
  // No reps selected: the clip-level values (repId null), e.g. BE-1's deepest-point fallback.
  const picked = report.measurements.filter((m) =>
    m.quality === 'usable' && (repIds.length ? repIds.includes(m.repId ?? '') : m.repId === null));
  const measurements = picked.map(({ id, repId, metric, value, unit, evidenceTimestampMs }) =>
    ({ id, repId, metric, value, unit, evidenceTimestampMs }));

  // Bottoms first, so both rep bottoms make the cut when two reps are compared.
  const times = [...new Set([...reps.map((r) => r.bottomMs), ...picked.map((m) => m.evidenceTimestampMs as number)])]
    .slice(0, MAX_EVIDENCE).sort((a, b) => a - b);
  const evidence = times.map((t) => ({ id: `f-${t}`, timestampMs: t, imageName: `frame-${t}ms.jpg` }));

  const fmt = (m: (typeof measurements)[number]) => `${m.repId ?? 'clip'} ${m.metric} ${m.value} ${m.unit} at ${m.evidenceTimestampMs} ms`;
  const summary = [
    `Squat clip ${report.clip.id}, ${report.protocol.side ?? 'no'} side tracked, ${report.reps.length} complete rep(s).`,
    `Selected: ${repIds.join(', ') || 'whole clip'}.`,
    ...measurements.map(fmt),
    ...report.warnings.map((w) => `Warning: ${w.message}`),
  ].join('\n');

  return {
    schemaVersion: 1,
    protocolVersion: report.protocol.version,
    charterVersion,
    ...(goal ? { goal } : {}),
    summary,
    repIds,
    measurements,
    evidence,
  };
}

function fail(msg: string): never { throw new Error(msg); }
