import { useRef, useState } from 'react';
import { useTicker, Segmented, Slider } from './useTicker.jsx';

const KEYS = 'ABCDEFGHIJKLMNOPQRST'.split('');
const CACHE_MS = 1;
const DB_MS = 60;

// Zipf-like sampling: key i has weight 1/(i+1)^s.
function sample(skew) {
  const w = KEYS.map((_, i) => 1 / (i + 1) ** skew);
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) return KEYS[i];
  return KEYS[KEYS.length - 1];
}

export default function CacheSim() {
  const [capacity, setCapacity] = useState(5);
  const [policy, setPolicy] = useState('LRU');
  const [skew, setSkew] = useState(1.1);
  const [rate, setRate] = useState(4);
  const [auto, setAuto] = useState(true);
  const sim = useRef({ slots: [], clock: 0, acc: 0, history: [], last: null, series: [] });

  const request = (key) => {
    const s = sim.current;
    s.clock++;
    const hit = s.slots.find((e) => e.key === key);
    let evicted = null;
    if (hit) {
      hit.lastUsed = s.clock;
      hit.freq++;
    } else {
      if (s.slots.length >= capacity) {
        const victim =
          policy === 'LRU' ? s.slots.reduce((a, b) => (b.lastUsed < a.lastUsed ? b : a))
          : policy === 'LFU' ? s.slots.reduce((a, b) => (b.freq < a.freq || (b.freq === a.freq && b.lastUsed < a.lastUsed) ? b : a))
          : s.slots.reduce((a, b) => (b.added < a.added ? b : a));
        evicted = victim.key;
        s.slots = s.slots.filter((e) => e !== victim);
      }
      s.slots.push({ key, lastUsed: s.clock, freq: 1, added: s.clock });
    }
    s.history.push(!!hit);
    if (s.history.length > 100) s.history.shift();
    s.last = { key, hit: !!hit, evicted, t: performance.now() };
  };

  useTicker((now, dt) => {
    const s = sim.current;
    while (s.slots.length > capacity) s.slots.shift();
    if (auto) {
      s.acc += (rate * dt) / 1000;
      while (s.acc >= 1) {
        s.acc -= 1;
        request(sample(skew));
      }
    }
    if (!s.lastSample || now - s.lastSample > 500) {
      s.lastSample = now;
      const h = s.history.length ? s.history.filter(Boolean).length / s.history.length : 0;
      s.series.push(h);
      if (s.series.length > 60) s.series.shift();
    }
  });

  const s = sim.current;
  const hitRate = s.history.length ? s.history.filter(Boolean).length / s.history.length : 0;
  const avgLatency = hitRate * CACHE_MS + (1 - hitRate) * (CACHE_MS + DB_MS);
  const flash = s.last && performance.now() - s.last.t < 450;
  const spark = s.series.map((v, i) => `${(i / 59) * 300},${60 - v * 56}`).join(' ');
  const maxFreq = Math.max(1, ...s.slots.map((e) => e.freq));

  return (
    <div className="sim">
      <div className="sim-controls">
        <Segmented options={['LRU', 'LFU', 'FIFO'].map((p) => ({ value: p, label: p }))} value={policy} onChange={setPolicy} />
        <Slider label="Cache capacity" value={capacity} min={1} max={12} onChange={setCapacity} fmt={(v) => `${v} of ${KEYS.length} keys`} />
        <Slider label="Popularity skew" value={skew} min={0} max={2} step={0.1} onChange={setSkew} fmt={(v) => (v < 0.3 ? 'uniform' : v < 1.2 ? 'moderate' : 'very skewed')} />
        <Slider label="Traffic" value={rate} min={1} max={20} onChange={setRate} fmt={(v) => `${v} req/s`} />
        <button className={`btn ${auto ? '' : 'ghost'}`} onClick={() => setAuto((a) => !a)}>{auto ? '❚❚ Pause traffic' : '▶ Auto traffic'}</button>
      </div>

      <div className="sim-body">
        <div className="cache-stage">
          <div className="cache-lane">
            <div className="lane-label">Request</div>
            <div className={`req-bubble ${flash ? (s.last.hit ? 'hit' : 'miss') : ''}`}>
              {s.last ? s.last.key : '—'}
              {flash && <em>{s.last.hit ? `HIT · ${CACHE_MS} ms` : `MISS · ${DB_MS} ms from DB`}</em>}
            </div>
          </div>
          <div className="cache-lane">
            <div className="lane-label">Cache ({policy})</div>
            <div className="slots">
              {Array.from({ length: capacity }, (_, i) => {
                const e = [...s.slots].sort((a, b) => b.lastUsed - a.lastUsed)[i];
                const isLast = e && s.last?.key === e.key && flash;
                return (
                  <div key={i} className={`slot ${e ? 'full' : ''} ${isLast ? (s.last.hit ? 'hit' : 'new') : ''}`}>
                    {e ? (
                      <>
                        <b>{e.key}</b>
                        <span>{policy === 'LFU' ? `×${e.freq}` : policy === 'FIFO' ? `#${e.added}` : `t${e.lastUsed}`}</span>
                        <i style={{ width: `${(e.freq / maxFreq) * 100}%` }} />
                      </>
                    ) : (
                      <span>empty</span>
                    )}
                  </div>
                );
              })}
            </div>
            {flash && s.last.evicted && <div className="evicted">evicted <b>{s.last.evicted}</b></div>}
          </div>
          <div className="cache-lane">
            <div className="lane-label">Request a key manually</div>
            <div className="key-pad">
              {KEYS.map((k) => (
                <button key={k} onClick={() => request(k)} className={s.slots.some((e) => e.key === k) ? 'cached' : ''}>{k}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="sim-side">
          <div className="stat-grid two">
            <div><span>Hit rate (last 100)</span><b className={hitRate > 0.7 ? 'good' : hitRate < 0.4 ? 'bad' : ''}>{Math.round(hitRate * 100)}%</b></div>
            <div><span>Average latency</span><b>{avgLatency.toFixed(1)} ms</b></div>
          </div>
          <svg viewBox="0 0 300 64" className="spark">
            <polyline points={spark} />
          </svg>
          <p className="sim-tip">
            <b>Try this:</b> with skewed popularity, a cache holding just 25% of keys gets a high hit rate — that’s the 80/20 rule. Set skew to <i>uniform</i> and the hit rate collapses to roughly capacity ÷ keys. LFU shines when popularity is stable; LRU adapts faster when it shifts.
          </p>
        </div>
      </div>
    </div>
  );
}
