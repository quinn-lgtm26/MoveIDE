const NS = 'http://www.w3.org/2000/svg';
const WINDOW_MS = 30_000, MAX_SAMPLES = 450, MAX_GAP_MS = 1000;
const SERIES = [
  { key: 'kneeFlexionDeg', label: 'Knee bend', color: '#087f8c', dash: '' },
  { key: 'hipFlexionDeg', label: 'Hip hinge', color: '#7759b6', dash: '7 3' },
  { key: 'torsoLeanDeg', label: 'Chest angle', color: '#b36516', dash: '2 3' },
];

/** Projected, source-timestamped angles; gaps are never interpolated or replaced by zero. */
export function createLiveChart(element, { targetKneeFlexionDeg = 110 } = {}) {
  if (targetKneeFlexionDeg !== null && (!Number.isFinite(targetKneeFlexionDeg) || targetKneeFlexionDeg < 30 || targetKneeFlexionDeg > 150)) throw new RangeError('Practice target must be 30–150 degrees or null.');
  const document = element.ownerDocument;
  const svgNode = (tag, attrs = {}, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const svg = svgNode('svg', { viewBox: '0 0 300 220', role: 'img', 'aria-label': 'Projected movement angles over source time', width: '100%', height: 220 });
  svg.style.display = 'block'; svg.style.minWidth = '300px';
  const summary = document.createElement('p');
  summary.style.fontSize = '0.85rem'; summary.style.margin = '0.5rem 0';
  const legend = document.createElement('p');
  legend.style.fontSize = '0.8rem'; legend.style.margin = '0';
  legend.textContent = 'Knee bend: solid teal · Hip hinge: dashed purple · Chest angle: dotted amber. Projected estimates; gaps mean unavailable tracking. Rep lines mark completed bottoms.'
    + (targetKneeFlexionDeg === null ? '' : ` Long-dashed teal line: ${targetKneeFlexionDeg}° knee practice target, not a form-quality standard.`);
  const baselinePanel = document.createElement('div'); baselinePanel.dataset.chartBaseline = '';
  baselinePanel.style.fontSize = '0.85rem'; baselinePanel.style.overflowX = 'auto';
  element.replaceChildren(svg, summary, legend, baselinePanel);
  let samples = [], reps = [], stopped = false, timer = null, lastRender = -Infinity;
  let currentEpoch = null, baseline = null, latestRep = null, baselineReset = false, renderedWidth = 0;
  const readRep = event => {
    const { rep, report } = event;
    const original = report?.reps?.find(value => value.id === rep.id);
    if (!original || ![rep.startMs, rep.bottomMs, rep.endMs].every(Number.isFinite)
      || rep.startMs > rep.bottomMs || rep.bottomMs > rep.endMs || rep.startMs >= rep.endMs
      || ['startMs', 'bottomMs', 'endMs'].some(key => original[key] !== rep[key])) return null;
    const atBottom = report.frames?.find(frame => frame.timestampMs === rep.bottomMs)?.quality === 'usable';
    const metric = (key, unit) => {
      const value = report.measurements?.find(value => value.repId === rep.id && value.metric === key);
      return atBottom && value?.quality === 'usable' && value.unit === unit && value.evidenceTimestampMs === rep.bottomMs && Number.isFinite(value.value)
        && (key !== 'rep_duration' || value.value === rep.endMs - rep.startMs) ? value.value : null;
    };
    return { key: event.key, epoch: event.epoch, timestampMs: rep.bottomMs,
      provenance: JSON.stringify([report.protocol, report.poseModel]),
      knee: metric('knee_flexion', 'deg'), torso: metric('torso_lean', 'deg'), duration: metric('rep_duration', 'ms') };
  };
  const renderBaseline = () => {
    baselinePanel.replaceChildren();
    const intro = document.createElement('p');
    intro.textContent = baseline ? `Personal reference: first completed rep at ${(baseline.timestampMs / 1000).toFixed(2)} s · latest at ${(latestRep.timestampMs / 1000).toFixed(2)} s. Same view epoch and analysis protocol. This is not a standard of good form.`
      : `${baselineReset ? 'Reference reset after view or analysis conditions changed. ' : ''}Complete a rep to set a personal reference. No AI is needed.`;
    baselinePanel.append(intro);
    if (!baseline) return;
    const table = document.createElement('table'); table.style.width = '100%'; table.style.textAlign = 'left'; table.setAttribute('aria-label', 'Completed rep compared with first rep in this view');
    const row = document.createElement('tr');
    for (const label of ['Metric', 'First rep', 'Latest rep', 'Change']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; row.append(th); }
    const head = document.createElement('thead'); head.append(row); table.append(head);
    const body = document.createElement('tbody');
    for (const [key, label, unit, scale] of [['knee', 'Bottom knee bend', '°', 1], ['torso', 'Bottom chest angle', '°', 1], ['duration', 'Duration', ' s', 1000]]) {
      const first = baseline[key], last = latestRep[key], format = value => value === null ? 'Unavailable' : `${(value / scale).toFixed(key === 'duration' ? 2 : 1)}${unit}`;
      const delta = first === null || last === null ? null : last - first;
      const tr = document.createElement('tr');
      for (const value of [label, format(first), format(last), delta === null ? 'Unavailable' : `${delta > 0 ? '+' : ''}${format(delta)}`]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      body.append(tr);
    }
    table.append(body); baselinePanel.append(table);
  };
  const prune = () => {
    const cutoff = (samples.at(-1)?.timestampMs ?? 0) - WINDOW_MS;
    samples = samples.filter(sample => sample.timestampMs >= cutoff).slice(-MAX_SAMPLES);
    reps = reps.filter(rep => rep.timestampMs >= cutoff).slice(-150);
  };
  const render = () => {
    timer = null; lastRender = performance.now();
    renderedWidth = Math.max(300, element.clientWidth);
    svg.setAttribute('viewBox', `0 0 ${renderedWidth} 220`);
    const right = renderedWidth - 18;
    const latest = samples.at(-1), end = latest?.timestampMs ?? 0, start = Math.max(0, end - WINDOW_MS);
    const span = Math.max(1000, end - start), x = time => 46 + (time - start) / span * (right - 46);
    const y = degrees => 176 - degrees / 180 * 150;
    svg.replaceChildren(svgNode('title', {}, 'Projected knee bend, hip hinge, and chest angle'), svgNode('desc', {}, 'Last 30 seconds of analyzed source time. No interpolation across missing measurements, view epochs, or gaps longer than one second. These are video-plane estimates, not calibrated 3D joint measurements.'));
    svg.dataset.sampleCount = String(samples.length);
    svg.dataset.repCount = String(reps.length);
    for (const angle of [0, 90, 180]) {
      svg.append(svgNode('line', { x1: 46, x2: right, y1: y(angle), y2: y(angle), stroke: 'currentColor', opacity: 0.12 }));
      svg.append(svgNode('text', { x: 39, y: y(angle) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'currentColor' }, `${angle}°`));
    }
    svg.append(svgNode('text', { x: 46, y: 14, 'font-size': 11, fill: 'currentColor' }, 'Angle (degrees)'));
    if (targetKneeFlexionDeg !== null) {
      svg.append(svgNode('line', { x1: 46, x2: right, y1: y(targetKneeFlexionDeg), y2: y(targetKneeFlexionDeg), stroke: '#087f8c', opacity: 0.6, 'stroke-dasharray': '8 5', 'data-practice-target': targetKneeFlexionDeg }));
    }
    for (const time of [start, start + span / 2, start + span]) {
      svg.append(svgNode('text', { x: x(time), y: 194, 'text-anchor': time === start ? 'start' : time === start + span ? 'end' : 'middle', 'font-size': 11, fill: 'currentColor' }, `${(time / 1000).toFixed(1)} s`));
    }
    svg.append(svgNode('text', { x: (46 + right) / 2, y: 214, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, 'Source time (seconds)'));
    for (const rep of reps) {
      if (rep.timestampMs < start || rep.timestampMs > end) continue;
      const line = svgNode('line', { x1: x(rep.timestampMs), x2: x(rep.timestampMs), y1: 24, y2: 176, stroke: 'currentColor', opacity: 0.35, 'stroke-dasharray': '3 4', 'data-rep-key': rep.key });
      line.append(svgNode('title', {}, `Completed rep bottom at ${(rep.timestampMs / 1000).toFixed(2)} s · view epoch ${rep.epoch}`)); svg.append(line);
    }
    for (const series of SERIES) {
      let previous = null, path = '', starts = [];
      for (const sample of samples) {
        const value = sample[series.key];
        if (value === null) { previous = null; continue; }
        const continuous = previous && sample.epoch === previous.epoch && sample.timestampMs - previous.timestampMs <= MAX_GAP_MS;
        path += `${continuous ? 'L' : 'M'}${x(sample.timestampMs).toFixed(2)},${y(value).toFixed(2)} `;
        if (!continuous) starts.push([x(sample.timestampMs), y(value)]);
        previous = sample;
      }
      svg.append(svgNode('path', { d: path.trim(), fill: 'none', stroke: series.color, 'stroke-width': 2.3, 'stroke-linejoin': 'round', 'stroke-dasharray': series.dash, 'data-metric': series.key }));
      for (const [cx, cy] of starts) svg.append(svgNode('circle', { cx, cy, r: 2.3, fill: series.color }));
    }
    const values = SERIES.map(series => `${series.label}: ${latest?.[series.key] == null ? 'unavailable' : `${latest[series.key].toFixed(1)}°`}`).join(' · ');
    summary.textContent = latest ? `${stopped ? 'Stopped · retained' : 'Last analyzed'} sample ${(end / 1000).toFixed(2)} s · ${values}` : 'Waiting for analyzed samples. Missing angles remain unavailable.';
    renderBaseline();
  };
  const requestRender = () => {
    if (timer !== null) return;
    const remaining = 250 - (performance.now() - lastRender);
    if (remaining <= 0) render(); else timer = setTimeout(render, remaining);
  };
  render();
  // Observe width only: chart-height changes must not start a resize/render loop.
  const observer = new ResizeObserver(() => {
    if (Math.max(300, element.clientWidth) !== renderedWidth) requestRender();
  });
  observer.observe(element);
  return {
    push(sample) {
      if (stopped || !Number.isFinite(sample?.timestampMs) || sample.timestampMs < 0 || sample.timestampMs <= (samples.at(-1)?.timestampMs ?? -1)) return;
      const epoch = sample.viewGuard?.epoch;
      if (Number.isSafeInteger(epoch) && epoch >= 0 && currentEpoch !== epoch) {
        baselineReset = currentEpoch !== null; currentEpoch = epoch; baseline = null; latestRep = null;
      }
      const stable = sample.viewGuard?.state === 'stable' && Number.isSafeInteger(epoch) && epoch >= 0 && sample.analysisEligible !== false;
      const point = { timestampMs: sample.timestampMs, epoch };
      for (const { key } of SERIES) {
        const value = sample.metrics?.[key];
        point[key] = stable && sample.metricValidity?.[key]?.status === 'estimated' && Number.isFinite(value) && value >= 0 && value <= 180 ? value : null;
      }
      samples.push(point); prune(); requestRender();
    },
    rep(event) {
      const timestampMs = event?.rep?.bottomMs;
      if (stopped || typeof event?.key !== 'string' || !event.key || event.key.length > 200 || !Number.isFinite(timestampMs) || timestampMs < 0 || !Number.isSafeInteger(event.epoch) || event.epoch < 0 || reps.some(rep => rep.key === event.key)) return;
      const reference = readRep(event);
      if (reference && (currentEpoch === null || currentEpoch === event.epoch)) {
        currentEpoch = event.epoch;
        if (!baseline || baseline.provenance !== reference.provenance) { baselineReset = baseline !== null; baseline = reference; latestRep = reference; }
        else if (reference.timestampMs > latestRep.timestampMs) latestRep = reference;
      }
      reps.push({ key: event.key, timestampMs, epoch: event.epoch }); prune(); requestRender();
    },
    reset() { clearTimeout(timer); timer = null; samples = []; reps = []; stopped = false; currentEpoch = null; baseline = null; latestRep = null; baselineReset = false; render(); },
    stop() { stopped = true; clearTimeout(timer); timer = null; render(); },
  };
}
