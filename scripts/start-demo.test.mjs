import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createSupervisor, assertPortFree, extractQuickTunnelOrigin, missingDependencies } from './start-demo.mjs';

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

// Real npm subprocess; no demo ports, build, provider, model download or tunnel involved.
// The fixture uses the same signal installer and supervisor as main(), with a
// deliberately slow owned leader and a descendant that ignores graceful TERM.
test('npm-launched signal policy survives repeated interrupts until owned groups are cleaned', {
  skip: process.platform === 'win32', timeout: 15_000,
}, async () => {
  const { spawn } = await import('node:child_process');
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'moveide-signal-regression-'));
  const leaderSource = `
    const { spawn } = require('node:child_process');
    const grandchild = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); console.log("ready"); setInterval(() => {}, 1000);'], { stdio: ['ignore', 'pipe', 'ignore'] });
    grandchild.stdout.once('data', () => console.log(JSON.stringify({ type: 'owned-ready', leader: process.pid, grandchild: grandchild.pid })));
    process.on('SIGTERM', () => { console.log(JSON.stringify({ type: 'term-started' })); setTimeout(() => process.exit(0), 600); });
    setInterval(() => {}, 1000);
  `;
  const fixture = `
    import { createSupervisor } from ${JSON.stringify(new URL('./start-demo.mjs', import.meta.url).href)};
    import { installCancellationSignals } from ${JSON.stringify(new URL('./start-demo-signals.mjs', import.meta.url).href)};
    const supervisor = createSupervisor(), controller = new AbortController();
    let interrupts = 0;
    const dispose = installCancellationSignals(controller, () => { interrupts++; console.log(JSON.stringify({ type: 'interrupted', count: interrupts })); });
    console.log(JSON.stringify({ type: 'launcher-ready', pid: process.pid }));
    supervisor.start(process.execPath, ['-e', ${JSON.stringify(leaderSource)}], { ownedService: true, onOutput: value => process.stdout.write(value) });
    try { await new Promise(resolve => controller.signal.addEventListener('abort', resolve, { once: true })); }
    finally { await supervisor.stop(); dispose(); console.log(JSON.stringify({ type: 'cleaned', interrupts })); }
  `;
  await writeFile(join(directory, 'probe.mjs'), fixture);
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, scripts: { probe: 'node ./probe.mjs' } }));
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });
  const npm = spawn('npm', ['run', 'probe', '--silent'], { cwd: directory, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let childGroup, launcherPid, buffer = '', diagnostic = '';
  const records = [], waiting = new Set();
  const npmExit = new Promise(resolve => npm.once('exit', (code, signal) => resolve({ code, signal })));
  npm.stderr.on('data', value => { diagnostic = (diagnostic + value).slice(-2000); });
  npm.stdout.on('data', value => {
    buffer += value;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try {
        const record = JSON.parse(line); records.push(record);
        if (record.type === 'owned-ready') childGroup = record.leader;
        if (record.type === 'launcher-ready') launcherPid = record.pid;
        for (const notify of waiting) notify();
      } catch { /* npm output is not a fixture event. */ }
    }
  });
  const event = type => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiting.delete(check); reject(new Error(`Missing isolated fixture event ${type}: ${diagnostic}`)); }, 5000);
    const check = () => {
      const value = records.find(record => record.type === type);
      if (value) { clearTimeout(timer); waiting.delete(check); resolve(value); }
    };
    waiting.add(check); check();
  });
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  const killGroup = pid => { if (!pid) return; try { process.kill(-pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  try {
    const launcher = await event('launcher-ready'), owned = await event('owned-ready');
    process.kill(launcher.pid, 'SIGINT');
    await event('term-started'); // cleanup is running and the descendant still ignores TERM
    process.kill(launcher.pid, 'SIGINT');
    process.kill(launcher.pid, 'SIGTERM');
    const cleaned = await event('cleaned');
    assert.ok(cleaned.interrupts >= 2, 'Repeated signals are handled throughout cleanup');
    assert.deepEqual(await npmExit, { code: 0, signal: null });
    const deadline = Date.now() + 2000;
    while ((alive(owned.leader) || alive(owned.grandchild)) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(alive(owned.leader), false, 'Owned leader is gone');
    assert.equal(alive(owned.grandchild), false, 'Owned detached group descendant is gone');
    assert.equal(alive(unrelated.pid), true, 'An unrelated process is not stopped');
  } finally {
    // Only PIDs created by this test can be killed, even on a failed assertion.
    killGroup(childGroup); killGroup(npm.pid); killGroup(unrelated.pid);
    if (launcherPid && alive(launcherPid)) { try { process.kill(launcherPid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    await rm(directory, { recursive: true, force: true });
  }
});


test('locked dependency repair detects stale versions in either tree and missing browser/WASM/build entry points', async () => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'moveide-dependency-regression-'));
  const write = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); };
  const sdk = { version: '1.2.2', main: 'vision_bundle.cjs', module: 'vision_bundle.mjs' };
  const groups = [
    { root: directory, dependencies: { '@mediapipe/tasks-vision': '1.2.2', react: '19.3.1' }, devDependencies: { vite: '8.3.6', '@types/react': '19.3.0' },
      installed: { '@types/react': { version: '19.3.0', main: '', types: 'index.d.ts' }, '@mediapipe/tasks-vision': sdk, react: { version: '19.3.1', main: 'index.js' }, vite: { version: '8.3.6', bin: { vite: 'bin/vite.js' }, exports: { '.': './dist/node/index.js' } } } },
    { root: join(directory, 'harness'), dependencies: { '@mediapipe/tasks-vision': '1.2.2', qrcode: '1.5.4', jose: '6.2.15' }, devDependencies: {},
      installed: { '@mediapipe/tasks-vision': sdk, qrcode: { version: '1.5.4', main: './lib/index.js', browser: { './lib/index.js': './lib/browser.js', fs: false } }, jose: { version: '6.2.15', exports: { '.': { default: './dist/webapi/index.js' } } } } },
  ];
  try {
    for (const group of groups) {
      const manifest = { name: 'fixture', dependencies: group.dependencies, devDependencies: group.devDependencies };
      const packages = { '': manifest };
      await write(join(group.root, 'package.json'), manifest);
      for (const [name, entry] of Object.entries(group.installed)) {
        packages[`node_modules/${name}`] = { version: entry.version };
        const folder = join(group.root, 'node_modules', name);
        await write(join(folder, 'package.json'), { name, ...entry });
        const files = name === '@mediapipe/tasks-vision'
          ? ['vision_bundle.cjs', 'vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_module_internal.js', 'wasm/vision_wasm_module_internal.wasm']
          : name.startsWith('@types/') ? ['index.d.ts'] : name === 'react' ? ['index.js'] : name === 'vite' ? ['bin/vite.js', 'dist/node/index.js']
            : name === 'qrcode' ? ['lib/index.js', 'lib/browser.js'] : ['dist/webapi/index.js'];
        for (const file of files) await write(join(folder, file), 'fixture entry');
      }
      await write(join(group.root, 'package-lock.json'), { lockfileVersion: 3, packages });
    }
    assert.deepEqual(await missingDependencies(directory), []);
    const appSdk = join(directory, 'node_modules/@mediapipe/tasks-vision/package.json');
    const originalSdk = await readFile(appSdk, 'utf8');
    await write(appSdk, { ...JSON.parse(originalSdk), version: '1.2.1' });
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['app']);
    await write(appSdk, originalSdk);
    const harnessSdk = join(directory, 'harness/node_modules/@mediapipe/tasks-vision/package.json');
    const originalHarnessSdk = await readFile(harnessSdk, 'utf8');
    await write(harnessSdk, { ...JSON.parse(originalHarnessSdk), version: '1.2.1' });
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['harness'], 'Harness MediaPipe must not inherit the matching app copy');
    await write(harnessSdk, originalHarnessSdk);
    const viteManifest = join(directory, 'node_modules/vite/package.json');
    const originalVite = await readFile(viteManifest, 'utf8');
    await write(viteManifest, { ...JSON.parse(originalVite), version: '8.2.0' });
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['app'], 'Direct dev dependency versions also follow the lock');
    await write(viteManifest, originalVite);
    const harnessQr = join(directory, 'harness/node_modules/qrcode/package.json');
    const originalQr = await readFile(harnessQr, 'utf8');
    await write(harnessQr, { ...JSON.parse(originalQr), version: '1.5.3' });
    assert.deepEqual(await missingDependencies(directory), [{ name: 'harness', args: ['--prefix', 'harness', 'ci'] }]);
    await write(harnessQr, originalQr);
    const appManifest = join(directory, 'package.json'), originalManifest = await readFile(appManifest, 'utf8');
    const drifted = JSON.parse(originalManifest); drifted.dependencies.react = '19.3.2'; await write(appManifest, drifted);
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['app'], 'Manifest/lock drift cannot silently reuse the old install');
    await write(appManifest, originalManifest);
    await rm(join(directory, 'harness/node_modules/qrcode/lib/browser.js'));
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['harness']);
    await write(join(directory, 'harness/node_modules/qrcode/lib/browser.js'), 'restored fixture');
    await rm(join(directory, 'node_modules/vite/bin/vite.js'));
    await rm(join(directory, 'harness/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm'));
    assert.deepEqual((await missingDependencies(directory)).map(group => group.name), ['app', 'harness']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
