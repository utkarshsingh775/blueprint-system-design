import { useMemo, useRef, useState, useEffect } from 'react';
import { Slider, fnv } from './useTicker.jsx';

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLORS = ['#5ee1ff', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#60a5fa', '#f87171'];
const KEYS = Array.from({ length: 72 }, (_, i) => `user:${i * 37 + 11}`);
const MAX = 2 ** 32;

function ringFor(servers, vnodes) {
  const points = [];
  for (const s of servers) for (let v = 0; v < vnodes; v++) points.push({ server: s, pos: fnv(`${s}#${v}`) });
  return points.sort((a, b) => a.pos - b.pos);
}
function ownerOnRing(ring, pos) {
  for (const p of ring) if (p.pos >= pos) return p.server;
  return ring[0]?.server;
}

export default function HashingSim() {
  const [servers, setServers] = useState(['A', 'B', 'C', 'D']);
  const [vnodes, setVnodes] = useState(1);
  const [mode, setMode] = useState('ring');
  const prev = useRef(null);
  const [moved, setMoved] = useState({ ring: null, mod: null, keys: new Set() });

  const ring = useMemo(() => ringFor(servers, vnodes), [servers, vnodes]);
  const assign = useMemo(() => {
    const byRing = {};
    const byMod = {};
    for (const k of KEYS) {
      const h = fnv(k);
      byRing[k] = ownerOnRing(ring, h);
      byMod[k] = servers[h % servers.length];
    }
    return { byRing, byMod };
  }, [ring, servers]);

  useEffect(() => {
    const p = prev.current;
    if (p && p.servers.length !== servers.length) {
      const ringMoved = KEYS.filter((k) => p.byRing[k] !== assign.byRing[k]);
      const modMoved = KEYS.filter((k) => p.byMod[k] !== assign.byMod[k]);
      setMoved({ ring: ringMoved.length, mod: modMoved.length, keys: new Set(mode === 'ring' ? ringMoved : modMoved) });
      const t = setTimeout(() => setMoved((m) => ({ ...m, keys: new Set() })), 1800);
      prev.current = { servers, ...assign };
      return () => clearTimeout(t);
    }
    prev.current = { servers, ...assign };
  }, [assign]);

  const owner = mode === 'ring' ? assign.byRing : assign.byMod;
  const counts = Object.fromEntries(servers.map((s) => [s, 0]));
  for (const k of KEYS) counts[owner[k]]++;
  const maxCount = Math.max(...Object.values(counts), 1);
  const ideal = KEYS.length / servers.length;
  const imbalance = Math.max(...Object.values(counts)) / ideal;

  const R = 150;
  const C = 190;
  const at = (pos, r = R) => {
    const a = (pos / MAX) * Math.PI * 2 - Math.PI / 2;
    return [C + Math.cos(a) * r, C + Math.sin(a) * r];
  };
  const color = (s) => COLORS[NAMES.indexOf(s)];

  // Arcs owned by each ring point: from the previous point up to this one.
  const arcs = ring.map((p, i) => {
    const start = i === 0 ? ring[ring.length - 1].pos - MAX : ring[i - 1].pos;
    return { server: p.server, start, end: p.pos };
  });
  const arcPath = (a) => {
    const [x1, y1] = at(((a.start % MAX) + MAX) % MAX, R + 16);
    const [x2, y2] = at(a.end, R + 16);
    const large = a.end - a.start > MAX / 2 ? 1 : 0;
    return `M${x1},${y1} A${R + 16},${R + 16} 0 ${large} 1 ${x2},${y2}`;
  };

  return (
    <div className="sim">
      <div className="sim-controls">
        <div className="seg">
          <button className={mode === 'ring' ? 'on' : ''} onClick={() => setMode('ring')}>Consistent hashing</button>
          <button className={mode === 'mod' ? 'on' : ''} onClick={() => setMode('mod')}>hash(key) % N</button>
        </div>
        {mode === 'ring' && <Slider label="Virtual nodes per server" value={vnodes} min={1} max={60} onChange={setVnodes} />}
        <div className="btn-row">
          <button className="btn" disabled={servers.length >= NAMES.length} onClick={() => setServers((s) => [...s, NAMES.find((n) => !s.includes(n))])}>+ Add server</button>
          <button className="btn ghost" disabled={servers.length <= 2} onClick={() => setServers((s) => s.slice(0, -1))}>− Remove server</button>
        </div>
      </div>

      <div className="sim-body">
        <svg viewBox="0 0 380 380" className="sim-svg ring">
          <circle cx={C} cy={C} r={R} className="ring-base" />
          {mode === 'ring' && arcs.map((a, i) => <path key={i} d={arcPath(a)} stroke={color(a.server)} className="ring-arc" />)}
          {KEYS.map((k) => {
            const [x, y] = at(fnv(k), R - 22);
            const hot = moved.keys.has(k);
            return <circle key={k} cx={x} cy={y} r={hot ? 6 : 3.6} fill={color(owner[k])} className={hot ? 'key moved' : 'key'}><title>{`${k} → ${owner[k]}`}</title></circle>;
          })}
          {mode === 'ring' &&
            ring.map((p, i) => {
              const [x, y] = at(p.pos);
              return vnodes > 8 ? (
                <circle key={i} cx={x} cy={y} r="3" fill={color(p.server)} />
              ) : (
                <g key={i} transform={`translate(${x},${y})`}>
                  <circle r="12" fill="#0b1222" stroke={color(p.server)} strokeWidth="2" />
                  <text textAnchor="middle" y="4" className="ring-label" fill={color(p.server)}>{p.server}</text>
                </g>
              );
            })}
          <text x={C} y={C - 6} textAnchor="middle" className="ring-center">{KEYS.length} keys</text>
          <text x={C} y={C + 14} textAnchor="middle" className="ring-center sub">{servers.length} servers</text>
        </svg>

        <div className="sim-side">
          <div className="stat-grid two">
            <div><span>Keys moved (ring)</span><b className="good">{moved.ring == null ? '—' : `${moved.ring} (${Math.round((moved.ring / KEYS.length) * 100)}%)`}</b></div>
            <div><span>Keys moved (% N)</span><b className="bad">{moved.mod == null ? '—' : `${moved.mod} (${Math.round((moved.mod / KEYS.length) * 100)}%)`}</b></div>
          </div>
          <h5 className="sim-h">Keys per server <em>max is {imbalance.toFixed(2)}× the ideal</em></h5>
          <div className="bars">
            {servers.map((s) => (
              <div key={s} className="bar-row">
                <span style={{ color: color(s) }}>{s}</span>
                <div><i style={{ width: `${(counts[s] / maxCount) * 100}%`, background: color(s) }} /></div>
                <b>{counts[s]}</b>
              </div>
            ))}
          </div>
          <p className="sim-tip">
            <b>Try this:</b> add a server. With <i>% N</i> most keys change owner (a cache would be almost entirely flushed). On the ring, only the keys in the new server’s arc move. Then raise <i>virtual nodes</i> and watch the load bars even out.
          </p>
        </div>
      </div>
    </div>
  );
}
