import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createSupervisor, assertPortFree, extractQuickTunnelOrigin } from './start-demo.mjs';

test('launcher accepts only a complete trusted Quick Tunnel origin from diagnostic output', () => {
  assert.equal(extractQuickTunnelOrigin('Ready https://sample-demo.trycloudflare.com\n'), 'https://sample-demo.trycloudflare.com');
  for (const value of ['http://sample.trycloudflare.com', 'https://sample.trycloudflare.com.attacker.test', 'https://other.test']) {
    assert.equal(extractQuickTunnelOrigin(value), null);
  }
});

test('port preflight refuses an existing server without stopping it', async () => {
  const server = createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await assert.rejects(assertPortFree(port), /already in use/);
    assert.equal(server.listening, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
  await assertPortFree(port);
});

test('supervisor stops owned services and rejects startup after cancellation', async () => {
  const supervisor = createSupervisor();
  const record = supervisor.start(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { ownedService: true });
  await supervisor.stop();
  const outcome = await record.exit;
  assert(outcome.signal || outcome.code !== null);
  assert.throws(() => supervisor.start(process.execPath, ['-e', '']), /canceled/);
});

test('a missing executable produces a bounded spawn failure', async () => {
  const supervisor = createSupervisor();
  const record = supervisor.start('/moveide-nonexistent-test-command', []);
  assert.equal((await record.exit).error, 'ENOENT');
  await supervisor.stop();
});
