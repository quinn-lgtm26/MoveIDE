const reportSources = new WeakMap()

function identity(source) {
  if (source instanceof Blob) return source
  try {
    return new URL(source, globalThis.location?.href).href
  } catch {
    return undefined
  }
}

export function bindReportSource(report, source) {
  reportSources.set(report, identity(source))
}

/** JSON imports have no in-memory association; this does not verify imported video bytes. */
export function sourceBindingStatus(report) {
  if (!reportSources.has(report)) return 'unverified-import'
  return reportSources.get(report) === undefined ? 'invalid-binding' : 'live-bound'
}

export function reportSourceMatches(report, source) {
  // Imported report JSON has no live binding. The caller supplies its known source.
  const bound = reportSources.get(report)
  return bound === undefined ? !reportSources.has(report) : bound === identity(source)
}
