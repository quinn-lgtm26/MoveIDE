import { analyzeSquat, getMotionTrace, getSquatProfile, RAW_POSE_COORDINATES } from '../motion/analyze.mjs';
import { coachingMarkerAt, formatManualHandoff, getCoachingTimeline, prepareCoachingBundle } from '../coaching/index.mjs';
import { chatGPTProvider } from '../provider/client.mjs';
import { drawSquatOverlay, overlayFrameAt } from '../motion/overlay.mjs';

const element = (id) => document.getElementById(id);
const sample = '/fixtures/squat/clear-squat.mp4';
const urls = [];
let bundle;
let generation = 0;
let interpretation;
let popup;
let poll;
let releasePlayback;
let coaching;
let coachingTimeline = [];

const projectedAngles = [
  ['Knee', 'kneeFlexionDeg'],
  ['Hip', 'hipFlexionDeg'],
  ['Torso', 'torsoLeanDeg'],
  ['Shin', 'shinInclinationDeg'],
  ['Ankle change', 'ankleClosureChangeDeg'],
];
const formattedAngle = (value) => value == null ? '—' : `${value.toFixed(1)}°`;

function attachPlayback(report) {
  const video = element('clip');
  const canvas = element('overlay');
  const context = canvas.getContext('2d');
  if (!context) return;
  const trace = new Map(getMotionTrace(report).map((row) => [row.timestampMs, row]));
  let frameCallback;
  let displayedTime;
  let displayedCue;

  function redraw(timestampMs) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const ratio = devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const frame = overlayFrameAt(report.frames, timestampMs);
    drawSquatOverlay(context, frame, {
      side: report.protocol.side, videoWidth: video.videoWidth, videoHeight: video.videoHeight, width, height,
    });
    const current = frame?.timestampMs ?? null;
    if (displayedTime !== current) {
      displayedTime = current;
      const row = trace.get(current);
      element('phase').textContent = row ? `${row.timestampMs} ms${row.phase ? ` · ${row.repId} ${row.phase}` : ''}` : 'Pose unavailable';
      const metrics = row ? projectedAngles.map(([label, key]) => `${label} ${formattedAngle(row[key])}`) : [];
      if (row?.hipDescentLegLengths != null) metrics.push(`Hip descent ${(row.hipDescentLegLengths * 100).toFixed(1)}% of leg length`);
      if (row?.hipAboveKneeLegLengths != null) metrics.push(`Hip above knee ${(row.hipAboveKneeLegLengths * 100).toFixed(1)}%`);
      element('frame-metrics').textContent = metrics.join(' · ');
    }
    const marker = frame ? coachingMarkerAt(coachingTimeline, timestampMs) : null;
    const cue = marker?.observationIndices.map((index) => coaching?.observations[index]?.text).filter(Boolean).join(' ')
      || (marker?.hasNextFocus ? coaching?.nextFocus.text : '');
    if (cue !== displayedCue) {
      displayedCue = cue;
      element('cue').hidden = !cue;
      element('cue').textContent = cue;
    }
  }

  function seekTo(timestampMs) {
    video.pause();
    video.currentTime = Math.min((timestampMs + .501) / 1000, video.duration - .000001);
  }

  function step(direction) {
    const currentTime = video.currentTime * 1000;
    const ordered = direction > 0 ? report.frames : report.frames.toReversed();
    const next = ordered.find(({ timestampMs }) => direction * (timestampMs - currentTime) > 1);
    if (next) seekTo(next.timestampMs);
  }

  const drawCurrent = () => redraw(Math.round(video.currentTime * 1000));
  const nextFrame = (_now, metadata) => {
    redraw(Math.round(metadata.mediaTime * 1000));
    frameCallback = video.requestVideoFrameCallback(nextFrame);
  };
  frameCallback = video.requestVideoFrameCallback(nextFrame);
  const observer = new ResizeObserver(drawCurrent);
  observer.observe(video);
  video.addEventListener('seeked', drawCurrent);
  element('prev-frame').onclick = () => step(-1);
  element('next-frame').onclick = () => step(1);
  drawCurrent();
  return () => {
    video.cancelVideoFrameCallback(frameCallback);
    video.removeEventListener('seeked', drawCurrent);
    observer.disconnect();
    element('prev-frame').onclick = null;
    element('next-frame').onclick = null;
  };
}


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
  releasePlayback?.();
  releasePlayback = null;
  coaching = null;
  coachingTimeline = [];
  element('replay').hidden = true;
  element('clip').pause();
  element('cue').hidden = true;
  element('copy').disabled = true;
  element('report').hidden = true;
  element('trace-download').hidden = true;
  element('profile-download').hidden = true;
  element('raw-download').hidden = true;
  element('packet').textContent = '';
  element('coaching').textContent = '';
  element('coverage').textContent = '';
  element('metrics').replaceChildren();
  element('evidence').replaceChildren();
  urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
  bundle = null;
  updateInterpret();
  try {
    const rawFrames = [];
    const report = await analyzeSquat(sample, {
      clipId: 'clear-squat',
      onPoseFrame: (frame) => rawFrames.push(frame),
      onProgress: ({ stage, progress }) => {
        element('status').textContent = `${stage} ${Math.round(progress * 100)}%`;
      },
    });
    element('report').href = downloadUrl(new Blob([JSON.stringify(report)], { type: 'application/json' }));
    element('report').hidden = false;
    const rawPose = { schemaVersion: 1, clip: report.clip, poseModel: report.poseModel,
      coordinates: RAW_POSE_COORDINATES, frames: rawFrames };
    for (const [id, data] of [['trace-download', getMotionTrace(report)], ['profile-download', getSquatProfile(report)], ['raw-download', rawPose]]) {
      element(id).href = downloadUrl(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      element(id).hidden = false;
    }
    const prepared = await prepareCoachingBundle(report, sample, { repIds: report.reps.slice(0, 2).map(({ id }) => id) });
    if (current !== generation) return;
    bundle = prepared;
    element('clip').src = sample;
    element('replay').hidden = false;
    releasePlayback = attachPlayback(report);
    const profiles = new Map(getSquatProfile(report).reps.map((profile) => [profile.repId, profile]));
    element('status').textContent = `${report.reps.length} complete reps · ${bundle.images.length} evidence JPEGs`;
    const tracked = report.frames.filter(({ quality }) => quality === 'usable').length;
    element('coverage').textContent = `${tracked} of ${report.frames.length} frames tracked · 33 landmark slots per frame`;
    for (const measurement of report.measurements) {
      const { repId, metric, quality, value, unit, evidenceTimestampMs } = measurement;
      const row = document.createElement('li');
      const estimate = unit === 'deg' ? `${value?.toFixed(1)}°` : `${value} ms`;
      row.textContent = `${repId ?? 'Clip'} ${metricNames[metric]} · ${quality === 'usable'
        ? `${estimate} at ${evidenceTimestampMs} ms` : 'unavailable'}`;
      if (metric === 'rep_duration' && profiles.has(repId)) {
        const { descentMs, ascentMs } = profiles.get(repId);
        row.textContent += ` · down ${descentMs ?? '—'} ms · up ${ascentMs ?? '—'} ms`;
      }
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
    if (current === generation && !signal.aborted) {
      coaching = result;
      coachingTimeline = getCoachingTimeline(result, bundle.packet);
      element('coaching').textContent = JSON.stringify(result, null, 2);
      // Refresh the cue if playback is already paused at its evidence frame.
      element('clip').dispatchEvent(new Event('seeked'));
    }
  } catch (error) {
    if (current === generation && !signal.aborted) element('coaching').textContent = error.message;
  } finally {
    interpretation = null;
    updateInterpret();
  }
};

await refreshConnection();
