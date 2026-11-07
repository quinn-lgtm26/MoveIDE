import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFeedback, decodeFeedback } from './feedback.mjs';
test('feedback strictly validates bounds, timestamps and ordered sequences', () => {
  const valid = { kind: 'local', text: 'Keep your rhythm.', sourceTimestampMs: 1200 };
  const encoded = encodeFeedback(valid, 1);
  assert.deepEqual(decodeFeedback(encoded), { ...valid, sequence: 1 });
  assert.equal(decodeFeedback(encoded, 1), null);
  assert.equal(decodeFeedback(encoded, 2), null);
  assert.equal(encodeFeedback({ ...valid, extra: true }, 1), null);
  assert.equal(encodeFeedback({ ...valid, text: 'x'.repeat(1201) }, 1), null);
  assert.equal(encodeFeedback({ ...valid, text: '😀'.repeat(600) }, 1) !== null, true);
  assert.equal(encodeFeedback({ ...valid, sourceTimestampMs: -1 }, 1), null);
  assert.equal(encodeFeedback({ ...valid, kind: 'raw-pose' }, 1), null);
  assert.equal(decodeFeedback('{malformed'), null);
  assert.equal(decodeFeedback('x'.repeat(4097)), null);
  assert.ok(encodeFeedback({ ...valid, sourceTimestampMs: null }, 2));
});
