import { analyzeSquat, getMotionTrace, getSquatProfile, RAW_POSE_COORDINATES } from '../motion/analyze.mjs';
import { coachingSegmentAt, formatManualHandoff, getCoachingSegments, prepareCoachingBundle } from '../coaching/index.mjs';
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
let coachingSegments = [];
const seenCues = new Set();
let activeReport;
let analysisRunning = false;
let sessionCoachingAllowed = false;

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
    const marker = coachingSegmentAt(coachingSegments, timestampMs);
    if (coaching && marker && !seenCues.has(marker.repId)) {
      seenCues.add(marker.repId);
      const text = marker.hasNextFocus ? coaching.nextFocus.text
        : marker.observationIndices.map(index => coaching.observations[index]?.text).find(Boolean);
      if (text) {
        // Keep past cues. Moving out of a rep or rewinding never removes or repeats a card.
        const compact = text.length <= 180 ? text : `${text.slice(0, 177).trimEnd()}…`;
        const label = `AI · ${marker.repId} · evidence ${marker.evidenceTimestampsMs.join(', ')} ms`;
        element('cue').textContent = compact;
        element('cue-context').textContent = label;
        const item = document.createElement('li');
        const heading = document.createElement('strong'); heading.textContent = label;
        const cueText = document.createElement('p'); cueText.textContent = compact;
        const why = document.createElement('details');
        const summary = document.createElement('summary'); summary.textContent = 'Why?';
        const explanation = document.createElement('p');
        explanation.textContent = marker.observationIndices.map(index => coaching.observations[index]?.text).filter(Boolean).join(' ');
        why.append(summary, explanation);
        for (const time of marker.evidenceTimestampsMs) {
          const button = document.createElement('button'); button.textContent = `See ${time} ms`;
          button.onclick = () => seekTo(time); why.append(button);
        }
        item.append(heading, cueText, why); element('cue-history').append(item);
        while (element('cue-history').children.length > 12) element('cue-history').firstElementChild.remove();
      }
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
  element('model').disabled = !models.length || analysisRunning;
  element('connect').hidden = state.state === 'connected';
  element('cancel').hidden = state.state !== 'connecting';
  element('disconnect').hidden = state.state !== 'connected';
  element('settings').open = state.state !== 'connected';
  updateInterpret();
  return state.state;
}

element('analyze').onclick = async () => {
  const current = ++generation;
  interpretation?.abort();
  interpretation = null;
  analysisRunning = true;
  sessionCoachingAllowed = Boolean(element('model').value);
  element('model').disabled = true;
  element('analyze').disabled = true;
  element('interpret').hidden = true;
  releasePlayback?.();
  releasePlayback = null;
  coaching = null;
  coachingSegments = [];
  activeReport = null;
  element('overlay').getContext('2d')?.clearRect(0, 0, element('overlay').width, element('overlay').height);
  element('clip').pause();
  element('phase').textContent = 'Measuring…';
  element('frame-metrics').textContent = '';
  seenCues.clear(); element('cue-history').replaceChildren();
  element('cue').hidden = false; element('cue-context').hidden = false;
  element('cue').textContent = 'Measuring your squat…';
  element('cue-context').textContent = 'Session guide';
  element('coaching-observations').replaceChildren();
  element('coaching-next-focus').textContent = '';
  element('coaching-uncertainty').textContent = '';
  element('coaching-status').textContent = 'Measuring your squat. AI coaching will follow automatically when connected.';
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
    activeReport = report;
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
    element('clip').play().catch(() => {});
    updateInterpret();
    if (sessionCoachingAllowed && !element('interpret').disabled) await generateCoaching();
    else element('coaching-status').textContent = element('model').value
      ? 'Local analysis ready. AI coaching needs usable measurements and matching source images.'
      : 'Local analysis ready. Connect ChatGPT in settings, then Start again to include AI coaching.';
  } catch (error) {
    element('status').textContent = error.message;
    element('phase').textContent = 'Analysis unavailable';
    element('coaching-status').textContent = 'Analysis could not complete. Start again to retry.';
  } finally {
    analysisRunning = false;
    element('model').disabled = !element('model').options.length;
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
  sessionCoachingAllowed = false;
  if (interpretation) element('coaching-status').textContent = 'AI request canceled. Local measurements and any earlier notes remain available.';
  interpretation?.abort();
  const result = await chatGPTProvider.disconnect();
  await refreshConnection();
  if (result.revocationConfirmed === false) {
    element('connection').textContent = 'Signed out locally. Check ChatGPT settings to confirm remote revocation.';
  }
};

element('model').onchange = () => {
  interpretation?.abort();
  interpretation = null;
  coaching = null;
  coachingSegments = [];
  seenCues.clear(); element('cue-history').replaceChildren();
  element('cue').textContent = 'Start to coach with the selected model.';
  element('cue-context').textContent = 'Session guide';
  element('coaching-observations').replaceChildren();
  element('coaching-next-focus').textContent = '';
  element('coaching-uncertainty').textContent = '';
  element('coaching').textContent = '';
  element('coaching-status').textContent = 'Model changed. Start coached squat to review with this model.';
  element('clip').dispatchEvent(new Event('seeked'));
  updateInterpret();
};

async function generateCoaching() {
  if (!bundle || !activeReport || interpretation || !sessionCoachingAllowed) return;
  const current = generation;
  const request = new AbortController();
  interpretation = request;
  const { signal } = request;
  const approvedBundle = bundle;
  const report = activeReport;
  updateInterpret();
  element('coaching-status').textContent = 'Generating AI analysis… You can keep playing the video.';
  element('interpret').hidden = true;
  element('coaching').textContent = 'Interpreting source evidence…';
  try {
    const result = await chatGPTProvider.interpret(approvedBundle.packet, approvedBundle.images, { model: element('model').value, signal });
    if (current === generation && !signal.aborted) {
      const segments = getCoachingSegments(result, approvedBundle.packet, report);
      coaching = result;
      coachingSegments = segments;
      element('coaching').textContent = JSON.stringify(result, null, 2);
      element('coaching-status').textContent = 'AI analysis ready. Play a rep to follow its notes, or open a cited frame below.';
      const times = new Map([
        ...approvedBundle.packet.measurements.map(({ id, evidenceTimestampMs }) => [id, evidenceTimestampMs]),
        ...approvedBundle.packet.evidence.map(({ id, timestampMs }) => [id, timestampMs]),
      ]);
      element('coaching-observations').replaceChildren(...result.observations.map(observation => {
        const item = document.createElement('li');
        const text = document.createElement('p');
        text.textContent = observation.text;
        item.append(text);
        for (const timestamp of new Set(observation.evidenceIds.map(id => times.get(id)))) {
          const button = document.createElement('button');
          button.textContent = `Evidence at ${timestamp} ms`;
          button.onclick = () => {
            const video = element('clip');
            video.pause();
            video.currentTime = Math.min((timestamp + .501) / 1000, video.duration - .000001);
          };
          item.append(button);
        }
        return item;
      }));
      element('coaching-next-focus').textContent = `Next focus: ${result.nextFocus.text}`;
      element('coaching-uncertainty').textContent = `Limits: ${result.uncertainty}`;
      // Refresh the cue if playback is already paused at its evidence frame.
      element('clip').dispatchEvent(new Event('seeked'));
    }
  } catch (error) {
    if (current === generation && !signal.aborted) {
      element('coaching').textContent = error.message;
      element('interpret').hidden = false;
      element('coaching-status').textContent = `AI analysis could not complete: ${error.message}. Your local measurements are still available.`;
    }
  } finally {
    if (interpretation === request) interpretation = null;
    updateInterpret();
  }
}
element('interpret').onclick = generateCoaching;

await refreshConnection();
element('analyze').disabled = false;
