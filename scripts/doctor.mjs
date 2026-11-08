#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connect } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { missingDependencies } from './start-demo.mjs';
import { POSE_PRESETS } from '../harness/motion/pose-model.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const runtimeFiles = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'];

export async function probePort(port) {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port });
    const finish = state => { socket.destroy(); resolve(state); };
    socket.once('connect', () => finish('occupied'));
    socket.once('error', error => finish(error.code === 'ECONNREFUSED' ? 'free' : 'unavailable'));
    socket.setTimeout(1000, () => finish('unavailable'));
  });
}

/** Read-only local diagnostics; never installs, starts, stops or contacts a public service. */
export async function diagnose({ root = ROOT, services = true } = {}) {
  const checks = [];
  const add = (name, status, detail, next = null) => checks.push({ name, status, detail, next });
  const [major, minor] = process.versions.node.split('.').map(Number);
  add('Node', major > 22 || major === 22 && minor >= 18 ? 'pass' : 'fail', process.versions.node, 'Use Node.js 22.18 or newer.');
  add('Platform', process.platform === 'win32' ? 'fail' : 'pass', process.platform, 'The launcher supports macOS/Linux.');
  const missing = await missingDependencies(root);
  add('Locked dependencies', missing.length ? 'fail' : 'pass', missing.length ? `${missing.map(group => group.name).join(', ')} require repair` : 'Both dependency trees match their direct lockfile versions and entry files.', missing.length ? 'npm run demo -- --setup-only' : null);
  for (const [name, preset] of Object.entries(POSE_PRESETS)) {
    try {
      const valid = digest(await readFile(join(root, 'harness/public/pose', preset.fileName))) === preset.sha256;
      add(`${name} model`, valid ? 'pass' : 'fail', valid ? 'Pinned SHA-256 matches.' : 'Model bytes do not match the pinned manifest.', valid ? null : 'npm run demo -- --setup-only');
    } catch {
      add(`${name} model`, 'fail', 'Model file missing or unreadable.', 'npm run demo -- --setup-only');
    }
  }
  try {
    const equal = await Promise.all(runtimeFiles.map(async name => {
      const [installed, prepared] = await Promise.all([
        readFile(join(root, 'harness/node_modules/@mediapipe/tasks-vision/wasm', name)),
        readFile(join(root, 'harness/public/pose/wasm', name)),
      ]);
      return digest(installed) === digest(prepared);
    }));
    add('WASM/runtime', equal.every(Boolean) ? 'pass' : 'fail', equal.every(Boolean) ? 'All four runtime files match the installed SDK.' : 'Prepared runtime differs from installed SDK.', equal.every(Boolean) ? null : 'npm run demo -- --setup-only');
  } catch { add('WASM/runtime', 'fail', 'Installed or prepared runtime files are missing.', 'npm run demo -- --setup-only'); }
  try {
    await stat(join(root, 'dist/index.html'));
    add('Built UI', 'pass', 'A build exists; this does not prove it matches the current source.', 'npm run demo rebuilds current source before launch.');
  } catch { add('Built UI', 'info', 'No build yet.', 'npm run demo'); }
  if (services) {
    for (const port of [4173, 4176]) {
      const state = await probePort(port);
      add(`Port ${port}`, state === 'unavailable' ? 'warn' : 'info', state, state === 'occupied' ? 'Existing service left untouched; do not launch a second copy.' : null);
    }
    try {
      const response = await fetch('http://127.0.0.1:4173/api/health', { redirect: 'error', signal: AbortSignal.timeout(1500) });
      const healthy = response.ok && (await response.json()).ok === true;
      add('Running app', healthy ? 'pass' : 'warn', healthy ? 'MoveIDE health check passed on private port4173.' : 'The service on4173 did not return the expected health response.');
    } catch { add('Running app', 'info', 'No healthy app detected on4173.', 'npm run demo'); }
  }
  return { schemaVersion: 1, checkedAt: new Date().toISOString(), readOnly: true, ready: !checks.some(check => check.status === 'fail'), checks,
    limits: 'Does not open a camera, test a physical phone, inspect account credentials or read browser history. Browser storage belongs to the exact browser/profile/origin.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const unknown = process.argv.slice(2).filter(arg => arg !== '--json');
  if (unknown.length) { console.error('Usage: npm run doctor -- [--json]'); process.exitCode = 1; }
  else {
    const result = await diagnose();
    if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('MoveIDE setup doctor · read-only');
      for (const check of result.checks) console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}${check.next ? ` Next: ${check.next}` : ''}`);
      console.log(result.limits);
    }
    if (!result.ready) process.exitCode = 1;
  }
}
