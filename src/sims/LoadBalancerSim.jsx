import { useRef, useState } from 'react';
import { useTicker, Segmented, Slider, fnv } from './useTicker.jsx';

const ALGOS = [
  { value: 'rr', label: 'Round robin', hint: 'Each server in turn' },
  { value: 'least', label: 'Least connections', hint: 'Fewest in-flight requests' },
  { value: 'p2c', label: 'Power of two', hint: 'Pick 2 at random, use the less busy' },
  { value: 'hash', label: 'IP hash', hint: 'Same client → same server' },
  { value: 'random', label: 'Random' },
];
const TRAVEL = 450;
const BASE_MS = 500;
const COLORS = ['#5ee1ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c'];

const makeServer = (i) => ({ id: i, alive: true, slow: false, served: 0, latencies: [] });

export default function LoadBalancerSim() {
  const [algo, setAlgo] = useState('rr');
  const [rps, setRps] = useState(8);
  const [servers, setServers] = useState(() => [0, 1, 2, 3].map(makeServer));
  const sim = useRef({ reqs: [], rr: 0, acc: 0, seq: 0, dropped: 0, recent: [] });

  const pick = (s, clientId) => {
    const alive = servers.filter((x) => x.alive);
    if (!alive.length) return null;
    const load = (srv) => s.reqs.filter((r) => r.server === srv.id && !r.done).length;
    if (algo === 'rr') return alive[s.rr++ % alive.length];
    if (algo === 'random') return alive[Math.floor(Math.random() * alive.length)];
    if (algo === 'least') return alive.reduce((a, b) => (load(b) < load(a) ? b : a));
    if (algo === 'p2c') {
      const a = alive[Math.floor(Math.random() * alive.length)];
      const b = alive[Math.floor(Math.random() * alive.length)];
      return load(b) < load(a) ? b : a;
    }
    const all = servers;
    let i = fnv(`client-${clientId}`) % all.length;
    for (let k = 0; k < all.length && !all[i].alive; k++) i = (i + 1) % all.length;
    return all[i];
  };

  useTicker((now, dt) => {
    const s = sim.current;
    s.acc += (rps * dt) / 1000;
    while (s.acc >= 1) {
      s.acc -= 1;
      const client = Math.floor(Math.random() * 24);
      const srv = pick(s, client);
      if (!srv) {
        s.dropped++;
        continue;
      }
      const inflight = s.reqs.filter((r) => r.server === srv.id && !r.done).length;
      const cost = BASE_MS * (0.6 + Math.random() * 0.8) * (srv.slow ? 4 : 1) * (1 + inflight * 0.35);
      s.reqs.push({ id: s.seq++, server: srv.id, client, t0: now, end: now + TRAVEL + cost, done: false });
    }
    for (const r of s.reqs) {
      if (!r.done && now >= r.end) {
        r.done = true;
        const srv = servers.find((x) => x.id === r.server);
        if (srv) {
          srv.served++;
          srv.latencies.push(r.end - r.t0);
          if (srv.latencies.length > 30) srv.latencies.shift();
        }
        s.recent.push(r.end - r.t0);
        if (s.recent.length > 120) s.recent.shift();
      }
      const srv = servers.find((x) => x.id === r.server);
      if (!r.done && (!srv || !srv.alive)) {
        r.done = true;
        s.dropped++;
      }
    }
    s.reqs = s.reqs.filter((r) => !r.done || now - r.end < 50);
  });

  const now = performance.now();
  const s = sim.current;
  const H = 70 + servers.length * 70;
  const serverY = (i) => 50 + i * 70;
  const lbY = H / 2;
  const sorted = [...s.recent].sort((a, b) => a - b);
  const p = (q) => (sorted.length ? Math.round(sorted[Math.floor(q * (sorted.length - 1))]) : 0);

  const update = (id, patch) => setServers((list) => list.map((x) => (x.id === id ? Object.assign(x, patch) : x)));

  return (
    <div className="sim">
      <div className="sim-controls">
        <Segmented options={ALGOS} value={algo} onChange={setAlgo} />
        <Slider label="Traffic" value={rps} min={1} max={30} onChange={setRps} fmt={(v) => `${v} req/s`} />
        <div className="btn-row">
          <button className="btn ghost" disabled={servers.length >= 6} onClick={() => setServers((l) => [...l, makeServer(Math.max(...l.map((x) => x.id)) + 1)])}>+ Server</button>
          <button className="btn ghost" disabled={servers.length <= 2} onClick={() => setServers((l) => l.slice(0, -1))}>− Server</button>
        </div>
      </div>

      <div className="sim-body">
        <svg viewBox={`0 0 640 ${H}`} className="sim-svg">
          <g transform={`translate(70,${lbY})`}>
            <rect x="-48" y="-26" width="96" height="52" rx="12" className="sim-node" style={{ '--c': '#5ee1ff' }} />
            <text textAnchor="middle" y="5" className="sim-label">Load balancer</text>
          </g>
          {servers.map((srv, i) => {
            const y = serverY(i);
            const active = s.reqs.filter((r) => r.server === srv.id && !r.done && now - r.t0 >= TRAVEL).length;
            const avg = srv.latencies.length ? Math.round(srv.latencies.reduce((a, b) => a + b, 0) / srv.latencies.length) : 0;
            const c = COLORS[i % COLORS.length];
            return (
              <g key={srv.id}>
                <line x1="118" y1={lbY} x2="440" y2={y} className="sim-wire" />
                <g transform={`translate(520,${y})`} className={srv.alive ? '' : 'dead'}>
                  <rect x="-80" y="-26" width="160" height="52" rx="12" className="sim-node" style={{ '--c': srv.alive ? c : '#64748b' }} />
                  <text x="-66" y="-6" className="sim-label">Server {srv.id + 1}{srv.slow ? ' 🐢' : ''}</text>
                  <text x="-66" y="12" className="sim-sub">{srv.alive ? `${srv.served} served · ${avg} ms avg` : 'DOWN — ejected by health check'}</text>
                  <rect x="-66" y="18" width="132" height="3" rx="1.5" fill="rgba(255,255,255,0.08)" />
                  <rect x="-66" y="18" width={Math.min(132, active * 22)} height="3" rx="1.5" fill={active > 4 ? '#fb7185' : c} />
                </g>
              </g>
            );
          })}
          {s.reqs.map((r) => {
            const t = (now - r.t0) / TRAVEL;
            if (t > 1 || r.done) return null;
            const i = servers.findIndex((x) => x.id === r.server);
            if (i < 0) return null;
            const x = 118 + (440 - 118) * t;
            const y = lbY + (serverY(i) - lbY) * t;
            return <circle key={r.id} cx={x} cy={y} r="4.5" fill={algo === 'hash' ? `hsl(${(r.client * 47) % 360} 80% 65%)` : COLORS[i % COLORS.length]} className="sim-dot" />;
          })}
        </svg>

        <div className="sim-side">
          <div className="stat-grid">
            <div><span>p50 latency</span><b>{p(0.5)} ms</b></div>
            <div><span>p95 latency</span><b className={p(0.95) > 2000 ? 'bad' : ''}>{p(0.95)} ms</b></div>
            <div><span>Dropped</span><b className={s.dropped ? 'bad' : ''}>{s.dropped}</b></div>
          </div>
          <div className="server-toggles">
            {servers.map((srv, i) => (
              <div key={srv.id} className="toggle-row">
                <span style={{ color: COLORS[i % COLORS.length] }}>Server {srv.id + 1}</span>
                <button className={`chip-btn ${srv.slow ? 'on warn' : ''}`} onClick={() => update(srv.id, { slow: !srv.slow })}>Slow</button>
                <button className={`chip-btn ${!srv.alive ? 'on bad' : ''}`} onClick={() => update(srv.id, { alive: !srv.alive })}>{srv.alive ? 'Kill' : 'Revive'}</button>
              </div>
            ))}
          </div>
          <p className="sim-tip">
            <b>Try this:</b> make one server slow. Round robin keeps feeding it, so its queue and the p95 grow. Switch to <i>least connections</i> or <i>power of two</i> and watch traffic route around it. With <i>IP hash</i>, each client (colour) sticks to one server.
          </p>
        </div>
      </div>
    </div>
  );
}
