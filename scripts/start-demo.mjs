#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { connect } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const APP_ORIGIN = 'http://127.0.0.1:4173';
const TRANSPORT_ORIGIN = 'http://127.0.0.1:4176';

export function extractQuickTunnelOrigin(text) {
  return text.match(/https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com(?=\s|\/|["']|$)/i)?.[0] ?? null;
}

// Connect-only check: never binds, kills or changes a process already using a demo port.
export async function assertPortFree(port, host = '127.0.0.1') {
  await new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const finish = error => { socket.destroy(); error ? reject(error) : resolve(); };
    socket.once('connect', () => finish(new Error(`Port ${port} is already in use. Stop that service yourself, then retry; nothing was killed.`)));
    socket.once('error', error => error.code === 'ECONNREFUSED' ? finish() : finish(new Error(`Could not check port ${port} (${error.code}).`)));
    socket.setTimeout(1500, () => finish(new Error(`Port ${port} did not respond to its availability check.`)));
  });
}

export function createSupervisor() {
  const children = new Set();
  let stopping = false;
  function start(command, args, { env = process.env, onOutput, ownedService = false } = {}) {
    if (stopping) throw new Error('Startup was canceled.');
    const child = spawn(command, args, { cwd: ROOT, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const record = { child, done: false, exit: null, ownedService };
    children.add(record);
    for (const stream of [child.stdout, child.stderr]) stream?.on('data', chunk => onOutput?.(chunk.toString()));
    record.exit = new Promise(resolve => {
      child.once('error', error => { record.done = true; if (!ownedService) children.delete(record); resolve({ error: error.code ?? 'spawn_failed' }); });
      child.once('exit', (code, signal) => { record.done = true; if (!ownedService) children.delete(record); resolve({ code, signal }); });
    });
    return record;
  }
  function kill(record, signal) {
    if (!record.child.pid) return;
    try {
      if (process.platform === 'win32') record.child.kill(signal);
      else process.kill(-record.child.pid, signal); // Owned process group includes npm/Vite children.
    } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  async function stop() {
    if (stopping) return;
    stopping = true;
    const active = [...children].filter(record => !record.done || record.ownedService);
    if (!active.length) return;
    active.forEach(record => kill(record, 'SIGTERM'));
    let timer;
    await Promise.race([Promise.all(active.map(record => record.exit)), new Promise(resolve => { timer = setTimeout(resolve, 2500); })]);
    clearTimeout(timer);
    active.forEach(record => kill(record, 'SIGKILL')); // Also clean descendants if their service leader exited first.
    await Promise.all(active.map(record => record.exit));
  }
  return { start, stop };
}

async function missingDependencies() {
  const groups = [
    { name: 'app', args: ['ci'], paths: ['node_modules/vite/bin/vite.js', 'node_modules/typescript/bin/tsc', 'node_modules/react/package.json'] },
    { name: 'harness', args: ['--prefix', 'harness', 'ci'], paths: ['harness/node_modules/jose/package.json', 'harness/node_modules/qrcode/package.json', 'harness/node_modules/@mediapipe/tasks-vision/package.json'] },
  ];
  const missing = [];
  for (const group of groups) {
    try { await Promise.all(group.paths.map(path => access(`${ROOT}${path}`))); }
    catch { missing.push(group); }
  }
  return missing;
}

function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
}

function pause(ms, signal) {
  signal.throwIfAborted();
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

async function waitHttp(url, check, signal, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'no response';
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]), redirect: 'error' });
      lastStatus = `HTTP ${response.status}`;
      if (await check(response)) return;
    } catch (error) { signal.throwIfAborted(); lastStatus = error.cause?.code ?? error.name ?? 'request failed'; }
    await pause(250, signal);
  }
  const target = new URL(url);
  throw new Error(`${target.protocol === 'https:' ? 'Public phone' : 'Local app'} readiness failed at ${target.pathname} (${lastStatus}). Check network access and retry.`);
}

export async function main(args = process.argv.slice(2)) {
  const unknown = args.filter(arg => !['--phone', '--check', '--setup-only', '--help'].includes(arg));
  if (unknown.length) throw new Error('Usage: npm run demo -- [--phone] [--check] [--setup-only]');
  if (args.includes('--help')) {
    console.log('npm run demo -- [--phone] [--check] [--setup-only]\nDefault: install missing locked dependencies, prepare pinned model assets, build and start.\n--phone: temporary HTTPS tunnel for phone pairing service only\n--check: check prerequisites and ports without installing or starting services\n--setup-only: install dependencies and verify model assets without starting services');
    return;
  }
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) throw new Error('Use Node.js 22.18 or newer.');
  if (process.platform === 'win32') throw new Error('This demo launcher currently supports macOS/Linux. See docs/quickstart.md.');
  const phone = args.includes('--phone');
  const supervisor = createSupervisor();
  const controller = new AbortController();
  let interrupted = false;
  const cancel = () => { interrupted = true; controller.abort(new Error('Startup canceled.')); };
  // npm and the terminal can both forward the same interrupt. Keep the handler
  // installed through cleanup so a second signal cannot strand detached children.
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  const { signal } = controller;
  const childEnvironment = { ...process.env, CI: '1' };
  // The dedicated transport/tunnel do not inherit provider flags or arbitrary credential env vars.
  const transportEnvironment = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SystemRoot'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  async function run(command, argv, label, env = childEnvironment) {
    signal.throwIfAborted();
    const record = supervisor.start(command, argv, { env });
    const outcome = await Promise.race([record.exit, waitForAbort(signal).then(() => null)]);
    signal.throwIfAborted();
    if (outcome?.code !== 0) throw new Error(`${label} failed (${outcome?.error ?? outcome?.code ?? 'terminated'}). Run the documented command directly to inspect it.`);
  }
  function service(command, argv, label, options) {
    signal.throwIfAborted();
    const record = supervisor.start(command, argv, { ...options, ownedService: true });
    record.exit.then(outcome => {
      if (!signal.aborted) controller.abort(new Error(`${label} stopped (${outcome.error ?? outcome.code ?? outcome.signal}).`));
    });
    return record;
  }
  try {
    if (!args.includes('--setup-only')) await Promise.all([assertPortFree(4173), assertPortFree(4176)]);
    const missing = await missingDependencies();
    if (args.includes('--check') && missing.length) throw new Error('Dependencies are missing. Run npm run demo to install locked versions and prepare the models automatically.');
    if (!args.includes('--check')) for (const group of missing) {
      console.log(`Installing locked ${group.name} dependencies…`);
      await run('npm', group.args, `${group.name} dependency installation`);
    }
    if (args.includes('--setup-only')) {
      console.log('Preparing and verifying pinned MediaPipe model assets…');
      await run(process.execPath, ['harness/setup/pose-assets.mjs'], 'Pinned asset setup');
      console.log('Setup complete. Run npm run demo to start MoveIDE.');
      return;
    }
    if (phone) {
      try { await run('cloudflared', ['--version'], 'cloudflared availability', transportEnvironment); }
      catch { throw new Error('Phone mode needs an already-installed cloudflared executable on PATH. See docs/quickstart.md; the launcher never installs it.'); }
    }
    signal.throwIfAborted();
    if (args.includes('--check')) { console.log(`Prerequisites and ports are ready${phone ? ' for phone mode' : ''}. No services or tunnel started.`); return; }
    console.log('Preparing pinned pose/QR assets and building MoveIDE…');
    await run(process.execPath, ['harness/setup/pose-assets.mjs'], 'Pinned asset setup');
    // Invoke the build without npm lifecycle hooks: no prebuild git pull, no duplicated asset setup.
    await run(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], 'TypeScript build');
    await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], 'Vite build');
    await Promise.all([assertPortFree(4173), assertPortFree(4176)]);
    let publicOrigin;
    if (phone) {
      console.log('Creating temporary HTTPS access for the phone pairing service only…');
      let output = '';
      service('cloudflared', ['tunnel', '--config', '/dev/null', '--no-autoupdate', '--metrics', '127.0.0.1:0', '--url', TRANSPORT_ORIGIN], 'Phone tunnel', {
        env: transportEnvironment,
        onOutput: chunk => { output = (output + chunk).slice(-16_384); publicOrigin ??= extractQuickTunnelOrigin(output); },
      });
      const deadline = Date.now() + 45_000;
      while (!publicOrigin && Date.now() < deadline) { signal.throwIfAborted(); await pause(150, signal); }
      if (!publicOrigin) throw new Error('No HTTPS phone address was created. Check cloudflared/network availability, or start without --phone.');
    }
    signal.throwIfAborted();
    await assertPortFree(4176);
    service(process.execPath, ['harness/live/transport/server.mjs'], 'Phone pairing service', { env: {
      ...transportEnvironment, MOVEIDE_STREAM_HOST: '127.0.0.1', MOVEIDE_STREAM_PORT: '4176', ...(publicOrigin ? { MOVEIDE_STREAM_PUBLIC_ORIGIN: publicOrigin } : {}),
    } });
    await waitHttp(`${TRANSPORT_ORIGIN}/phone`, async response => response.ok && (await response.text()).includes('Start camera'), signal);
    service(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], 'Private app', {
      env: { ...childEnvironment, MOVEIDE_ENABLE_CHATGPT: '1' },
    });
    await waitHttp(`${APP_ORIGIN}/api/health`, async response => response.ok && (await response.json()).ok === true, signal);
    await waitHttp(`${APP_ORIGIN}/harness/live/`, async response => response.ok && (await response.text()).includes('Start coached squat'), signal);
    if (publicOrigin) {
      console.log('Private app built. Waiting up to two minutes for the new HTTPS phone address to resolve…');
      await waitHttp(`${publicOrigin}/phone`, async response => response.ok && (await response.text()).includes('Start camera'), signal, 120_000);
      await waitHttp(`${publicOrigin}/api/connection`, async response => response.status === 404, signal);
    }
    console.log(`Ready: ${APP_ORIGIN}/\nLive camera: ${APP_ORIGIN}/harness/live/`);
    console.log(phone ? 'Choose iPhone camera, press Start, then scan the private QR in the app. No pairing links are printed here.' : 'Use a recording or Mac camera. Restart with --phone for a secure iPhone pairing link. No public tunnel is running.');
    console.log('Keep this terminal open. Ctrl+C stops only services started by this launcher.');
    await waitForAbort(signal);
    if (!interrupted) signal.throwIfAborted();
  } catch (error) {
    if (!interrupted) throw error;
  } finally {
    await supervisor.stop();
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`MoveIDE: ${error.message}`); process.exitCode = 1; });
}
