const keys = ['kind', 'text', 'sourceTimestampMs', 'sequence'];
const bytes = value => new TextEncoder().encode(value).length;

function valid(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) &&
    ['local', 'ai', 'status'].includes(value.kind) && typeof value.text === 'string' &&
    value.text.trim().length > 0 && value.text.length <= 1200 &&
    (value.sourceTimestampMs === null || Number.isSafeInteger(value.sourceTimestampMs) && value.sourceTimestampMs >= 0) &&
    Number.isSafeInteger(value.sequence) && value.sequence > 0;
}

export function encodeFeedback(payload, sequence) {
  if (!payload || Object.keys(payload).length !== 3 || !['kind', 'text', 'sourceTimestampMs'].every(key => Object.hasOwn(payload, key))) return null;
  const value = { ...payload, sequence };
  if (!valid(value)) return null;
  const encoded = JSON.stringify(value);
  return bytes(encoded) <= 4096 ? encoded : null;
}

export function decodeFeedback(encoded, previousSequence = 0) {
  if (typeof encoded !== 'string' || encoded.length > 4096 || bytes(encoded) > 4096) return null;
  try {
    const value = JSON.parse(encoded);
    return valid(value) && value.sequence > previousSequence ? value : null;
  } catch { return null; }
}
