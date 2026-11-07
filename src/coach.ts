// FE-3: rep-pair comparison and the manual coaching handoff. Pure, so node:test can cover it.
// Reads report.reps / report.measurements generically; BE-2 supplies the real ones.
import type { AnalysisReport, CoachPacket, EvidenceRef, Measurement, Rep } from './contract.ts';
import { LM } from './contract.ts';
import { kneeFlexion } from './engine/angles.ts';

export const CHARTER_VERSION = 'magna-carta-1';
// ponytail: inline until BE-4 owns the versioned prompt; swap for its export then.
export const CHARTER = `MoveIDE Magna Carta (${CHARTER_VERSION})
You are reviewing estimated 2D squat measurements from a single phone clip.
- Explain only the evidence provided: the measurements below and the attached frames, referenced by their IDs.
- Keep observations (what the numbers and frames show) separate from interpretation (what it might mean).
- Flag uncertainty: values are estimates in the video plane and may be affected by camera angle or tracking.
- Suggest one coaching focus grounded in the submitted evidence.
- No clinical diagnosis, treatment, or injury advice.`;

export type RepRow = { rep: Rep; knee?: Measurement; duration?: Measurement };

export function repRow(report: AnalysisReport, repId: string): RepRow | null {
  const rep = report.reps.find((r) => r.id === repId);
  if (!rep) return null;
  const of = (metric: Measurement['metric']) => report.measurements.find((m) => m.repId === repId && m.metric === metric);
  return { rep, knee: of('knee_flexion'), duration: of('rep_duration') };
}

const usable = (m?: Measurement): m is Measurement & { value: number } => !!m && m.quality === 'usable' && m.value !== null;

/** b − a when both usable, else null. */
export function delta(a?: Measurement, b?: Measurement): number | null {
  return usable(a) && usable(b) ? Math.round((b.value - a.value) * 10) / 10 : null;
}

export const fmtValue = (m?: Measurement) =>
  !usable(m) ? 'unavailable' : m.unit === 'deg' ? `${m.value.toFixed(1)}°` : `${Math.round(m.value)} ms`;

export function summarize(a: RepRow, b: RepRow): string {
  const part = (label: string, x?: Measurement, y?: Measurement) => {
    const d = delta(x, y);
    const unit = (x ?? y)?.unit === 'deg' ? '°' : ' ms';
    return `${label} ${fmtValue(x)} vs ${fmtValue(y)}${d === null ? '' : ` (${d > 0 ? '+' : ''}${d}${unit})`}`;
  };
  return `Squat reps ${a.rep.id} and ${b.rep.id}: ${part('knee flexion at bottom', a.knee, b.knee)}; ${part('rep duration', a.duration, b.duration)}. Estimated 2D values from one side-view clip.`;
}

const MAX_FRAMES = 4; // contract: default preview uses up to four frames, both rep bottoms first

/** CoachPacket v1 for the selected pair. Evidence = rep bottoms, then other usable measurement timestamps. */
export function buildPacket(report: AnalysisReport, a: RepRow, b: RepRow, goal?: string): CoachPacket {
  const ms = [a.knee, a.duration, b.knee, b.duration].filter(usable);
  const times = [a.rep.bottomMs, b.rep.bottomMs, ...ms.map((m) => m.evidenceTimestampMs!)];
  const evidence: EvidenceRef[] = [...new Set(times)].slice(0, MAX_FRAMES)
    .map((t) => ({ id: `frame-${t}`, timestampMs: t, imageName: `${report.clip.id}-${t}ms.jpg` }));
  return {
    schemaVersion: 1,
    protocolVersion: report.protocol.version,
    charterVersion: CHARTER_VERSION,
    ...(goal?.trim() ? { goal: goal.trim() } : {}),
    summary: summarize(a, b),
    repIds: [a.rep.id, b.rep.id],
    measurements: ms.map(({ id, repId, metric, value, unit, evidenceTimestampMs }) => ({ id, repId, metric, value, unit, evidenceTimestampMs })),
    evidence,
  };
}

/** Manual handoff text: Charter, packet, and which files to attach. */
export function packetText(packet: CoachPacket): string {
  return `${CHARTER}

Coaching packet (CoachPacket v1):
${JSON.stringify(packet, null, 2)}

Attached images (one JPEG per evidence ID):
${packet.evidence.map((e) => `- ${e.id}: ${e.imageName} @ ${e.timestampMs} ms`).join('\n')}`;
}

/** Dev only (?synthetic): stand-in reps at the sample clip's hand-labeled bottoms, measured from real frames. */
// ponytail: delete once BE-2's segmentation lands in buildReport.
export function withSyntheticReps(report: AnalysisReport): AnalysisReport {
  if (report.reps.length || !report.frames.length) return report;
  const side = report.protocol.side ?? 'right';
  const reps: Rep[] = [], measurements: Measurement[] = [];
  [1067, 2667].forEach((labeled, i) => {
    const f = report.frames.reduce((p, c) => (Math.abs(c.timestampMs - labeled) < Math.abs(p.timestampMs - labeled) ? c : p));
    const id = `rep-${i + 1}`, t = f.timestampMs;
    const rep = { id, startMs: Math.max(0, t - 600), bottomMs: t, endMs: Math.min(report.clip.durationMs, t + 600 + i * 66) };
    const { hip, knee, ankle } = LM[side];
    // Deepest measurable frame inside the rep (tracking often drops right at the bottom).
    let best: { t: number; deg: number } | null = null;
    for (const g of report.frames) {
      if (g.timestampMs < rep.startMs || g.timestampMs > rep.endMs) continue;
      const deg = kneeFlexion(g.landmarks[hip], g.landmarks[knee], g.landmarks[ankle], report.clip.widthPx, report.clip.heightPx);
      if (deg !== null && (!best || deg > best.deg)) best = { t: g.timestampMs, deg };
    }
    reps.push(rep);
    measurements.push(
      best === null
        ? { id: `m-knee-${id}`, repId: id, metric: 'knee_flexion', value: null, unit: 'deg', quality: 'unavailable', evidenceTimestampMs: null }
        : { id: `m-knee-${id}`, repId: id, metric: 'knee_flexion', value: Math.round(best.deg * 100) / 100, unit: 'deg', quality: 'usable', evidenceTimestampMs: best.t },
      { id: `m-dur-${id}`, repId: id, metric: 'rep_duration', value: rep.endMs - rep.startMs, unit: 'ms', quality: 'usable', evidenceTimestampMs: t },
    );
  });
  return { ...report, reps, measurements: [...report.measurements, ...measurements], warnings: report.warnings.filter((w) => w.code !== 'no_complete_reps') };
}
