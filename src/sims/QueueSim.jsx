import { useRef, useState } from 'react';
import { useTicker, Slider } from './useTicker.jsx';

const CAPACITY = 60;
const PER_CONSUMER = 3;

export default function QueueSim() {
  const [produce, setProduce] = useState(5);
  const [consumers, setConsumers] = useState(2);
  const [burstUntil, setBurstUntil] = useState(0);
  const sim = useRef({ queue: [], acc: 0, seq: 0, workers: [], dropped: 0, done: 0, series: [], lastSample: 0 });

  useTicker((now, dt) => {
    const s = sim.current;
    while (s.workers.length < consumers) s.workers.push({ busyUntil: 0, msg: null });
    s.workers.length = consumers;
    const rate = produce * (now < burstUntil ? 5 : 1);
    s.acc += (rate * dt) / 1000;
    while (s.acc >= 1) {
      s.acc -= 1;
      if (s.queue.length >= CAPACITY) s.dropped++;
      else s.queue.push({ id: s.seq++, t: now });
    }
    for (const w of s.workers) {
      if (w.msg && now >= w.busyUntil) {
        w.msg = null;
        s.done++;
      }
      if (!w.msg && s.queue.length) {
        w.msg = s.queue.shift();
        w.busyUntil = now + (1000 / PER_CONSUMER) * (0.7 + Math.random() * 0.6);
        w.started = now;
      }
    }
    if (now - s.lastSample > 250) {
      s.lastSample = now;
      s.series.push(s.queue.length);
      if (s.series.length > 80) s.series.shift();
    }
  });

  const now = performance.now();
  const s = sim.current;
  const bursting = now < burstUntil;
  const inRate = produce * (bursting ? 5 : 1);
  const outRate = consumers * PER_CONSUMER;
  const lag = s.queue.length ? ((now - s.queue[0].t) / 1000).toFixed(1) : '0.0';
  const spark = s.series.map((v, i) => `${(i / 79) * 300},${60 - (v / CAPACITY) * 56}`).join(' ');

  return (
    <div className="sim">
      <div className="sim-controls">
        <Slider label="Producer rate" value={produce} min={0} max={30} onChange={setProduce} fmt={(v) => `${v} msg/s`} />
        <Slider label="Consumers" value={consumers} min={0} max={10} onChange={setConsumers} fmt={(v) => `${v} × ${PER_CONSUMER} msg/s`} />
        <button className={`btn ${bursting ? 'warn' : ''}`} onClick={() => setBurstUntil(performance.now() + 4000)}>⚡ Traffic spike (5× for 4 s)</button>
      </div>

      <div className="sim-body column">
        <div className="queue-stage">
          <div className="q-producer">
            <b>Producers</b>
            <span>{inRate} msg/s</span>
          </div>
          <div className="q-buffer">
            <div className="q-fill" style={{ width: `${(s.queue.length / CAPACITY) * 100}%` }} />
            <div className="q-msgs">
              {s.queue.slice(0, CAPACITY).map((m) => (
                <i key={m.id} style={{ opacity: Math.max(0.35, 1 - (now - m.t) / 8000) }} />
              ))}
            </div>
            <span className="q-label">{s.queue.length} / {CAPACITY} queued</span>
          </div>
          <div className="q-workers">
            {s.workers.map((w, i) => (
              <div key={i} className={`q-worker ${w.msg ? 'busy' : ''}`}>
                <span>C{i + 1}</span>
                <i style={{ width: w.msg ? `${Math.min(100, ((now - w.started) / (w.busyUntil - w.started)) * 100)}%` : 0 }} />
              </div>
            ))}
            {!consumers && <div className="q-worker none">no consumers</div>}
          </div>
        </div>

        <div className="stat-grid four">
          <div><span>In</span><b>{inRate}/s</b></div>
          <div><span>Out (capacity)</span><b className={outRate < inRate ? 'bad' : 'good'}>{outRate}/s</b></div>
          <div><span>Oldest message</span><b className={lag > 5 ? 'bad' : ''}>{lag} s</b></div>
          <div><span>Dropped (queue full)</span><b className={s.dropped ? 'bad' : ''}>{s.dropped}</b></div>
        </div>
        <svg viewBox="0 0 300 64" className="spark wide"><polyline points={spark} /></svg>
        <p className="sim-tip">
          <b>Try this:</b> trigger a spike. The queue <i>absorbs</i> it — producers never notice — and drains once the spike ends. If producers outpace consumers for long, depth and lag grow until the queue fills and messages are dropped (or producers must be throttled: <b>backpressure</b>). Autoscaling consumers on queue depth fixes it.
        </p>
      </div>
    </div>
  );
}
