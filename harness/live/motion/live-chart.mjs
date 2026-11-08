import { createRepReference } from './rep-reference.mjs';

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
  const phaseLegend = document.createElement('p'); phaseLegend.className = 'chart-phase-legend';
  phaseLegend.textContent = 'Shading: teal = down, purple = return. Dotted markers = bottom.'
    + (targetKneeFlexionDeg === null ? '' : ` Dashed ${targetKneeFlexionDeg}° line = knee practice target, not a form-quality standard.`);
  const windowLabel = document.createElement('p'); windowLabel.className = 'chart-window-label';
  windowLabel.textContent = 'Rolling 30-second view · Save on this device keeps retained measurements and the available recording.';
  const controls = document.createElement('details'); controls.className = 'chart-metric-controls';
  const controlsTitle = document.createElement('summary'); controlsTitle.textContent = 'Choose angle traces'; controls.append(controlsTitle);
  const enabled = new Set(['kneeFlexionDeg']);
  for (const series of SERIES) {
    const label = document.createElement('label'), input = document.createElement('input');
    input.type = 'checkbox'; input.checked = enabled.has(series.key); input.dataset.chartMetric = series.key;
    input.addEventListener('change', () => { input.checked ? enabled.add(series.key) : enabled.delete(series.key); requestRender(); });
    label.append(input, document.createTextNode(series.label)); controls.append(label);
  }
  const legend = document.createElement('p');
  legend.style.fontSize = '0.8rem'; legend.style.margin = '0';
  legend.textContent = 'Solid teal: knee bend. Dashed purple: hip hinge. Dotted amber: chest angle. Pale teal: descent; pale purple: return. Dotted vertical lines: rep bottoms. Gaps mean unavailable tracking.'
    + (targetKneeFlexionDeg === null ? '' : ` Long-dashed teal line: ${targetKneeFlexionDeg}° knee practice target, not a form-quality standard.`);
  controls.append(legend);
  const repSummary = document.createElement('p'); repSummary.className = 'chart-rep-summary';
  const repDetails = document.createElement('details'); repDetails.className = 'chart-rep-details';
  const repTitle = document.createElement('summary'); repTitle.textContent = 'Completed reps in this window';
  const repList = document.createElement('ol'); repDetails.append(repTitle, repList);
  const baselineDetails = document.createElement('details'); baselineDetails.className = 'chart-reference';
  const baselineTitle = document.createElement('summary'); baselineTitle.textContent = 'Compare with your first rep';
  const baselinePanel = document.createElement('div'); baselinePanel.dataset.chartBaseline = '';
  baselinePanel.style.fontSize = '0.85rem'; baselinePanel.style.overflowX = 'auto';
  baselineDetails.append(baselineTitle, baselinePanel);
  const normalized = document.createElement('details'); normalized.className = 'chart-reference'; normalized.open = true; normalized.hidden = true;
  const normalizedTitle = document.createElement('summary'); normalizedTitle.textContent = 'Your rep curve, adjusted for pace';
  const normalizedText = document.createElement('p'); normalizedText.style.fontSize = '12px';
  normalizedText.textContent = 'First complete compatible rep = personal reference, not an ideal squat. Start, bottom and finish align; angle differences stay unchanged. This comparison updates only after a rep finishes, when its full timing is known.';
  const bandLabel = document.createElement('label'); bandLabel.textContent = 'Visual practice band ';
  const bandSelect = document.createElement('select'); bandSelect.setAttribute('aria-label', 'Visual practice band');
  for (const degrees of [5, 10, 15]) { const option = document.createElement('option'); option.value = String(degrees); option.textContent = `±${degrees}°`; option.selected = degrees === 10; bandSelect.append(option); }
  bandLabel.append(bandSelect);
  const bandNote = document.createElement('p'); bandNote.style.fontSize = '12px'; bandNote.textContent = 'Shaded band is a chosen visual tolerance, not measurement uncertainty, a safety zone or a good-form score. Dashed purple: your reference. Solid teal: latest comparable completed rep.';
  const normalizedSvg = svgNode('svg', { role: 'img', 'aria-label': 'Completed knee-bend curves aligned at start, bottom and finish', width: '100%', height: 200 });
  normalizedSvg.style.minWidth = '300px'; normalizedSvg.style.display = 'block';
  const normalizedStatus = document.createElement('p'); normalizedStatus.style.fontSize = '12px';
  normalized.append(normalizedTitle, normalizedText, bandLabel, normalizedSvg, normalizedStatus, bandNote);
  element.replaceChildren(svg, summary, phaseLegend, repSummary, windowLabel, controls, repDetails, baselineDetails, normalized);
  let samples = [], reps = [], stopped = false, timer = null, lastRender = -Infinity;
  let currentEpoch = null, baseline = null, latestRep = null, baselineReset = false, renderedWidth = 0;
  let curveReference = null, curveLatest = null;
  bandSelect.addEventListener('change', () => requestRender());
  const renderNormalized = () => {
    normalized.hidden = !curveReference;
    if (!curveReference) { normalizedSvg.replaceChildren(); return; }
    const width = Math.max(300, element.clientWidth), right = width - 18;
    const x = phase => 46 + phase / 100 * (right - 46), y = angle => 160 - angle / 180 * 140;
    normalizedSvg.setAttribute('viewBox', `0 0 ${width} 200`); normalizedSvg.replaceChildren();
    for (const angle of [0, 90, 180]) { normalizedSvg.append(svgNode('line', { x1:46,x2:right,y1:y(angle),y2:y(angle),stroke:'currentColor',opacity:.12 }),svgNode('text',{x:39,y:y(angle)+4,'text-anchor':'end','font-size':11,fill:'currentColor'},`${angle}°`)); }
    for (const [phase,label] of [[0,'Start · 0%'],[50,'Bottom · 50%'],[100,'Finish · 100%']]) normalizedSvg.append(svgNode('text',{x:x(phase),y:184,'text-anchor':phase===0?'start':phase===100?'end':'middle','font-size':11,fill:'currentColor'},label));
    const segments = points => { const groups=[]; let current=[]; for(const point of points){if(point.kneeFlexionDeg===null||current.length&&current.at(-1).segmentId!==point.segmentId){if(current.length)groups.push(current);current=[];}if(point.kneeFlexionDeg!==null)current.push(point);}if(current.length)groups.push(current);return groups; };
    const band = [5,10,15].includes(Number(bandSelect.value)) ? Number(bandSelect.value) : 10;
    for(const points of segments(curveReference.points)){
      const upper=points.map(point=>`${x(point.phasePercent)},${y(Math.min(180,point.kneeFlexionDeg+band))}`);
      const lower=[...points].reverse().map(point=>`${x(point.phasePercent)},${y(Math.max(0,point.kneeFlexionDeg-band))}`);
      normalizedSvg.append(svgNode('polygon',{points:[...upper,...lower].join(' '),fill:'#7759b6',opacity:.12,'data-reference-band':band}));
    }
    for(const [curve,color,dash,role] of [[curveReference,'#7759b6','6 4','reference'],[curveLatest,'#087f8c','','latest']]){
      if(!curve)continue;
      for(const points of segments(curve.points)){
        const d=points.map((point,index)=>`${index?'L':'M'}${x(point.phasePercent).toFixed(2)},${y(point.kneeFlexionDeg).toFixed(2)}`).join(' ');
        normalizedSvg.append(svgNode('path',{d,fill:'none',stroke:color,'stroke-width':2.2,'stroke-dasharray':dash,'data-normalized-curve':role}));
      }
    }
    normalizedStatus.textContent = curveReference.key===curveLatest?.key ? 'Reference captured. Finish another rep in the same view to compare its shape.'
      : `Reference bottom ${(curveReference.bottomMs/1000).toFixed(2)} s · latest bottom ${(curveLatest.bottomMs/1000).toFixed(2)} s. Time is aligned separately for descent and return; missing source intervals stay gaps.`;
  };
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
    return { key: event.key, epoch: event.epoch, timestampMs: rep.bottomMs, startMs: rep.startMs, endMs: rep.endMs,
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
    const hasAngles = samples.some(sample => SERIES.some(({key}) => sample[key] !== null));
    svg.hidden = !hasAngles; svg.style.display = hasAngles ? 'block' : 'none';
    controls.hidden = !hasAngles; windowLabel.hidden = !hasAngles; phaseLegend.hidden = !hasAngles;
    phaseLegend.textContent = 'Shading: teal = down, purple = return. Dotted markers = bottom.'
      + (targetKneeFlexionDeg === null || !enabled.has('kneeFlexionDeg') ? '' : ` Dashed ${targetKneeFlexionDeg}° line = knee practice target, not a form-quality standard.`);
    baselineDetails.hidden = !baseline; repDetails.hidden = !reps.some(rep => rep.reference);
    for (const angle of [0, 90, 180]) {
      svg.append(svgNode('line', { x1: 46, x2: right, y1: y(angle), y2: y(angle), stroke: 'currentColor', opacity: 0.12 }));
      svg.append(svgNode('text', { x: 39, y: y(angle) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'currentColor' }, `${angle}°`));
    }
    svg.append(svgNode('text', { x: 46, y: 14, 'font-size': 11, fill: 'currentColor' }, 'Angle (degrees)'));
    if (targetKneeFlexionDeg !== null && enabled.has('kneeFlexionDeg')) {
      svg.append(svgNode('line', { x1: 46, x2: right, y1: y(targetKneeFlexionDeg), y2: y(targetKneeFlexionDeg), stroke: '#087f8c', opacity: 0.6, 'stroke-dasharray': '8 5', 'data-practice-target': targetKneeFlexionDeg }));
    }
    for (const time of [start, start + span / 2, start + span]) {
      svg.append(svgNode('text', { x: x(time), y: 194, 'text-anchor': time === start ? 'start' : time === start + span ? 'end' : 'middle', 'font-size': 11, fill: 'currentColor' }, `${(time / 1000).toFixed(1)} s`));
    }
    svg.append(svgNode('text', { x: (46 + right) / 2, y: 214, 'text-anchor': 'middle', 'font-size': 11, fill: 'currentColor' }, 'Source time (seconds)'));
    for (const rep of reps) {
      if (rep.timestampMs < start || rep.timestampMs > end) continue;
      if (rep.reference) {
        for (const [phase, from, to, color] of [['descent', rep.reference.startMs, rep.timestampMs, '#087f8c'], ['return', rep.timestampMs, rep.reference.endMs, '#7759b6']]) {
          const left = x(Math.max(start, from)), phaseRight = x(Math.min(end, to));
          if (phaseRight > left) {
            const area = svgNode('rect', { x: left, y: 26, width: phaseRight - left, height: 150, fill: color, opacity: 0.065, 'data-rep-phase': phase });
            area.append(svgNode('title', {}, `${phase === 'descent' ? 'Descent' : 'Return'} ${(from / 1000).toFixed(2)}–${(to / 1000).toFixed(2)} s`)); svg.append(area);
          }
        }
      }
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
      const group = svgNode('g', { 'data-trace': series.key }); group.style.display = enabled.has(series.key) ? '' : 'none';
      group.append(svgNode('path', { d: path.trim(), fill: 'none', stroke: series.color, 'stroke-width': 2.3, 'stroke-linejoin': 'round', 'stroke-dasharray': series.dash, 'data-metric': series.key }));
      for (const [cx, cy] of starts) group.append(svgNode('circle', { cx, cy, r: 2.3, fill: series.color }));
      svg.append(group);
    }
    const values = SERIES.filter(series => enabled.has(series.key)).map(series => `${series.label}: ${latest?.[series.key] == null ? 'unavailable' : `${latest[series.key].toFixed(1)}°`}`).join(' · ');
    summary.textContent = !hasAngles ? latest ? 'No reliable angles yet. Keep your whole body visible in a steady side view. Missing measurements are not zero.' : 'Your graph starts when tracking finds you. Stand side-on with your whole body visible.'
      : `${stopped ? 'Stopped · retained' : 'Last analyzed'} sample ${(end / 1000).toFixed(2)} s · ${values || 'Choose an angle trace below.'}`;
    const describeRep = rep => `Bottom at ${(rep.timestampMs/1000).toFixed(2)} s · Knee bend ${rep.knee === null ? 'unavailable' : `${rep.knee.toFixed(1)}°`} · Down ${((rep.timestampMs-rep.startMs)/1000).toFixed(2)} s · Return ${((rep.endMs-rep.timestampMs)/1000).toFixed(2)} s · Total ${((rep.endMs-rep.startMs)/1000).toFixed(2)} s`;
    repSummary.hidden = !hasAngles;
    repSummary.textContent = latestRep ? `Last completed rep: ${describeRep(latestRep)}` : 'Complete a rep to see your depth and down/return timing. No AI is needed.';
    repList.replaceChildren();
    for (const rep of reps.filter(rep => rep.reference)) { const item = document.createElement('li'); item.textContent = describeRep(rep.reference); repList.append(item); }
    renderBaseline();
    renderNormalized();
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
        baselineReset = currentEpoch !== null; currentEpoch = epoch; baseline = null; latestRep = null; curveReference = null; curveLatest = null;
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
        if (curveReference && curveReference.provenance !== reference.provenance) { curveReference = null; curveLatest = null; }
        if (!baseline || baseline.provenance !== reference.provenance) { baselineReset = baseline !== null; baseline = reference; latestRep = reference; }
        else if (reference.timestampMs > latestRep.timestampMs) latestRep = reference;
        const curve = createRepReference(event);
        if (curve) {
          if (!curveReference || curveReference.provenance !== curve.provenance) curveReference = curve;
          if (!curveLatest || curveLatest.provenance !== curve.provenance || curve.bottomMs > curveLatest.bottomMs) curveLatest = curve;
        }
      }
      reps.push({ key: event.key, timestampMs, epoch: event.epoch, reference }); prune(); requestRender();
    },
    reset() { clearTimeout(timer); timer = null; samples = []; reps = []; stopped = false; currentEpoch = null; baseline = null; latestRep = null; baselineReset = false; curveReference = null; curveLatest = null; render(); },
    stop() { stopped = true; clearTimeout(timer); timer = null; render(); },
  };
}
