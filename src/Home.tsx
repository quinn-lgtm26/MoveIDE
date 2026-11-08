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
    </div>
  );
}
