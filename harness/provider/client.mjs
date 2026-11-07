import { validateCoachingImages } from '../coaching/index.mjs';

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api/${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const error = new Error(data?.message ?? 'The local ChatGPT service is unavailable.');
    error.code = data?.error ?? 'unavailable';
    throw error;
  }
  return data;
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const chatGPTProvider = {
  getConnection: (signal) => request('connection', { signal }),
  startConnection: () => request('auth/start', { method: 'POST' }),
  cancelConnection: () => request('auth/cancel', { method: 'POST' }),
  disconnect: () => request('disconnect', { method: 'POST' }),
  listModels: (signal) => request('models', { signal }),
  async interpret(packet, images, { model, signal } = {}) {
    signal?.throwIfAborted();
    validateCoachingImages(packet, images);
    const encoded = await Promise.all(images.map(async ({ id, timestampMs, imageName, blob }) => ({
      id, timestampMs, imageName, dataUrl: await toDataUrl(blob),
    })));
    signal?.throwIfAborted();
    return request('interpret', { method: 'POST', body: { model, packet, images: encoded }, signal });
  },
};
