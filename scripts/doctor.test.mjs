import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { diagnose, probePort } from './doctor.mjs';

test('doctor identifies missing and corrupt setup without installing or modifying it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moveide-doctor-'));
  try {
    const directory = join(root, 'harness/public/pose');
    await mkdir(directory, { recursive: true });
    const corrupt = join(directory, 'pose_landmarker_heavy.task');
    await writeFile(corrupt, 'incomplete-download');
    const result = await diagnose({ root, services: false });
    assert.equal(result.ready, false);
    assert.equal(result.readOnly, true);
    assert.equal(result.checks.find(check => check.name === 'Locked dependencies').status, 'fail');
    assert.match(result.checks.find(check => check.name === 'heavy model').detail, /do not match/);
    assert.match(result.checks.find(check => check.name === 'full model').detail, /missing/);
    assert.equal(result.checks.find(check => check.name === 'WASM/runtime').status, 'fail');
    assert.equal(await readFile(corrupt, 'utf8'), 'incomplete-download');
    assert.deepEqual(await readdir(root), ['harness']);
    assert.deepEqual(await readdir(directory), ['pose_landmarker_heavy.task']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('port probing reports an occupied listener without changing its lifecycle', async () => {
  const server = createServer(socket => socket.end());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await probePort(port), 'occupied');
    assert.equal(server.listening, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(await probePort(port), 'free');
});
