import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Compare integer-millisecond browser evidence with independently decoded PTS.
// Zero-origin is deliberate: edit-list/time-origin mapping needs its own oracle.
export function auditSourceTimeline(report, probe) {
  const stream = probe.streams?.[0]
  if (!stream || Number(stream.start_time) !== 0) throw new Error('Only a verified zero-origin video timeline is supported.')
  if (stream.width !== report.clip.widthPx || stream.height !== report.clip.heightPx ||
      stream.side_data_list?.some(item => Number(item.rotation ?? 0) % 360 !== 0)) {
    throw new Error('Display dimensions or rotation require a separate orientation audit.')
  }
  const sourceTimes = probe.frames?.map(frame => Number(frame.best_effort_timestamp_time) * 1000)
  if (!sourceTimes?.length || sourceTimes.some((time, index) => !Number.isFinite(time) || time < 0 ||
      (index > 0 && time <= sourceTimes[index - 1]))) throw new Error('Source presentation timestamps must strictly increase.')
  const byRoundedTime = new Map()
  sourceTimes.forEach((time, index) => {
    const rounded = Math.round(time)
    if (byRoundedTime.has(rounded)) throw new Error('Source timestamps collide at millisecond precision.')
    byRoundedTime.set(rounded, index)
  })
  const samples = report.frames.map(frame => frame.timestampMs)
  if (!samples.length || samples.some((time, index) => !Number.isSafeInteger(time) || time < 0 ||
      time >= report.clip.durationMs || (index > 0 && time <= samples[index - 1]))) {
    throw new Error('Analysis sample timestamps must strictly increase within the clip.')
  }
  const matched = samples.map(timestampMs => ({ timestampMs, sourceFrameIndex: byRoundedTime.get(timestampMs) ?? null }))
  const indices = new Set(matched.filter(item => item.sourceFrameIndex !== null).map(item => item.sourceFrameIndex))
  const omitted = sourceTimes.flatMap((time, index) => indices.has(index) ? [] : [index])
  const unmatched = matched.filter(item => item.sourceFrameIndex === null).map(item => item.timestampMs)
  const intervalRange = times => {
    const intervals = times.slice(1).map((time, index) => time - times[index])
    return intervals.length ? { minMs: Math.min(...intervals), maxMs: Math.max(...intervals) } : null
  }
  return {
    passed: unmatched.length === 0,
    sourceFrameCount: sourceTimes.length,
    analyzedFrameCount: samples.length,
    matchedSourceFrameCount: indices.size,
    sourceFrameCoverage: indices.size / sourceTimes.length,
    everySourceTimestampRepresented: unmatched.length === 0 && omitted.length === 0,
    sourceIntervals: intervalRange(sourceTimes),
    analyzedIntervals: intervalRange(samples),
    omittedSourceFrameIndices: omitted,
    unmatchedAnalysisTimestampsMs: unmatched,
    matches: matched,
  }
}

function main() {
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
  const cases = ['clear-squat', 'supported-squat'].map(name => {
    const clip = new URL(`../../fixtures/squat/${name}.mp4`, import.meta.url)
    const reportPath = new URL(`../results/${name}.analysis-report.v1.json`, import.meta.url)
    const reportBytes = readFileSync(reportPath)
    const probe = JSON.parse(execFileSync('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=start_time,width,height:stream_side_data=rotation:frame=best_effort_timestamp_time',
      '-of', 'json', fileURLToPath(clip),
    ], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }))
    return { clip: `${name}.mp4`, clipSha256: sha256(readFileSync(clip)),
      reportSha256: sha256(reportBytes), ...auditSourceTimeline(JSON.parse(reportBytes), probe) }
  })
  const result = {
    schemaVersion: 1,
    oracle: execFileSync('ffprobe', ['-version'], { encoding: 'utf8' }).split('\n')[0],
    scope: 'Recorded report timestamps versus independently decoded source presentation timestamps, rounded to integer milliseconds. Checks timeline coverage only. Does not prove pixel identity, angle accuracy, orientation, or exact decoding for other files. The analyzer remains a 15 Hz sampler.',
    cases,
  }
  if (process.argv.includes('--write')) writeFileSync(new URL('../results/source-timeline-verification.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
  for (const item of cases) console.log(`${item.clip}: ${item.matchedSourceFrameCount}/${item.sourceFrameCount} source timestamps represented; ${item.unmatchedAnalysisTimestampsMs.length} unmatched analysis timestamps`)
  if (cases.some(item => !item.passed)) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
