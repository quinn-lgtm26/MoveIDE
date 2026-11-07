import { analyzeSquat } from '../motion/analyze.mjs';
import { formatManualHandoff, prepareCoachingBundle } from '../coaching/index.mjs';
import { chatGPTProvider } from '../provider/client.mjs';

const element = (id) => document.getElementById(id);
const sample = '/fixtures/squat/supported-squat.mp4';
const urls = [];
let bundle;
let generation = 0;
let interpretation;
let popup;
let poll;

const metricNames = {
  knee_flexion: 'knee flexion',
  torso_lean: 'torso lean',
  rep_duration: 'duration',
};

function downloadUrl(blob) {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
}

function updateInterpret() {
  element('interpret').disabled = !bundle?.images.length || bundle.unavailableImages.length > 0
    || !element('model').value || Boolean(interpretation);
}

async function refreshConnection() {
  let state = await chatGPTProvider.getConnection().catch(() => ({ state: 'unavailable', enabled: false }));
  let models = [];
  if (state.state === 'connected') {
    try {
      models = await chatGPTProvider.listModels();
    } catch (error) {
      if (error.code === 'reauthorize') state = { state: 'unavailable' };
    }
  }
  element('connection').textContent = state.state === 'connected' ? 'Using ChatGPT plan' : state.state;
  element('connect').disabled = state.enabled === false || !['disconnected', 'denied', 'unavailable'].includes(state.state);
  element('cancel').disabled = state.state !== 'connecting';
  element('disconnect').disabled = state.state !== 'connected';
  element('model').replaceChildren(...models.map(({ id, label }) => new Option(label, id)));
  element('model').disabled = !models.length;
  updateInterpret();
  return state.state;
}

element('analyze').onclick = async () => {
  const current = ++generation;
  interpretation?.abort();
  element('analyze').disabled = true;
  element('copy').disabled = true;
  element('report').hidden = true;
  element('packet').textContent = '';
  element('coaching').textContent = '';
  element('coverage').textContent = '';
  element('metrics').replaceChildren();
  element('evidence').replaceChildren();
  urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  bundle = null;
  updateInterpret();
  try {
    const report = await analyzeSquat(sample, {
      clipId: 'supported-squat',
      onProgress: ({ stage, progress }) => {
        element('status').textContent = `${stage} ${Math.round(progress * 100)}%`;
      },
    });
    element('report').href = downloadUrl(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    element('report').hidden = false;
    const prepared = await prepareCoachingBundle(report, sample, { repIds: report.reps.slice(0, 2).map(({ id }) => id) });
    if (current !== generation) return;
    bundle = prepared;
    element('status').textContent = `${report.reps.length} complete reps · ${bundle.images.length} evidence JPEGs`;
    const tracked = report.frames.filter(({ quality }) => quality === 'usable').length;
    element('coverage').textContent = `${tracked} of ${report.frames.length} frames tracked · 33 landmark slots per frame`;
    for (const measurement of report.measurements) {
      const { repId, metric, quality, value, unit, evidenceTimestampMs } = measurement;
      const row = document.createElement('li');
      const estimate = unit === 'deg' ? `${value?.toFixed(1)}°` : `${value} ms`;
      row.textContent = `${repId ?? 'Clip'} ${metricNames[metric]} · ${quality === 'usable'
        ? `${estimate} at ${evidenceTimestampMs} ms` : 'unavailable'}`;
      element('metrics').append(row);
    }
    element('packet').textContent = formatManualHandoff(bundle.packet, bundle.images);
    for (const { blob, imageName, timestampMs } of bundle.images) {
      const link = document.createElement('a');
      const image = document.createElement('img');
      link.href = downloadUrl(blob);
      link.download = imageName;
      image.src = link.href;
      image.alt = `Squat source frame at ${timestampMs} ms`;
      link.append(image, `Download ${timestampMs} ms`);
      element('evidence').append(link);
    }
    element('copy').disabled = false;
  } catch (error) {
    element('status').textContent = error.message;
  } finally {
    element('analyze').disabled = false;
    updateInterpret();
  }
};

element('copy').onclick = async () => {
  await navigator.clipboard.writeText(element('packet').textContent);
};

element('connect').onclick = async () => {
  popup = window.open('', '_blank', 'popup');
  if (!popup) {
    element('connection').textContent = 'Allow the sign-in popup to continue.';
    return;
  }
  popup.opener = null;
  try {
    const { authorizationUrl } = await chatGPTProvider.startConnection();
    popup.location = authorizationUrl;
    await refreshConnection();
    poll = setInterval(async () => {
      const state = await refreshConnection();
      if (state !== 'connecting' || popup.closed) {
        clearInterval(poll);
        if (state === 'connecting') await chatGPTProvider.cancelConnection();
        popup.close();
        await refreshConnection();
      }
    }, 1500);
  } catch (error) {
    popup.close();
    element('connection').textContent = error.message;
  }
};

element('cancel').onclick = async () => {
  clearInterval(poll);
  popup?.close();
  await chatGPTProvider.cancelConnection();
  await refreshConnection();
};

element('disconnect').onclick = async () => {
  interpretation?.abort();
  const result = await chatGPTProvider.disconnect();
  await refreshConnection();
  if (result.revocationConfirmed === false) {
    element('connection').textContent = 'Signed out locally. Check ChatGPT settings to confirm remote revocation.';
  }
};

element('interpret').onclick = async () => {
  const current = generation;
  interpretation = new AbortController();
  const { signal } = interpretation;
  updateInterpret();
  element('coaching').textContent = 'Interpreting the approved bundle…';
  try {
    const result = await chatGPTProvider.interpret(bundle.packet, bundle.images, { model: element('model').value, signal });
    if (current === generation && !signal.aborted) element('coaching').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    if (current === generation && !signal.aborted) element('coaching').textContent = error.message;
  } finally {
    interpretation = null;
    updateInterpret();
  }
};

await refreshConnection();
