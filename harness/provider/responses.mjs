import {
  COACHING_RESPONSE_SCHEMA,
  MAGNA_CARTA_PROMPT,
  validateCoachingImages,
  validateCoachingResponse,
} from '../coaching/index.mjs';
import { resource } from './session.mjs';

const visionModels = new Set(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna']);
const jpegPrefix = 'data:image/jpeg;base64,';

export class ProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function failure(code, status) {
  if (code === 'subscription_sharing_usage_limit_exceeded' || status === 429) {
    return new ProviderError('usage_limit', 'Check your ChatGPT plan usage and try again.', 429);
  }
  if (code === 'subscription_sharing_usage_unavailable' || status === 403) {
    return new ProviderError('plan_unavailable', 'ChatGPT plan usage is unavailable for this connection.', 403);
  }
  if (status === 401) return new ProviderError('reauthorize', 'Reconnect ChatGPT and try again.', 401);
  return new ProviderError('provider_failed', 'ChatGPT could not complete the interpretation.');
}

async function getModels(accessToken, fetcher, signal) {
  const response = await fetcher(`${resource}/models`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal, redirect: 'error',
  });
  if (!response.ok) throw failure(null, response.status);
  const catalog = await response.json();
  if (!Array.isArray(catalog.models)) throw failure();
  return catalog.models
    .filter((model) => model?.visibility === 'list' && visionModels.has(model.slug)
      && (!Array.isArray(model.input_modalities) || model.input_modalities.includes('image')))
    .map((model) => ({ id: model.slug, label: model.display_name || model.slug }));
}

export function listVisionModels(accessToken, { fetcher = fetch, signal } = {}) {
  return getModels(accessToken, fetcher, signal);
}

function validateTransportImages(packet, images) {
  try {
    validateCoachingImages(packet, images);
    if (!images.length || !packet.measurements.length) throw new Error('Missing evidence');
    for (const image of images) {
      const { dataUrl } = image;
      if (Object.keys(image).length !== 4 || typeof dataUrl !== 'string'
          || dataUrl.length > 3_000_000 || !dataUrl.startsWith(jpegPrefix)) {
        throw new Error('Invalid image encoding');
      }
      const encoded = dataUrl.slice(jpegPrefix.length);
      const bytes = Buffer.from(encoded, 'base64');
      if (bytes.toString('base64') !== encoded || bytes.length < 4
          || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff
          || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
        throw new Error('Invalid JPEG');
      }
    }
  } catch {
    throw new ProviderError('invalid_evidence', 'Preview and approve the selected measurements and JPEGs.', 400);
  }
}

async function readCompletedResponse(body) {
  if (!body) throw failure();
  let pending = '';
  let size = 0;
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    size += chunk.length;
    if (size > 8_000_000) throw failure();
    pending += chunk;
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(pending))) {
      const lines = pending.slice(0, boundary.index).split(/\r?\n/);
      pending = pending.slice(boundary.index + boundary[0].length);
      const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;

      const event = JSON.parse(data);
      if (event.type === 'response.completed' && event.response?.status === 'completed') {
        return (event.response.output ?? [])
          .filter((item) => item.type === 'message' && item.role === 'assistant')
          .flatMap((item) => item.content ?? [])
          .filter((content) => content.type === 'output_text')
          .map((content) => content.text)
          .join('');
      }
      if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
        throw failure(event.response?.error?.code ?? event.code);
      }
    }
  }
  throw new ProviderError('incomplete', 'The ChatGPT response ended before it completed.');
}

export async function interpretWithChatGPT(accessToken, { model, packet, images }, { fetcher = fetch, signal } = {}) {
  validateTransportImages(packet, images);
  const models = await getModels(accessToken, fetcher, signal);
  if (!models.some(({ id }) => id === model)) {
    throw new ProviderError('model_unavailable', 'Choose an image-capable model available to this connection.', 400);
  }

  const content = [{ type: 'input_text', text: JSON.stringify(packet) }];
  for (const image of images) {
    content.push(
      { type: 'input_text', text: `Source frame ${image.id} at ${image.timestampMs} ms.` },
      { type: 'input_image', image_url: image.dataUrl, detail: 'auto' },
    );
  }
  const response = await fetcher(`${resource}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    signal,
    redirect: 'error',
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions: MAGNA_CARTA_PROMPT,
      input: [{ role: 'user', content }],
      text: { format: { type: 'json_schema', name: 'moveide_coaching_v1', strict: true, schema: COACHING_RESPONSE_SCHEMA } },
    }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw failure(result.error?.code, response.status);
  }
  const text = await readCompletedResponse(response.body);
  try {
    return validateCoachingResponse(JSON.parse(text), packet);
  } catch {
    throw new ProviderError('invalid_response', 'ChatGPT returned an explanation with missing or unknown evidence.');
  }
}
