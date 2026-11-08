import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagnosticLog } from './session-diagnostics.mjs';
test('operational diagnostics are bounded and omit sensitive or arbitrary payloads', () => {
  let time = 0; const log = createDiagnosticLog({ limit: 2, now: () => time });
  log.append('capture', { source: 'phone', url: 'https://private/invite', token: 'secret', image: 'data:image/jpeg' });
  time = 250; log.append('sample', { fps: 3.4, latencyMs: Infinity, reason: 'tracking-gap', state: 'https://private/' });
  time = 500; log.append('review', { state: 'analyzing', packet: { private: true }, message: 'private text' });
  assert.deepEqual(log.snapshot(), [{ elapsedMs: 250, event: 'sample', fps: 3.4, reason: 'tracking-gap' }, { elapsedMs: 500, event: 'review', state: 'analyzing' }]);
  log.snapshot()[0].fps = 100;
  assert.equal(log.snapshot()[0].fps, 3.4);
  log.reset(); time = 600; assert.equal(log.append('start').elapsedMs, 100);
});
