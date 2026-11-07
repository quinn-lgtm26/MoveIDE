import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSE_PRESETS } from '../motion/pose-model.mjs';

const require = createRequire(import.meta.url);
const vision = dirname(require.resolve('@mediapipe/tasks-vision'));
const output = fileURLToPath(new URL('../public/pose/', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function publish(destination, stage) {
  const staging = `${destination}.${randomUUID()}.tmp`;
  try {
    await stage(staging);
    await rename(staging, destination);
  } finally {
    await rm(staging, { force: true });
  }
}

const wasm = join(output, 'wasm');
await mkdir(wasm, { recursive: true });
await Promise.all((await readdir(join(vision, 'wasm'))).map((name) =>
  publish(join(wasm, name), (staging) => copyFile(join(vision, 'wasm', name), staging))));


for (const [name, preset] of Object.entries(POSE_PRESETS)) {
  const model = join(output, preset.fileName);
  const existing = await readFile(model).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && digest(existing) === preset.sha256) continue;
  const modelUrl = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${name}/float16/1/${preset.fileName}`;
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${name} pose model download failed (HTTP ${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== preset.sha256) throw new Error(`${name} pose model checksum mismatch`);

  await publish(model, (staging) => writeFile(staging, bytes, { flag: 'wx' }));
}
