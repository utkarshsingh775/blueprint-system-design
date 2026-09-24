import { useRef, useState } from 'react';
import { useTicker, Segmented, Slider } from './useTicker.jsx';

const SPAN = 15000;
const WINDOW = 5000;

export default function RateLimiterSim() {
  const [algo, setAlgo] = useState('token');
  const [limit, setLimit] = useState(5);
  const [refill, setRefill] = useState(1);
  const [auto, setAuto] = useState(0);
  const sim = useRef({ tokens: 5, events: [], acc: 0, lastRefill: performance.now() });

  const allow = (now) => {
    const s = sim.current;
    if (algo === 'token') {
      if (s.tokens >= 1) {
        s.tokens -= 1;
        return true;
      }
      return false;
    }
    if (algo === 'fixed') {
      const start = Math.floor(now / WINDOW) * WINDOW;
      return s.events.filter((e) => e.ok && e.t >= start).length < limit;
    }
    return s.events.filter((e) => e.ok && e.t > now - WINDOW).length < limit;
  };

  const send = (n = 1) => {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const t = now + i * 25;
      sim.current.events.push({ t, ok: allow(t) });
    }
  };

  useTicker((now, dt) => {
    const s = sim.current;
    s.tokens = Math.min(limit, s.tokens + (refill * dt) / 1000);
    if (auto) {
      s.acc += (auto * dt) / 1000;
      while (s.acc >= 1) {
        s.acc -= 1;
        s.events.push({ t: now, ok: allow(now) });
      }
    }
    s.events = s.events.filter((e) => now - e.t < SPAN);
  });

  const now = performance.now();
  const s = sim.current;
  const x = (t) => 600 - ((now - t) / SPAN) * 600;
  const accepted = s.events.filter((e) => e.ok).length;
  const rejected = s.events.length - accepted;
  const windows = [];
  if (algo === 'fixed') for (let w = Math.floor((now - SPAN) / WINDOW) * WINDOW; w < now; w += WINDOW) windows.push(w);

  const switchAlgo = (a) => {
    setAlgo(a);
    sim.current.tokens = limit;
  };

  return (
    <div className="sim">
      <div className="sim-controls">
        <Segmented
          options={[
            { value: 'token', label: 'Token bucket' },
            { value: 'fixed', label: 'Fixed window' },
            { value: 'sliding', label: 'Sliding window' },
          ]}
          value={algo}
          onChange={switchAlgo}
        />
        <Slider label={algo === 'token' ? 'Bucket capacity' : 'Limit per 5 s'} value={limit} min={1} max={15} onChange={setLimit} />
        {algo === 'token' && <Slider label="Refill rate" value={refill} min={0.2} max={5} step={0.2} onChange={setRefill} fmt={(v) => `${v.toFixed(1)} tokens/s`} />}
        <Slider label="Steady traffic" value={auto} min={0} max={10} onChange={setAuto} fmt={(v) => (v ? `${v} req/s` : 'off')} />
        <div className="btn-row">
          <button className="btn" onClick={() => send(1)}>Send 1</button>
          <button className="btn ghost" onClick={() => send(10)}>Burst ×10</button>
        </div>
      </div>

      <div className="sim-body column">
        <div className="rl-top">
          {algo === 'token' ? (
            <div className="bucket">
              <div className="bucket-fill" style={{ height: `${(s.tokens / limit) * 100}%` }} />
              <div className="bucket-tokens">
                {Array.from({ length: limit }, (_, i) => (
                  <i key={i} className={i < Math.floor(s.tokens) ? 'on' : ''} />
                ))}
              </div>
              <b>{s.tokens.toFixed(1)}</b>
              <span>tokens</span>
            </div>
          ) : (
            <div className="window-count">
              <b>{algo === 'fixed' ? s.events.filter((e) => e.ok && e.t >= Math.floor(now / WINDOW) * WINDOW).length : s.events.filter((e) => e.ok && e.t > now - WINDOW).length}</b>
              <span>/ {limit} used in {algo === 'fixed' ? 'this window' : 'the last 5 s'}</span>
            </div>
          )}
          <div className="stat-grid two">
            <div><span>Accepted (15 s)</span><b className="good">{accepted}</b></div>
            <div><span>Rejected · 429</span><b className="bad">{rejected}</b></div>
          </div>
        </div>

        <svg viewBox="0 0 600 120" className="timeline-svg">
          {windows.map((w) => (
            <g key={w}>
              <rect x={x(w)} y="10" width={(WINDOW / SPAN) * 600} height="90" className="rl-window" />
              <text x={x(w) + 6} y="24" className="rl-window-label">window</text>
            </g>
          ))}
          {algo === 'sliding' && <rect x={x(now - WINDOW)} y="10" width={(WINDOW / SPAN) * 600} height="90" className="rl-window sliding" />}
          <line x1="0" y1="100" x2="600" y2="100" className="rl-axis" />
          {s.events.map((e, i) => (
            <circle key={i} cx={x(e.t)} cy={(e.ok ? 70 : 40) + (((e.t / 25) | 0) % 5) * 3 - 6} r="4.5" className={e.ok ? 'rl-ok' : 'rl-no'} />
          ))}
          <text x="4" y="115" className="rl-axis-label">15 s ago</text>
          <text x="596" y="115" textAnchor="end" className="rl-axis-label">now</text>
          <text x="596" y="44" textAnchor="end" className="rl-row-label bad">rejected</text>
          <text x="596" y="74" textAnchor="end" className="rl-row-label good">accepted</text>
        </svg>

        <p className="sim-tip">
          <b>Try this:</b> in <i>fixed window</i>, wait until just before a window ends, burst, then burst again right after it resets — you get 2× the limit in a moment. <i>Sliding window</i> closes that loophole. <i>Token bucket</i> allows bursts up to the capacity, then settles to the refill rate.
        </p>
      </div>
    </div>
  );
}
