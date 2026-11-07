import { startLiveSquat } from './motion/index.mjs';
import { drawSquatOverlay } from '../motion/overlay.mjs';
import { buildCoachPacket, validateCoachingResponse } from '../coaching/index.mjs';
import { chatGPTProvider } from '../provider/client.mjs';

const $ = id => document.getElementById(id);
const video = $('video'), canvas = $('overlay'), context = canvas.getContext('2d');
let controller, media, analysis, latest, lastArrived = 0, animation, completed = 0;
const degrees = value => Number.isFinite(value) ? `${value.toFixed(0)}°` : '—';
const elapsed = milliseconds => `${(milliseconds / 1000).toFixed(1)}s`;

function liveCoach(signal) {
  let model, busy = false, sent = 0, lastSent = -Infinity;
  const seen = new Set();
  void (async () => {
    try {
      const connection = await chatGPTProvider.getConnection(signal);
      if (signal.aborted) return;
      if (connection.state !== 'connected') { $('ai').textContent = 'Connect the AI coach on the Recorded clip page to add AI coaching. Local tracking stays on.'; return; }
      const models = await chatGPTProvider.listModels(signal);
      if (signal.aborted) return;
      model = models[0]?.id;
      $('ai').textContent = model ? 'Connected · AI feedback follows complete reps.' : 'No ChatGPT model available. Local tracking stays on.';
    } catch (error) { if (!signal.aborted) $('ai').textContent = 'ChatGPT unavailable. Local tracking stays on.'; }
  })();
  return async event => {
    if (signal.aborted || !model || busy || sent >= 6 || performance.now() - lastSent < 8000 || seen.has(event.key)) return;
    let packet, images;
    try {
      packet = buildCoachPacket(event.report, { repIds: [event.rep.id] });
      images = packet.evidence.map(evidence => ({ ...evidence, blob: event.evidenceImages.find(image => image.timestampMs === evidence.timestampMs)?.blob }));
      if (!packet.measurements.length || !images.length || images.some(image => !image.blob)) return;
    } catch { return; }
    busy = true; sent++; lastSent = performance.now(); seen.add(event.key);
    $('ai').textContent = `AI reviewing rep at ${elapsed(event.rep.bottomMs)}… Keep moving.`;
    try {
      const result = validateCoachingResponse(await chatGPTProvider.interpret(packet, images, { model, signal }), packet);
      if (signal.aborted) return;
      const evidence = new Map([...packet.measurements.map(item => [item.id, item.evidenceTimestampMs]), ...packet.evidence.map(item => [item.id, item.timestampMs])]);
      const cite = item => `${item.text} [${[...new Set(item.evidenceIds.map(id => evidence.get(id)))].map(elapsed).join(', ')}]`;
      $('ai').textContent = [...result.observations.slice(0, 2).map(cite), `Next focus: ${cite(result.nextFocus)}`, result.uncertainty].join(' ');
    } catch (error) { if (!signal.aborted) $('ai').textContent = 'AI feedback unavailable for this rep. Local tracking continues.'; }
    finally { busy = false; }
  };
}

function clearTracking() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const id of ['knee', 'hip', 'torso']) $(id).textContent = '—';
}

function render() {
  if (!controller || controller.signal.aborted) return;
  animation = requestAnimationFrame(render);
  const age = latest ? performance.now() - lastArrived + latest.processingLatencyMs : Infinity;
  const usable = latest?.frame.quality === 'usable' && age <= 500;
  $('age').textContent = latest ? `Pose age ${Math.round(age)} ms` : 'Waiting for pose';
  if (!usable) {
    clearTracking();
    $('feedback').dataset.state = 'unknown';
    $('phase').textContent = 'Tracking unavailable';
    if (latest) {
      $('cue').textContent = age > 500 ? 'Waiting for a fresh view.' : 'Step into view.';
      $('detail').textContent = age > 500 ? 'Tracking is delayed. Numbers are hidden until a fresh pose arrives.' : 'Keep your whole body visible and turn side-on to the camera.';
    }
    return;
  }
  const bounds = canvas.getBoundingClientRect();
  const scale = devicePixelRatio || 1;
  if (canvas.width !== Math.round(bounds.width * scale) || canvas.height !== Math.round(bounds.height * scale)) {
    canvas.width = Math.round(bounds.width * scale); canvas.height = Math.round(bounds.height * scale);
  }
  drawSquatOverlay(context, latest.frame, { side: latest.report.protocol.side,
    videoWidth: video.videoWidth, videoHeight: video.videoHeight, width: canvas.width, height: canvas.height });
  context.save(); context.globalCompositeOperation = 'source-in';
  context.fillStyle = latest.feedback.state === 'target-met' ? '#a2f47f' : '#e5f1df';
  context.fillRect(0, 0, canvas.width, canvas.height); context.restore();
  $('knee').textContent = degrees(latest.metrics.kneeFlexionDeg);
  $('hip').textContent = degrees(latest.metrics.hipFlexionDeg);
  $('torso').textContent = degrees(latest.metrics.torsoLeanDeg);
  $('phase').textContent = `${latest.phase.replaceAll('-', ' ')} · provisional`;
  $('feedback').dataset.state = latest.feedback.state;
  $('cue').textContent = latest.feedback.state === 'target-met' ? 'Your depth goal, reached.' : 'Keep your rhythm.';
  $('detail').textContent = latest.feedback.label;
}

function stop(message = 'Session stopped') {
  controller?.abort(); controller = null;
  analysis?.stop(); analysis = null;
  media?.getTracks().forEach(track => track.stop()); media = null;
  video.srcObject = null;
  cancelAnimationFrame(animation);
  latest = null; clearTracking();
  $('start').disabled = false; $('start').hidden = false; $('stop').hidden = true;
  $('empty').hidden = false; $('status').textContent = message;
  $('feedback').dataset.state = 'unknown'; $('cue').textContent = 'One rep at a time.';
  $('detail').textContent = 'Start a new session whenever you are ready.';
  $('phase').textContent = 'Awaiting movement'; $('age').textContent = 'No pose yet';
}

async function waitForVideo(signal) {
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

$('start').onclick = async () => {
  if (controller) return;
  const own = new AbortController(); controller = own;
  const coachRep = liveCoach(own.signal);
  $('error').textContent = ''; $('start').disabled = true; $('stop').hidden = false;
  $('status').textContent = 'Allow camera access';
  completed = 0; $('count').textContent = '0'; $('rep').textContent = 'Your completed-rep feedback will appear here.';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access requires HTTPS or this app’s localhost address.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
    if (own.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
    media = stream;
    stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (controller === own) stop('Camera disconnected. Start a new session.'); }, { once: true }));
    video.srcObject = stream; await video.play(); await waitForVideo(own.signal); own.signal.throwIfAborted();
    $('empty').hidden = true; $('status').textContent = 'Preparing Heavy pose model';
    $('cue').textContent = 'Finding your movement.'; $('detail').textContent = 'Stand side-on with your whole body visible.';
    $('start').hidden = true;
    const session = await startLiveSquat(video, {
      model: 'heavy', targetKneeFlexionDeg: 110, signal: own.signal, captureEvidence: true,
      onSample(sample) { latest = sample; lastArrived = performance.now(); $('latency').textContent = `${Math.round(sample.processingLatencyMs)} ms · ${sample.stats.analyzedHz.toFixed(1)} analyzed fps`; },
      onRepComplete(event) {
        completed++; $('count').textContent = String(completed);
        $('rep').textContent = `Rep ${completed} · ${elapsed(event.rep.bottomMs)}: ${event.feedback.label}`;
        $('rep').dataset.state = event.feedback.state;
        void coachRep(event);
      },
      onError(error) { if (controller === own) { stop('Tracking stopped'); $('error').textContent = error.message || String(error); } },
    });
    if (own.signal.aborted) { session.stop(); return; }
    analysis = session;
    $('status').textContent = 'Live · local analysis'; render();
  } catch (error) {
    if (controller !== own) return;
    stop('Ready to try again'); $('error').textContent = error.name === 'NotAllowedError' ? 'Camera access was not granted. Allow camera access in your browser, then try again.' : error.message || String(error);
  }
};
$('stop').onclick = () => stop();
window.addEventListener('pagehide', () => stop());
