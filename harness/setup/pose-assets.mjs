import { createHash, randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const modelSha256 = '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1';
const require = createRequire(import.meta.url);
const vision = dirname(require.resolve('@mediapipe/tasks-vision'));
const output = fileURLToPath(new URL('../public/pose/', import.meta.url));
const model = join(output, 'pose_landmarker_full.task');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

await mkdir(output, { recursive: true });
await cp(join(vision, 'wasm'), join(output, 'wasm'), { recursive: true });

const existing = await readFile(model).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (!existing || digest(existing) !== modelSha256) {
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Pose model download failed (HTTP ${response.status})`);

  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== modelSha256) throw new Error('Pose model checksum mismatch');

  const staging = `${model}.${randomUUID()}.tmp`;
  try {
    await writeFile(staging, bytes, { flag: 'wx' });
    await rename(staging, model);
  } finally {
    await rm(staging, { force: true });
  }
}
