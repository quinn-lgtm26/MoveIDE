export const OPENCAP_REVISION = '7c5c1dd459835e2482127e55dc45e98d68a1a9f2'
const MAX_ROWS = 250_000
const MAX_MOT_BYTES = 32 * 1024 * 1024
const SHA256 = /^[a-f0-9]{64}$/
const ANGLES = new Set([
  'pelvis_tilt', 'pelvis_list', 'pelvis_rotation',
  'lumbar_extension', 'lumbar_bending', 'lumbar_rotation',
  ...['l', 'r'].flatMap(side => ['hip_flexion', 'hip_adduction', 'hip_rotation',
    'knee_angle', 'ankle_angle', 'subtalar_angle', 'mtp_angle',
    'arm_flex', 'arm_add', 'arm_rot', 'elbow_flex', 'pro_sup',
    'wrist_flex', 'wrist_dev'].map(name => `${name}_${side}`)),
])
const TRANSLATIONS = new Set(['pelvis_tx', 'pelvis_ty', 'pelvis_tz'])
const fail = message => { throw new Error(`OpenCap import: ${message}`) }
const finite = value => typeof value === 'number' && Number.isFinite(value)

/** Parse the upstream OpenSim IK .mot format without executing pickle or model code. */
export function parseOpenSimMotion(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_MOT_BYTES) fail('motion file exceeds 32 MiB or is not text')
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim())
  const end = lines.indexOf('endheader')
  if (end < 0 || end > 100) fail('missing or oversized OpenSim header')
  const header = new Map()
  for (const line of lines.slice(0, end)) {
    const entry = line.match(/^(nRows|nColumns|inDegrees)\s*=\s*(\S+)$/)
    if (!entry) continue
    if (header.has(entry[1])) fail('duplicate header field')
    header.set(entry[1], entry[2])
  }
  if (!/^\d+$/.test(header.get('nRows') ?? '') || !/^\d+$/.test(header.get('nColumns') ?? '')) fail('explicit row and column counts required')
  const nRows = Number(header.get('nRows'))
  const nColumns = Number(header.get('nColumns'))
  const degrees = header.get('inDegrees')
  if (nRows < 1 || nRows > MAX_ROWS || nColumns < 2 || nColumns > 256 || !['yes', 'no'].includes(degrees)) fail('unsupported counts or missing angular units')
  const data = lines.slice(end + 1).filter(Boolean)
  const rawColumns = data.shift()?.split(/\s+/) ?? []
  const columns = rawColumns.map(name => name.startsWith('/jointset/') && name.endsWith('/value') ? name.split('/').at(-2) : name)
  if (columns.length !== nColumns || columns[0] !== 'time' || new Set(columns).size !== columns.length ||
      columns.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) fail('invalid or duplicate coordinate names')
  if (data.length !== nRows) fail('row count does not match header')
  let previous = -Infinity
  const rows = data.map(line => {
    const tokens = line.split(/\s+/)
    if (tokens.length !== nColumns || tokens.some(token => !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(token))) fail('invalid numeric row')
    const row = tokens.map(Number)
    if (!row.every(Number.isFinite) || row[0] < 0 || row[0] <= previous) fail('motion times must increase and all values must be finite')
    previous = row[0]
    return row
  })
  const coordinates = columns.slice(1).flatMap((name, offset) => {
    const unit = ANGLES.has(name) ? 'deg' : TRANSLATIONS.has(name) ? 'm' : null
    return unit ? [{ name, column: offset + 1, unit, scale: unit === 'deg' && degrees === 'no' ? 180 / Math.PI : 1 }] : []
  })
  if (!coordinates.length) fail('no recognized OpenSim kinematic coordinates')
  return { rows, coordinates, excludedCoordinates: columns.slice(1).filter(name => !ANGLES.has(name) && !TRANSLATIONS.has(name)) }
}

async function bytes(value, limit) {
  if (value instanceof Blob) {
    if (value.size > limit) fail('input file is too large')
    return value.arrayBuffer()
  }
  if (value instanceof ArrayBuffer && value.byteLength <= limit) return value
  if (ArrayBuffer.isView(value) && value.byteLength <= limit) return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  fail('expected local file bytes')
}

export async function sha256(value) {
  const buffer = await bytes(value, 512 * 1024 * 1024)
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Import separately produced kinematics, bound to the actual local source and model bytes.
 * The producer-declared row mapping is not independent evidence of temporal accuracy.
 */
export async function importOpenCapResult({ motionText, manifest, source, scaledModel }) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.engine !== 'opencap-monocular' ||
      manifest.upstreamRevision !== OPENCAP_REVISION) fail('unsupported manifest or upstream revision')
  const clip = manifest.source
  if (!clip || typeof clip.clipId !== 'string' || clip.clipId.length < 1 || clip.clipId.length > 200 ||
      !Number.isSafeInteger(clip.durationMs) || clip.durationMs <= 0 || !SHA256.test(clip.sha256 ?? '') ||
      !SHA256.test(manifest.motionSha256 ?? '') || !SHA256.test(manifest.scaledModelSha256 ?? '')) fail('invalid source or output provenance')
  const motion = parseOpenSimMotion(motionText)
  const mapping = manifest.alignment
  if (!mapping || mapping.method !== 'explicit-source-frame-map' || !Array.isArray(mapping.rows) || mapping.rows.length !== motion.rows.length) fail('explicit per-row source frame mapping required')
  let previousTime = -1
  let previousIndex = -1
  const frames = mapping.rows.map((item, row) => {
    if (!item || !Number.isSafeInteger(item.sourceTimestampMs) || item.sourceTimestampMs < 0 ||
        item.sourceTimestampMs > clip.durationMs || item.sourceTimestampMs <= previousTime ||
        !Number.isSafeInteger(item.sourceFrameIndex) || item.sourceFrameIndex <= previousIndex ||
        !finite(item.motionTimeSeconds) || Math.abs(item.motionTimeSeconds - motion.rows[row][0]) > 1e-6) fail('invalid or inconsistent source row mapping')
    previousTime = item.sourceTimestampMs
    previousIndex = item.sourceFrameIndex
    const values = Object.fromEntries(motion.coordinates.map(coordinate => [coordinate.name, motion.rows[row][coordinate.column] * coordinate.scale]))
    if (!Object.values(values).every(Number.isFinite)) fail('coordinate conversion overflow')
    return { timestampMs: item.sourceTimestampMs, sourceFrameIndex: item.sourceFrameIndex,
      motionTimeSeconds: item.motionTimeSeconds, values }
  })
  const [sourceHash, motionHash, modelHash] = await Promise.all([
    sha256(source), sha256(new TextEncoder().encode(motionText)), sha256(scaledModel),
  ])
  if (sourceHash !== clip.sha256 || motionHash !== manifest.motionSha256 || modelHash !== manifest.scaledModelSha256) fail('source video, motion, or scaled model hash mismatch')
  return {
    schemaVersion: 1,
    kind: 'opencap-kinematics',
    status: 'imported-unverified',
    source: { ...clip },
    engine: { id: 'opencap-monocular', revision: OPENCAP_REVISION },
    provenance: { motionSha256: motionHash, scaledModelSha256: modelHash, alignment: 'producer-declared' },
    coordinateSystem: 'OpenSim model generalized coordinates',
    coordinates: motion.coordinates.map(({ name, unit }) => ({ name, unit })),
    excludedCoordinates: motion.excludedCoordinates,
    frames,
    limitations: ['No OpenCap inference or accuracy validation is performed by this importer.',
      'Source-row mapping is declared by the producing pipeline and needs independent timestamp and pixel verification.',
      'Model generalized coordinates are distinct from MediaPipe projected angles. Do not combine them into one score.',
      'The motion file has no per-coordinate confidence. Do not present imported rows as verified tracking.'],
  }
}

/** Resolve playback to a declared original-source row, without crossing missing frames. */
export function openCapFrameAt(result, timestampMs, maxGapMs = 100) {
  if (!finite(timestampMs) || !finite(maxGapMs) || maxGapMs < 0) return null
  const frames = result.frames
  if (!frames?.length || timestampMs < frames[0].timestampMs || timestampMs > frames.at(-1).timestampMs) return null
  let lower = 0
  let upper = frames.length - 1
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2)
    if (frames[middle].timestampMs < timestampMs) lower = middle + 1
    else upper = middle
  }
  const next = frames[lower]
  if (next.timestampMs === timestampMs) return next
  const previous = frames[lower - 1]
  if (!previous || next.sourceFrameIndex - previous.sourceFrameIndex !== 1) return null
  const nearest = timestampMs - previous.timestampMs <= next.timestampMs - timestampMs ? previous : next
  return Math.abs(nearest.timestampMs - timestampMs) <= maxGapMs ? nearest : null
}
