import { useRef, useState } from 'react';
import { useTicker, Segmented, Slider } from './useTicker.jsx';

const POS = { L: [270, 70], F1: [110, 215], F2: [430, 215], client: [270, 300] };
const NAMES = { L: 'Leader', F1: 'Follower 1', F2: 'Follower 2' };

export default function ReplicationSim() {
  const [mode, setMode] = useState('async');
  const [lag, setLag] = useState(1500);
  const [cap, setCap] = useState('CP');
  const [partition, setPartition] = useState(false);
  const [side, setSide] = useState('majority');
  const [, bump] = useState(0);
  const sim = useRef({
    nodes: { L: { v: 'v0', ver: 0, ts: 0 }, F1: { v: 'v0', ver: 0, ts: 0 }, F2: { v: 'v0', ver: 0, ts: 0 } },
    msgs: [],
    pendingF2: [],
    log: [],
    seq: 0,
    counter: 0,
    flash: {},
  });

  const log = (text, kind = 'info') => {
    const s = sim.current;
    s.log.unshift({ id: s.seq++, text, kind });
    s.log = s.log.slice(0, 7);
    bump((n) => n + 1);
  };
  const send = (from, to, dur, onArrive) => sim.current.msgs.push({ id: sim.current.seq++, from, to, t0: performance.now(), dur: Math.max(350, dur), onArrive });
  const apply = (node, entry) => {
    const n = sim.current.nodes[node];
    if (entry.ts >= n.ts) Object.assign(n, entry);
    sim.current.flash[node] = performance.now();
  };

  const write = () => {
    const s = sim.current;
    const value = `v${++s.counter}`;
    const entry = { v: value, ver: s.counter, ts: Date.now() };
    if (partition && side === 'minority') {
      if (cap === 'CP') {
        send('client', 'F2', 350, () => log(`✗ Write ${value} rejected — Follower 2 can’t reach a majority. CP chooses consistency: unavailable.`, 'bad'));
      } else {
        send('client', 'F2', 350, () => {
          apply('F2', { ...entry, diverged: true });
          log(`⚠ Write ${value} accepted by Follower 2 alone. AP stays available — but the replicas have now diverged.`, 'warn');
        });
      }
      return;
    }
    send('client', 'L', 350, () => {
      apply('L', entry);
      let acks = 1;
      const needed = 2;
      let acked = false;
      const ack = () => {
        if (acked) return;
        acked = true;
        send('L', 'client', 350, () => log(`✓ ${value} acknowledged ${mode === 'sync' ? 'after a majority stored it' : 'immediately (async)'}.`, 'good'));
      };
      if (mode === 'async') ack();
      for (const f of ['F1', 'F2']) {
        if (partition && f === 'F2') {
          s.pendingF2.push(entry);
          continue;
        }
        send('L', f, lag, () => {
          apply(f, entry);
          if (mode === 'sync' && ++acks >= needed) send(f, 'L', 350, ack);
        });
      }
    });
  };

  const read = (node) => {
    const s = sim.current;
    const reachable = !partition || (side === 'minority' ? node === 'F2' : node !== 'F2');
    if (!reachable) {
      log(`✗ Can’t reach ${NAMES[node]} across the partition.`, 'bad');
      return;
    }
    if (partition && side === 'minority' && cap === 'CP') {
      send('client', node, 350, () => log('✗ Read rejected — without a majority, Follower 2 can’t prove its data is current (CP).', 'bad'));
      return;
    }
    send('client', node, 350, () => {
      const n = s.nodes[node];
      const latest = Math.max(...Object.values(s.nodes).map((x) => x.ver));
      send(node, 'client', 350, () =>
        n.ver < s.nodes.L.ver || (n.diverged && node === 'F2')
          ? log(`⚠ ${NAMES[node]} returned ${n.v} — stale! The leader has ${s.nodes.L.v}.`, 'warn')
          : log(`✓ ${NAMES[node]} returned ${n.v}${n.ver === latest ? ' (latest)' : ''}.`, 'good')
      );
    });
  };

  const togglePartition = () => {
    const s = sim.current;
    if (!partition) {
      setPartition(true);
      log('✂ Network partition: Follower 2 is cut off from the Leader and Follower 1.', 'warn');
      return;
    }
    setPartition(false);
    setSide('majority');
    const f2 = s.nodes.F2;
    const lostWrite = f2.diverged ? f2.v : null;
    log('⟲ Partition healed. Replaying missed replication to Follower 2…', 'info');
    const pending = s.pendingF2.splice(0);
    const latest = pending[pending.length - 1];
    if (lostWrite) {
      const winner = latest && latest.ts > f2.ts ? latest : null;
      send('L', 'F2', lag, () => {
        if (winner) {
          apply('F2', { ...winner, diverged: false });
          log(`⚖ Conflict: F2’s ${lostWrite} vs the Leader’s ${winner.v}. Last-write-wins keeps ${winner.v}; ${lostWrite} is silently lost.`, 'warn');
        } else {
          const w = { v: f2.v, ver: ++s.counter, ts: Date.now() };
          f2.diverged = false;
          for (const n of ['L', 'F1']) apply(n, w);
          log(`⚖ Conflict: F2’s ${lostWrite} was newest, so last-write-wins propagates it everywhere.`, 'warn');
        }
      });
    } else if (latest) {
      send('L', 'F2', lag, () => {
        apply('F2', latest);
        log(`✓ Follower 2 caught up to ${latest.v}.`, 'good');
      });
    }
  };

  useTicker((now) => {
    const s = sim.current;
    const arrived = s.msgs.filter((m) => now - m.t0 >= m.dur);
    s.msgs = s.msgs.filter((m) => now - m.t0 < m.dur);
    arrived.forEach((m) => m.onArrive?.());
  });

  const now = performance.now();
  const s = sim.current;
  const latestVer = s.nodes.L.ver;
  const edge = (a, b, cut) => <line x1={POS[a][0]} y1={POS[a][1]} x2={POS[b][0]} y2={POS[b][1]} className={`rep-link ${cut ? 'cut' : ''}`} />;
  const clientTarget = partition && side === 'minority' ? 'F2' : 'L';

  return (
    <div className="sim">
      <div className="sim-controls">
        <Segmented options={[{ value: 'async', label: 'Async replication' }, { value: 'sync', label: 'Sync (quorum)' }]} value={mode} onChange={setMode} />
        <Slider label="Replication lag" value={lag} min={0} max={4000} step={100} onChange={setLag} fmt={(v) => `${v} ms`} />
        <Segmented options={[{ value: 'CP', label: 'CP: consistency' }, { value: 'AP', label: 'AP: availability' }]} value={cap} onChange={setCap} />
        <div className="btn-row">
          <button className={`btn ${partition ? 'bad' : 'ghost'}`} onClick={togglePartition}>{partition ? '⟲ Heal partition' : '✂ Partition network'}</button>
          {partition && (
            <button className="btn ghost" onClick={() => setSide((x) => (x === 'majority' ? 'minority' : 'majority'))}>
              Client on {side === 'majority' ? 'majority' : 'minority'} side ⇄
            </button>
          )}
        </div>
      </div>

      <div className="sim-body">
        <svg viewBox="0 0 540 340" className="sim-svg">
          {edge('L', 'F1')}
          {edge('L', 'F2', partition)}
          {edge('F1', 'F2', partition)}
          {partition && <line x1="330" y1="20" x2="330" y2="330" className="rep-wall" />}
          <line x1={POS.client[0]} y1={POS.client[1]} x2={POS[clientTarget][0]} y2={POS[clientTarget][1]} className="rep-client-link" />
          {Object.entries(s.nodes).map(([id, n]) => {
            const [x, y] = POS[id];
            const stale = n.ver < latestVer;
            const flashing = now - (s.flash[id] || 0) < 500;
            return (
              <g key={id} transform={`translate(${x},${y})`} className={`rep-node ${stale ? 'stale' : ''} ${n.diverged ? 'diverged' : ''} ${flashing ? 'flash' : ''}`}>
                <circle r="44" />
                <text y="-12" textAnchor="middle" className="rep-name">{NAMES[id]}</text>
                <text y="14" textAnchor="middle" className="rep-value">{n.v}</text>
                <text y="30" textAnchor="middle" className="rep-sub">{n.diverged ? 'diverged' : stale ? 'stale' : 'up to date'}</text>
              </g>
            );
          })}
          <g transform={`translate(${POS.client[0]},${POS.client[1]})`}>
            <rect x="-40" y="-16" width="80" height="32" rx="10" className="rep-client" />
            <text textAnchor="middle" y="5" className="rep-name">Client</text>
          </g>
          {s.msgs.map((m) => {
            const t = Math.min(1, (now - m.t0) / m.dur);
            const [x1, y1] = POS[m.from];
            const [x2, y2] = POS[m.to];
            return <circle key={m.id} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r="6" className="sim-dot rep-msg" />;
          })}
        </svg>

        <div className="sim-side">
          <div className="btn-row">
            <button className="btn" onClick={write}>✎ Write</button>
            {['L', 'F1', 'F2'].map((n) => (
              <button key={n} className="btn ghost" onClick={() => read(n)}>Read {n}</button>
            ))}
          </div>
          <ul className="event-log">
            {s.log.map((e) => (
              <li key={e.id} className={e.kind}>{e.text}</li>
            ))}
            {!s.log.length && <li className="info">Write a value, then read from a follower before replication finishes.</li>}
          </ul>
          <p className="sim-tip">
            <b>Try this:</b> with async replication and a long lag, write then immediately read Follower 1 — a stale read. Then partition the network, move the client to the minority side and write under <i>CP</i> (rejected) vs <i>AP</i> (accepted, diverged). Heal the partition to see last-write-wins silently drop a write.
          </p>
        </div>
      </div>
    </div>
  );
}
