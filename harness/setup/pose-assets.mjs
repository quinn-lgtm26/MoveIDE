import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSE_MODEL_SHA256 } from '../motion/pose-model.mjs';

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const require = createRequire(import.meta.url);
const vision = dirname(require.resolve('@mediapipe/tasks-vision'));
const output = fileURLToPath(new URL('../public/pose/', import.meta.url));
const model = join(output, 'pose_landmarker_full.task');
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


const existing = await readFile(model).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (!existing || digest(existing) !== POSE_MODEL_SHA256) {
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Pose model download failed (HTTP ${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== POSE_MODEL_SHA256) throw new Error('Pose model checksum mismatch');

  await publish(model, (staging) => writeFile(staging, bytes, { flag: 'wx' }));
}
