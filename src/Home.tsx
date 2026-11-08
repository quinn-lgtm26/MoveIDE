// Real output of Compare examples, rep 1 (ms from rep start, knee bend °). Rerun the compare view to refresh.
const good = [[0,26],[67,33],[134,41],[200,52],[266,62],[334,74],[400,83],[467,98],[534,106],[600,114],[667,116],[734,117],[800,115],[867,114],[934,108],[1000,92],[1067,85],[1134,64],[1200,56],[1267,48],[1334,32],[1400,24]];
const bad = [[0,29],[67,42],[133,56],[200,61],[267,72],[333,83],[400,106],[467,114],[533,122],[600,127],[667,127],[733,123],[800,112],[867,101],[933,89],[1000,80],[1067,72],[1133,57],[1200,44],[1267,30]];
const W = 600, H = 240, L = 36, B = 24, x = (ms: number) => L + (ms / 1400) * (W - L - 8), y = (deg: number) => H - B - (deg / 140) * (H - B - 8);
const line = (pts: number[][]) => pts.map(([t, d], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(d).toFixed(1)}`).join('');

export function Home({ onSample, onCompare }: { onSample: () => void; onCompare: () => void }) {
  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-copy">
          <h1 id="home-title">Measure every squat rep from a phone video.</h1>
          <p className="subhead">Knee bend, torso lean and rep time.</p>
          <div className="toolbar">
            <button className="primary" onClick={onSample}>Try a sample squat</button>
            <button onClick={onCompare}>Compare examples</button>
          </div>
          <p className="start-disclosure">Free, <a href="https://github.com/quinn-lgtm26/MoveIDE">open source</a> and runs on this device. Not a medical device.</p>
        </div>
        <figure className="home-shot">
          <img src="/home-compare.jpg" width="1304" height="524" alt="Two sample squats side by side with joint lines drawn over each lifter, both paused at the bottom of rep 2." />
        </figure>
      </section>
      <section className="home-data" aria-labelledby="home-data-title">
        <h2 id="home-data-title">Good vs bad squat, measured</h2>
        <figure className="home-graph">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Knee bend over one rep: the good example peaks at 117°, the bad example at 127°.">
            {[0, 45, 90, 135].map((d) => <g key={d}><line x1={L} x2={W - 8} y1={y(d)} y2={y(d)} className="grid" /><text x={L - 6} y={y(d) + 4} textAnchor="end">{d}°</text></g>)}
            {[0, 0.5, 1].map((s) => <text key={s} x={x(s * 1000)} y={H - 6} textAnchor="middle">{s} s</text>)}
            <path d={line(good)} className="good" />
            <path d={line(bad)} className="bad" />
          </svg>
          <figcaption>Knee bend through rep 1: <span className="good">— Good example</span>, <span className="bad">- - Bad example</span>.</figcaption>
        </figure>
        <div className="home-angles">
        <table>
          <thead><tr><th>Joint angle</th><th>Good</th><th>Bad</th><th>Difference</th></tr></thead>
          <tbody>
            <tr><td>Knee bend at bottom</td><td>117°</td><td>127°</td><td>+10°</td></tr>
            <tr><td>Chest angle at bottom</td><td>41°</td><td>46°</td><td>+5°</td></tr>
            <tr><td>Rep time</td><td>1.4 s</td><td>1.3 s</td><td>−0.1 s</td></tr>
          </tbody>
        </table>
        <p className="home-note">Good and bad labels come from the public dataset, not from MoveIDE.</p>
        </div>
      </section>
    </div>
  );
}
