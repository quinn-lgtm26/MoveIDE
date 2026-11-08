import QRCode from 'qrcode';
import { createPairing, connectReceiver, revokePairing } from './transport/client.mjs';
import { startLiveSquat } from './motion/index.mjs';
import { buildLiveCoachBundle } from './motion/phase-evidence.mjs';
import { drawSquatOverlay } from '../motion/overlay.mjs';
import { validateCoachingResponse } from '../coaching/index.mjs';
import { chatGPTProvider } from '../provider/client.mjs';
import { createLiveRecorder, createLiveArchive } from '../history/live-recorder.mjs';
import { createSessionId, saveSession } from '../history/index.mjs';

const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), context = canvas.getContext('2d');
let controller, media, analysis, receiver, pairing, phoneFeedback, currentCoach, coachingPauseKey, latest, lastArrived = 0, animation, completed = 0;
let capture;
let reviewGeneration = 0, replayUrl = null;
const unsaved = new Set();

function clearStoppedReview() {
  video.pause(); video.srcObject = null; video.removeAttribute('src'); video.controls = false;
  video.autoplay = true; video.load();
  if (replayUrl) URL.revokeObjectURL(replayUrl);
  replayUrl = null; video.closest('.stage').removeAttribute('data-mode');
  $('session-review').hidden = true; $('review-measurements').replaceChildren(); $('review-summary').textContent = '';
}

async function showStoppedReview(owned, recordedPromise, archive) {
  const recorded = await recordedPromise;
  if (controller || reviewGeneration !== owned.generation) return;
  $('session-review').hidden = false;
  $('review-summary').textContent = `${archive.reps.length} completed reps · ${archive.samples.length} retained samples. ${owned.saveEnabled ? 'Save status is shown below.' : 'Temporary review only; saving was off.'} ${recorded.videoBlob ? `${elapsed(recorded.recording.durationMs)} recorded${recorded.recording.stopReason.endsWith('limit') ? ' (beginning of session only)' : ''}.` : 'Video replay is unavailable for this session.'}`;
  $('review-timing').textContent = 'Historical measurements use the analysis clock. Recording alignment is approximate; no live or frame-exact overlay is shown during replay.';
  const body = $('review-measurements');
  for (const sample of archive.samples) {
    const row = document.createElement('tr');
    const values = [elapsed(sample.timestampMs), `View ${sample.viewEpoch + 1} · ${PHASE[sample.phase] || sample.phase}`,
      ...['kneeFlexionDeg', 'hipFlexionDeg', 'torsoLeanDeg', 'shinInclinationDeg', 'ankleClosureChangeDeg', 'hipDescentLegLengths', 'hipAboveKneeLegLengths'].map(key => {
        const value = sample.metrics[key];
        if (!sample.analysisEligible || sample.metricValidity[key]?.status === 'unavailable' || !Number.isFinite(value)) return 'Unavailable';
        return key.endsWith('LegLengths') ? `${value.toFixed(2)} leg lengths` : degrees(value);
      })];
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    body.append(row);
  }
  $('view-status').textContent = 'Live measurements have stopped. Retained session measurements are below.';
  $('cue').textContent = 'Your session, ready to review.';
  $('detail').textContent = 'Replay your recording and revisit your coach notes. Start a new session when you are ready.';
  if (!recorded.videoBlob) {
    $('status').textContent = 'Session review · video unavailable';
    $('detail').textContent = recorded.recording.error || 'No video was captured. Your retained measurements and coach notes remain below.';
    return;
  }
  replayUrl = URL.createObjectURL(recorded.videoBlob);
  video.autoplay = false; video.controls = true; video.src = replayUrl;
  video.closest('.stage').dataset.mode = 'replay'; video.load();
  $('empty').hidden = true; $('status').textContent = 'Session replay · camera off';
  $('phase').textContent = 'Recording playback'; $('age').textContent = 'Historical session';
}

function saveCapture(owned, finalRecording) {
  const row = document.createElement('div'); row.className = 'save-result';
  const status = document.createElement('span'), retry = document.createElement('button'), discard = document.createElement('button');
  const recovery = document.createElement('div'); recovery.className = 'save-recovery'; recovery.hidden = true;
  let finalized, recoveryReady = false;
  const downloadUrls = new Set();
  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob); downloadUrls.add(url);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000);
  };
  const clearRecovery = () => {
    for (const url of downloadUrls) URL.revokeObjectURL(url);
    downloadUrls.clear(); recovery.replaceChildren(); recovery.remove(); finalized = null; finalRecording = null;
  };
  const showRecovery = () => {
    if (!finalized || !owned.archive) return;
    recovery.hidden = false;
    if (recoveryReady) return;
    recoveryReady = true;
    if (finalized.videoBlob) {
      const videoDownload = document.createElement('button'); videoDownload.textContent = 'Download unsaved video';
      videoDownload.onclick = () => download(finalized.videoBlob, `moveide-${owned.id}.${finalized.videoBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
      recovery.append(videoDownload);
    }
    const jsonDownload = document.createElement('button'); jsonDownload.textContent = 'Download session JSON';
    jsonDownload.onclick = () => {
      const { evidence, source, startedAt, ...live } = owned.archive.live;
      const data = { schemaVersion: 1, id: owned.id, kind: 'live', createdAt: owned.startedAt, savedLocally: false,
        video: finalized.videoBlob ? { bytes: finalized.videoBlob.size, mimeType: finalized.videoBlob.type, storedSeparately: true } : null,
        live: { ...live, recording: finalized.recording, timing: { alignment: finalized.recording.alignment, timingNote: finalized.recording.timingNote, firstSampleMapping: finalized.recording.firstSampleMapping } },
        metadata: { source, sessionDurationMs: owned.durationMs },
        evidenceImages: evidence.map(({ blob, ...image }) => ({ ...image, bytes: blob.size, mimeType: blob.type, storedSeparately: true })) };
      download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `moveide-${owned.id}-session.json`);
    };
    recovery.append(jsonDownload);
    if (owned.archive.live.evidence.length) {
      const evidence = document.createElement('details'), summary = document.createElement('summary');
      summary.textContent = 'Download evidence JPEGs'; evidence.append(summary);
      for (const image of owned.archive.live.evidence) {
        const button = document.createElement('button'); button.textContent = `${image.phase} · ${image.timestampMs} ms · view ${image.viewEpoch + 1}`;
        button.onclick = () => download(image.blob, `moveide-${owned.id}-view${image.viewEpoch + 1}-${image.timestampMs}ms.jpg`); evidence.append(button);
      }
      recovery.append(evidence);
    }
  };
  retry.textContent = 'Retry save'; discard.textContent = 'Discard unsaved session'; retry.hidden = discard.hidden = true;
  row.append(status, retry, discard, recovery); $('saved-sessions').prepend(row);
  unsaved.add(owned);
  let pending = false;
  const run = async () => {
    if (pending) return;
    pending = true; retry.hidden = discard.hidden = recovery.hidden = true; status.textContent = 'Saving session on this computer…';
    try {
      const recorded = await finalRecording;
      finalized = recorded;
      const { evidence, source, startedAt, samplesTruncated, repsTruncated, ...data } = owned.archive.live;
      const saved = await saveSession({ id: owned.id, kind: 'live', title: `${source === 'phone' ? 'iPhone' : 'Camera'} squat · ${new Date(owned.startedAt).toLocaleString()}`,
        createdAt: owned.startedAt, video: recorded.videoBlob, report: null, evidenceImages: evidence,
        live: { ...data, timing: { alignment: recorded.recording.alignment, timingNote: recorded.recording.timingNote, firstSampleMapping: recorded.recording.firstSampleMapping }, recording: recorded.recording },
        metadata: { source, samplesTruncated, repsTruncated, sessionDurationMs: owned.durationMs, evidenceTimestamps: evidence.map(({ blob, ...reference }) => reference) } });
      unsaved.delete(owned); owned.archive = null;
      status.textContent = recorded.videoBlob ? `Saved on this computer · ${(recorded.recording.durationMs / 1000).toFixed(0)}s recorded${recorded.recording.stopReason.endsWith('limit') ? ' (session prefix)' : ''}. ` : 'Measurements and notes saved on this computer; video unavailable. ';
      const link = document.createElement('a'); link.href = `/?session=${encodeURIComponent(saved.id)}`; link.textContent = 'Open saved session'; row.append(link);
      clearRecovery();
      retry.onclick = discard.onclick = null; retry.remove(); discard.remove();
    } catch (error) {
      status.textContent = `Not saved: ${error.message || 'Storage unavailable'}. Download your session or keep this page open to retry.`;
      retry.hidden = discard.hidden = false;
      showRecovery();
    } finally { pending = false; }
  };
  retry.onclick = run;
  discard.onclick = () => { unsaved.delete(owned); owned.archive = null; clearRecovery(); row.remove(); };
  void run();
}
const degrees = value => Number.isFinite(value) ? `${value.toFixed(0)}°` : '—';
const elapsed = milliseconds => `${(milliseconds / 1000).toFixed(1)}s`;
const PHASE = { standing: 'Standing', descent: 'Going down', 'near-bottom': 'Near the bottom', ascent: 'Coming up', moving: 'Moving', unknown: 'Finding you' };
const formCheck = age => !Number.isFinite(age) ? 'Form check off' : `Form check ${age <= 500 ? 'live' : 'delayed'} · ${(age / 1000).toFixed(1)} s`;
// Why squat numbers are paused, in the user's terms: [phase chip, headline, detail].
function pauseReason({ dimensionsMatch, poseVisible, fresh, guardState, analysisEligible }) {
  if (!dimensionsMatch) return ['Camera changed', 'Hold still for a moment.', 'The camera view changed, so we’re re-locking on you. Start your next rep from standing.'];
  if (!poseVisible) return ['Can’t see all of you', 'Step back into the frame.', 'Keep your head, hips, knees and feet in view.'];
  if (!fresh) return ['Catching up', 'Hold still for a moment.', 'The form check fell behind. It resumes as soon as it catches up.'];
  if (guardState !== 'stable') return ['Locking on to you', 'Hold still for a second.', 'Once you’re steady, start your next rep from standing.'];
  if (!analysisEligible) return ['Turn side-on', 'Turn side-on to the camera.', 'We can see you. Depth and chest angle need a side view.'];
  return null;
}

const briefFocus = text => text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;

function appendCoachingCard(event, result, cite, signal) {
  const feed = $('ai-feed');
  if (signal.aborted || controller?.signal !== signal || feed.children.length >= 6 ||
      [...feed.children].some(card => card.dataset.repKey === event.key)) return false;
  const followLatest = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 48;
  const card = document.createElement('li'); card.className = 'coaching-card'; card.dataset.repKey = event.key; card.dataset.epoch = String(event.epoch);
  const stamp = document.createElement('p'); stamp.className = 'coaching-stamp'; stamp.textContent = `Rep at ${elapsed(event.rep.bottomMs)} · view ${event.epoch + 1}`;
  const focus = document.createElement('p'); focus.className = 'coaching-focus'; focus.textContent = briefFocus(result.nextFocus.text);
  const why = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Why';
  const observations = document.createElement('ul');
  for (const observation of result.observations) {
    const item = document.createElement('li'); item.textContent = cite(observation); observations.append(item);
  }
  const fullFocus = document.createElement('p'); fullFocus.textContent = `Next focus: ${cite(result.nextFocus)}`;
  const limits = document.createElement('p'); limits.className = 'coaching-limits'; limits.textContent = `Limits: ${result.uncertainty}`;
  why.append(summary, observations, fullFocus, limits); card.append(stamp, focus, why); feed.append(card);
  $('ai-empty').hidden = true;
  if (followLatest) feed.scrollTop = feed.scrollHeight;
  return true;
}

function currentEvidence(event) {
  return latest?.analysisEligible && latest.viewGuard.epoch === event.epoch &&
    performance.now() - lastArrived + latest.processingLatencyMs <= 500 &&
    latest.report.clip.widthPx === video.videoWidth && latest.report.clip.heightPx === video.videoHeight;
}

function liveCoach(signal, onResult = () => {}) {
  let model, busy = false, sent = 0, lastSent = -Infinity, coachState = 'connecting';
  const seen = new Set();
  void (async () => {
    try {
      const connection = await chatGPTProvider.getConnection(signal);
      if (signal.aborted) return;
      if (connection.state !== 'connected') { coachState = 'offline'; $('ai').textContent = 'Connect ChatGPT on the Recorded clip page to get coach notes. Your form check works without it.'; return; }
      const models = await chatGPTProvider.listModels(signal);
      if (signal.aborted) return;
      model = models[0]?.id; coachState = model ? 'ready' : 'offline';
      $('ai').textContent = model ? 'Connected · notes arrive after finished reps.' : 'No ChatGPT model available. Your form check keeps running.';
    } catch { if (!signal.aborted) { coachState = 'offline'; $('ai').textContent = 'Can’t reach ChatGPT. Your form check keeps running.'; } }
  })();
  const coach = async event => {
    if (signal.aborted || !currentEvidence(event) || !model || busy || sent >= 6 || performance.now() - lastSent < 8000 || seen.has(event.key)) return;
    let packet, images;
    try {
      ({ packet, images } = buildLiveCoachBundle(event.report, event.rep.id, event.evidenceImages));
      if (!packet.measurements.length || !images.length || images.some(image => !image.blob)) return;
    } catch { return; }
    busy = true; coachState = 'reviewing'; sent++; lastSent = performance.now(); seen.add(event.key);
    if (sent >= 6) $('ai-limit').hidden = false;
    $('ai').textContent = `Coach is reviewing your rep at ${elapsed(event.rep.bottomMs)}… keep going.`;
    try {
      const result = validateCoachingResponse(await chatGPTProvider.interpret(packet, images, { model, signal }), packet);
      if (signal.aborted) return;
      const stillCurrent = currentEvidence(event);
      const evidence = new Map([...packet.measurements.map(item => [item.id, item.evidenceTimestampMs]), ...packet.evidence.map(item => [item.id, item.timestampMs])]);
      const cite = item => `${item.text} [${[...new Set(item.evidenceIds.map(id => evidence.get(id)))].map(elapsed).join(', ')}]`;
      if (!appendCoachingCard(event, result, cite, signal)) return;
      if (capture?.own.signal === signal) capture.archive.note(event, result, packet);
      coachState = 'reviewed';
      $('ai').textContent = stillCurrent ? `Next focus: ${briefFocus(result.nextFocus.text)}` : `Note added for your earlier rep at ${elapsed(event.rep.bottomMs)}.`;
      onResult({ kind: 'ai', text: briefFocus(stillCurrent ? result.nextFocus.text : `Earlier view ${event.epoch + 1}: ${result.nextFocus.text}`), sourceTimestampMs: event.rep.bottomMs }, event.epoch);
    } catch { if (!signal.aborted) { coachState = 'error'; $('ai').textContent = 'Couldn’t get a coach note for that rep. Your form check keeps running.'; } }
    finally { busy = false; }
  };
  coach.viewChanged = () => {
    if (signal.aborted) return;
    if (coachState === 'reviewed') $('ai').textContent = 'Your earlier notes stay below.';
    if (coachState === 'reviewing') $('ai').textContent = 'Coach is still reviewing your last finished rep.';
  };
  return coach;
}

function pauseCurrentCoaching(reason) {
  const key = `${latest?.viewGuard.epoch ?? 'pending'}:${reason}`;
  if (coachingPauseKey === key) return;
  coachingPauseKey = key;
  currentCoach?.viewChanged();
  phoneFeedback?.({ kind: 'status', text: 'Current coaching paused. Hold a clear side view; earlier AI notes describe a previous view or rep.', sourceTimestampMs: latest?.timestampMs ?? null });
}

function clearTracking() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const id of ['knee', 'hip', 'torso']) $(id).textContent = '—';
}

function render() {
  if (!controller || controller.signal.aborted) return;
  animation = requestAnimationFrame(render);
  const age = latest ? performance.now() - lastArrived + latest.processingLatencyMs : Infinity;
  const dimensionsMatch = latest?.report.clip.widthPx === video.videoWidth && latest?.report.clip.heightPx === video.videoHeight;
  const displayUsable = latest?.poseDisplayFrame.quality === 'usable' && age <= 500 && dimensionsMatch;
  const metricsUsable = displayUsable && latest.analysisEligible;
  $('age').textContent = formCheck(age);
  if (!metricsUsable) {
    for (const id of ['knee', 'hip', 'torso']) $(id).textContent = '—';
    $('feedback').dataset.state = 'unknown';
    $('phase').textContent = 'Waiting for you';
    if (latest) {
      const [chip, cue, detail] = pauseReason({ dimensionsMatch, poseVisible: latest.poseDisplayFrame.quality === 'usable', fresh: age <= 500, guardState: latest.viewGuard.state, analysisEligible: latest.analysisEligible });
      phoneFeedback?.({ kind: 'status', text: 'Current coaching paused. Hold a clear side view; earlier notes describe an earlier rep.', sourceTimestampMs: latest.timestampMs });
      pauseCurrentCoaching(!dimensionsMatch ? 'dimensions-changed' : age > 500 ? 'stale-frame' : latest.viewGuard.reason);
      $('phase').textContent = chip; $('cue').textContent = cue; $('detail').textContent = detail;
      $('status').textContent = displayUsable ? 'We can see you' : 'Finding you';
    }
  }
  if (!displayUsable) { context.clearRect(0, 0, canvas.width, canvas.height); return; }
  const bounds = canvas.getBoundingClientRect(), scale = devicePixelRatio || 1;
  if (canvas.width !== Math.round(bounds.width * scale) || canvas.height !== Math.round(bounds.height * scale)) {
    canvas.width = Math.round(bounds.width * scale); canvas.height = Math.round(bounds.height * scale);
  }
  drawSquatOverlay(context, latest.poseDisplayFrame, { side: latest.report.protocol.side,
    showKneeArc: metricsUsable, videoWidth: latest.report.clip.widthPx, videoHeight: latest.report.clip.heightPx, width: canvas.width, height: canvas.height });
  context.save(); context.globalCompositeOperation = 'source-in';
  context.fillStyle = metricsUsable && latest.feedback.state === 'target-met' ? '#a2f47f' : '#e5f1df';
  context.fillRect(0, 0, canvas.width, canvas.height); context.restore();
  if (!metricsUsable) return;
  coachingPauseKey = null;
  $('status').textContent = $('source').value === 'phone' ? 'Live · iPhone' : 'Live';
  for (const [id, key] of [['knee', 'kneeFlexionDeg'], ['hip', 'hipFlexionDeg'], ['torso', 'torsoLeanDeg']]) $(id).textContent = degrees(latest.metrics[key]);
  $('phase').textContent = PHASE[latest.phase] ?? 'Moving';
  $('feedback').dataset.state = latest.feedback.state;
  $('cue').textContent = latest.feedback.state === 'target-met' ? 'Your depth goal, reached.' : 'Keep your rhythm.';
  $('detail').textContent = latest.feedback.label;
}

function stop(message = 'Session stopped', { persist = true } = {}) {
  const ownedCapture = capture; capture = null;
  if (ownedCapture) {
    ownedCapture.durationMs = performance.now() - ownedCapture.startClock;
    const recorded = ownedCapture.recorder.stop();
    ownedCapture.recorder = null;
    if (persist) {
      void showStoppedReview(ownedCapture, recorded, ownedCapture.archive.live);
      if (ownedCapture.saveEnabled) saveCapture(ownedCapture, recorded);
    }
  }
  const previous = controller; controller = null; phoneFeedback = null; currentCoach = null; coachingPauseKey = null;
  const oldReceiver = receiver, oldPairing = pairing; receiver = null; pairing = null;
  previous?.abort();
  if (oldReceiver) void oldReceiver.stop().catch(() => {});
  else if (oldPairing) void revokePairing(oldPairing).catch(() => {});
  analysis?.stop(); analysis = null;
  media?.getTracks().forEach(track => track.stop()); media = null;
  video.srcObject = null;
  cancelAnimationFrame(animation);
  latest = null; clearTracking(); $('view-status').textContent = 'Numbers appear once you’re side-on and steady.';
  $('source').disabled = false;
  $('save-local').disabled = false;
  $('recording-status').textContent = ownedCapture ? (persist ? ownedCapture.saveEnabled ? 'Preparing replay. Saving status appears below.' : 'Preparing temporary replay. Saving was off; this review lasts until your next Start or closing this page.' : 'Session ended. Saving was not completed.') : 'Stop the session to save. Closing this tab may lose the current session.';
  $('pairing').hidden = true; $('phone-url').value = ''; $('pairing-expiry').textContent = '';
  $('pairing-qr').hidden = true; $('phone-qr').width = 0; $('phone-qr').height = 0;
  $('copy-phone').textContent = 'Copy link';
  $('start').disabled = false; $('start').hidden = false; $('stop').hidden = true;
  $('empty').hidden = false; $('status').textContent = message;
  $('feedback').dataset.state = 'unknown'; $('cue').textContent = 'One rep at a time.';
  $('detail').textContent = 'Start a new session whenever you are ready.';
  $('phase').textContent = 'Waiting for you'; $('age').textContent = formCheck(Infinity);
  const reviews = $('ai-feed').children.length;
  $('ai').textContent = reviews ? `Session stopped · ${reviews} coach ${reviews === 1 ? 'note' : 'notes'} below.` : 'Session stopped · no coach notes yet.';
}

async function waitForVideo(signal) {
  signal.throwIfAborted();
  if (video.readyState >= 2 && video.videoWidth) return;
  await new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer); video.removeEventListener('loadeddata', loaded); signal.removeEventListener('abort', aborted);
      error ? reject(error) : resolve();
    };
    const loaded = () => finish();
    const aborted = () => finish(new DOMException('Session stopped', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Camera did not start. Choose an available camera and try again.')), 15_000);
    video.addEventListener('loadeddata', loaded, { once: true }); signal.addEventListener('abort', aborted, { once: true });
  });
}

async function showPairingQr(own, created) {
  // Render off-screen: a late encoder cannot redraw an expired/stopped invite.
  const drawing = document.createElement('canvas');
  try {
    await QRCode.toCanvas(drawing, created.phoneUrl, { width: 220, margin: 4, errorCorrectionLevel: 'M' });
    if (controller !== own || own.signal.aborted || pairing !== created || $('phone-url').value !== created.phoneUrl) return;
    const destination = $('phone-qr'); destination.width = drawing.width; destination.height = drawing.height;
    destination.getContext('2d').drawImage(drawing, 0, 0); $('pairing-qr').hidden = false;
  } catch { /* The readable private link remains available if QR generation fails. */ }
}

function sessionFailed(own, error) {
  if (controller !== own || own.signal.aborted) return;
  stop('Ready to try again');
  $('error').textContent = error.name === 'NotAllowedError'
    ? 'Camera access was not granted. Allow camera access in your browser, then try again.'
    : error.message || String(error);
}

async function analyzeStream(own, stream, coachRep, source, sendFeedback) {
  if (own.signal.aborted || controller !== own) { stream.getTracks().forEach(track => track.stop()); return; }
  try {
    media = stream;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
      if (controller === own) stop('Camera disconnected. Start a new session.');
    }, { once: true }));
    video.srcObject = stream; await video.play(); await waitForVideo(own.signal); own.signal.throwIfAborted();
    {
      const owned = { own, generation: reviewGeneration, saveEnabled: $('save-local').checked, id: createSessionId(), startedAt: Date.now(), startClock: performance.now(), archive: createLiveArchive({ source }) };
      capture = owned;
      owned.recorder = createLiveRecorder(stream, { onStatus(state) {
        if (capture !== owned || controller !== own) return;
        $('recording-status').textContent = state.state === 'recording' ? owned.saveEnabled ? 'Recording on this computer · Stop to save. Up to 5 minutes / 100 MiB.' : 'Temporary recording for replay · saving is off. Cleared on next Start or leaving this page. Up to 5 minutes / 100 MiB.'
          : state.error || 'Recording limit reached. Tracking continues; Stop saves the recorded prefix and session notes.';
      } });
    }
    $('empty').hidden = true; $('status').textContent = 'Getting the form check ready';
    $('pairing-title').textContent = 'iPhone connected.';
    $('pairing-help').textContent = 'Keep Safari in the foreground and your phone awake. Tracking and coaching start here automatically.';
    $('cue').textContent = 'Finding your movement.'; $('detail').textContent = 'Stand side-on with your whole body visible.';
    $('start').hidden = true;
    const session = await startLiveSquat(video, {
      model: 'heavy', targetKneeFlexionDeg: 110, declaredView: 'side', signal: own.signal, captureEvidence: true,
      onSample(sample) {
        if (controller !== own || own.signal.aborted) return;
        const changedEpoch = latest && latest.viewGuard.epoch !== sample.viewGuard.epoch;
        latest = sample; lastArrived = performance.now();
        if (capture?.own === own) { capture.recorder.markSample(sample); capture.archive.sample(sample); }
        video.dataset.analysisEpoch = String(sample.viewGuard.epoch);
        $('view-status').textContent = sample.analysisEligible ? 'Good side view · measuring each rep.' : sample.viewGuard.state !== 'stable' ? 'Hold still while we lock on to you.' : 'Turn side-on so we can measure depth.';
        for (const [id, key] of [['knee', 'kneeFlexionDeg'], ['hip', 'hipFlexionDeg'], ['torso', 'torsoLeanDeg']]) { $(id).dataset.validity = sample.metricValidity[key].status; $(id).title = sample.metricValidity[key].reason.replaceAll('_', ' '); }
        if (changedEpoch) { pauseCurrentCoaching('epoch-changed'); $('rep').textContent = 'The view changed. Your earlier notes stay below. Start your next rep from standing.'; $('rep').removeAttribute('data-state'); }
        if (!sample.analysisEligible) pauseCurrentCoaching(sample.viewGuard.reason);
        $('latency').textContent = `${Math.round(sample.processingLatencyMs)} ms · ${sample.stats.analyzedHz.toFixed(1)} analyzed fps`;
        if (sample.analysisEligible && sample.frame.quality === 'usable' && sample.processingLatencyMs <= 500) sendFeedback({ kind: 'local', text: `Knee bend ${degrees(sample.metrics.kneeFlexionDeg)} · ${PHASE[sample.phase] ?? 'Moving'}. ${sample.feedback.label}`, sourceTimestampMs: sample.timestampMs });
      },
      onRepComplete(event) {
        if (controller !== own || own.signal.aborted) return;
        completed++; $('count').textContent = String(completed);
        if (capture?.own === own) capture.archive.rep(event);
        $('rep').textContent = `Rep ${completed} · ${elapsed(event.rep.bottomMs)}: ${event.feedback.label}`;
        $('rep').dataset.state = event.feedback.state;
        void coachRep(event);
      },
      onError(error) { sessionFailed(own, error); },
    });
    if (own.signal.aborted || controller !== own) { session.stop(); return; }
    analysis = session;
    $('status').textContent = source === 'phone' ? 'Live · iPhone' : 'Live'; render();
  } catch (error) { sessionFailed(own, error); }
}

$('start').onclick = async () => {
  if (controller) return;
  if (unsaved.size >= 2) { $('error').textContent = 'Retry saving or discard an unsaved session below before starting another.'; return; }
  reviewGeneration++; clearStoppedReview();
  const own = new AbortController(); controller = own;
  const source = $('source').value;
  let lastFeedbackAt = -Infinity, lastFeedbackKind = null, aiRetry, pendingAi = null;
  own.signal.addEventListener('abort', () => { clearTimeout(aiRetry); pendingAi = null; }, { once: true });
  const sendFeedback = (payload, attempts = 10, evidenceEpoch = latest?.viewGuard.epoch) => {
    if (controller !== own || own.signal.aborted || source !== 'phone' || !receiver) return;
    const now = performance.now();
    if (payload.kind !== 'ai' && (pendingAi || now - lastFeedbackAt < 500 || payload.kind === 'status' && lastFeedbackKind === 'status')) return;
    const outgoing = payload.kind === 'ai' && latest?.viewGuard.epoch !== evidenceEpoch && !payload.text.startsWith('Earlier view ')
      ? { ...payload, text: briefFocus(`Earlier view ${evidenceEpoch + 1}: ${payload.text}`) } : payload;
    if (receiver.sendFeedback(outgoing)) {
      lastFeedbackAt = now; lastFeedbackKind = payload.kind;
      if (payload.kind === 'ai') { clearTimeout(aiRetry); pendingAi = null; }
    } else if (payload.kind === 'ai' && attempts > 0) {
      // One bounded pending narration; a recent local update must not drop the AI result.
      clearTimeout(aiRetry); pendingAi = payload;
      aiRetry = setTimeout(() => sendFeedback(payload, attempts - 1, evidenceEpoch), 150);
    } else if (payload.kind === 'ai') pendingAi = null;
  };
  phoneFeedback = sendFeedback;
  const coachRep = liveCoach(own.signal, (payload, epoch) => sendFeedback(payload, 10, epoch));
  currentCoach = coachRep; coachingPauseKey = null;
  $('error').textContent = ''; $('phone-setup').hidden = true;
  $('start').disabled = true; $('stop').hidden = false; $('source').disabled = true;
  $('save-local').disabled = true;
  $('recording-status').textContent = $('save-local').checked ? 'Recording starts when your camera connects. Stop to save on this computer.' : 'Saving is off for this session.';
  $('status').textContent = source === 'phone' ? 'Creating private phone link' : 'Allow camera access';
  completed = 0; $('count').textContent = '0'; $('rep').textContent = 'How your last rep went will show here.';
  $('rep').removeAttribute('data-state'); $('latency').textContent = '—';
  $('ai').textContent = 'Checking ChatGPT connection…'; $('ai-limit').hidden = true;
  $('ai-feed').replaceChildren(); $('ai-feed').scrollTop = 0; $('ai-empty').hidden = false;
  try {
    if (source === 'phone') {
      const created = await createPairing({ signal: own.signal });
      if (own.signal.aborted || controller !== own) { await revokePairing(created); return; }
      pairing = created;
      if (new URL(created.phoneUrl).protocol !== 'https:') {
        stop('Phone setup needed'); $('phone-setup').hidden = false;
        $('error').textContent = 'A trusted HTTPS phone address has not been configured. Choose Mac / Continuity Camera to start now.';
        return;
      }
      $('pairing').hidden = false; $('phone-url').value = created.phoneUrl;
      void showPairingQr(own, created);
      $('pairing-title').textContent = 'Open your private camera link.';
      $('pairing-help').textContent = 'Keep both devices on the same Wi-Fi. Open this link in iPhone Safari, then allow the camera. Tracking starts here automatically.';
      $('pairing-expiry').textContent = `Private link · expires at ${new Date(created.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Share only with your own phone.`;
      $('status').textContent = 'Waiting for your iPhone';
      let attached = false;
      const connected = await connectReceiver(created, {
        signal: own.signal,
        onStream(stream) {
          if (!stream) return;
          if (own.signal.aborted || controller !== own) { stream.getTracks().forEach(track => track.stop()); return; }
          if (attached) return;
          attached = true;
          void analyzeStream(own, stream, coachRep, source, sendFeedback);
        },
        onState({ status, detail }) {
          if (own.signal.aborted || controller !== own) return;
          if (status === 'closed') {
            stop('Phone disconnected. Start a new session.');
            $('error').textContent = detail === 'expired' ? 'Your private phone session expired. Start again to create a fresh link.' : `${detail || 'Phone connection ended.'} Start again for a fresh private link.`;
          } else if (!attached) $('status').textContent = status === 'connecting' ? 'Connecting your iPhone' : 'Waiting for your iPhone';
        },
      });
      if (own.signal.aborted || controller !== own) { await connected.stop(); return; }
      receiver = connected;
    } else {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or this app’s localhost address.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
      await analyzeStream(own, stream, coachRep, source, sendFeedback);
    }
  } catch (error) { sessionFailed(own, error); }
};
$('copy-phone').onclick = async () => {
  const url = $('phone-url').value;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    if ($('phone-url').value === url) $('copy-phone').textContent = 'Copied';
  } catch {
    $('phone-url').focus(); $('phone-url').select();
    $('pairing-expiry').textContent = 'Copy the selected private link and open it on your iPhone.';
  }
};
$('source').onchange = () => { $('phone-setup').hidden = true; $('error').textContent = ''; };
$('stop').onclick = () => stop();
window.addEventListener('beforeunload', event => { if (capture || unsaved.size) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { reviewGeneration++; stop('Session ended', { persist: false }); clearStoppedReview(); });
