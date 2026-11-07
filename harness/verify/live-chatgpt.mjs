import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { validateCoachingResponse } from '../coaching/index.mjs';

const origin = 'http://127.0.0.1:4173';
const results = new URL('../results/', import.meta.url);
const readResult = (file) => readFile(new URL(file, results));
const packet = JSON.parse(await readResult('supported-squat.coach-packet.v1.json'));
const status = await fetch(`${origin}/api/connection`).then((response) => response.json());
assert.equal(status.state, 'connected', 'Sign in on the local preview before running the live check.');
const models = await fetch(`${origin}/api/models`).then((response) => response.json());
const model = models.find(({ id }) => id === 'gpt-6.1-sol')?.id ?? models[0]?.id;
assert(model, 'The signed-in account must expose an image-capable model.');
const images = await Promise.all(packet.evidence.map(async (frame) => ({
  ...frame,
  dataUrl: 'data:image/jpeg;base64,' + (await readResult(`supported-squat-evidence/${frame.imageName}`)).toString('base64'),
})));
const response = await fetch(`${origin}/api/interpret`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, packet, images }),
  signal: AbortSignal.timeout(125_000),
});
const result = await response.json();
assert(response.ok, `Live fixture inference failed: ${result.error ?? response.status}`);
validateCoachingResponse(result, packet);
assert(result.observations.length > 0, 'Expected at least one evidence-linked observation.');

const evidence = {
  fixture: 'supported-squat.mp4',
  model,
  verifiedAtUtc: new Date().toISOString(),
  httpStatus: response.status,
  submittedMeasurementIds: packet.measurements.map(({ id }) => id),
  submittedFrameIds: images.map(({ id }) => id),
  validatedObservationEvidence: result.observations.map(({ evidenceIds }) => evidenceIds),
  validatedNextFocusEvidence: result.nextFocus.evidenceIds,
};
if (process.argv.includes('--write')) {
  await writeFile(new URL('live-chatgpt-verification.json', results), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(JSON.stringify(evidence, null, 2));
