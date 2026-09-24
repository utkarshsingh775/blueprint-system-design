import { useEffect, useMemo, useRef, useState } from 'react';
import { COMPONENTS, PALETTE_ORDER } from '../data/components.js';
import { CASES, caseById } from '../data/cases.js';
import Icon, { iconPath } from '../components/Icon.jsx';

const W = 1500;
const H = 900;
const NW = 150;
const NH = 56;
const KEY = 'blueprint.sandbox.v1';
const snap = (v) => Math.round(v / 10) * 10;

const fromCase = (c) => ({
  nodes: c.diagram.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label, x: 130 + n.x * 190, y: 90 + n.y * 120, stack: !!n.stack })),
  edges: c.diagram.edges.map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to, async: !!e.dashed })),
});
const STARTER = fromCase(caseById('url-shortener'));

function border(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.min(dx ? (NW / 2 + 5) / Math.abs(dx) : Infinity, dy ? (NH / 2 + 5) / Math.abs(dy) : Infinity);
  return [a.x + dx * t, a.y + dy * t];
}

// Heuristic design review: common anti-patterns and single points of failure.
function review({ nodes, edges }) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = [];
  const neighbours = (id) => edges.filter((e) => e.from === id || e.to === id).map((e) => byId[e.from === id ? e.to : e.from]).filter(Boolean);
  const types = new Set(nodes.map((n) => n.type));
  const isClient = (n) => n.type === 'client' || n.type === 'mobile';
  if (!nodes.length) return [{ level: 'info', text: 'Add components from the palette to get a design review.' }];

  for (const n of nodes) {
    const nb = neighbours(n.id);
    if (!nb.length) out.push({ level: 'warn', text: `**${n.label}** isn’t connected to anything.`, id: n.id });
    if (isClient(n) && nb.some((x) => ['db', 'nosql', 'cache', 'queue', 'stream'].includes(x.type)))
      out.push({ level: 'bad', text: `**${n.label}** talks directly to a data store. Clients should go through a service — never expose databases.`, id: n.id });
    if (isClient(n) && nb.some((x) => x.type === 'service'))
      out.push({ level: 'warn', text: `**${n.label}** hits a service directly. Add a load balancer or API gateway for scaling, TLS and failover.`, id: n.id });
    if (['service', 'ws', 'lb', 'gateway'].includes(n.type) && !n.stack)
      out.push({ level: 'warn', text: `**${n.label}** is a single instance — a single point of failure. Mark it as replicated.`, id: n.id });
    if (n.type === 'worker' && !nb.some((x) => ['queue', 'stream'].includes(x.type)))
      out.push({ level: 'info', text: `**${n.label}** isn’t fed by a queue. Workers usually pull jobs from a queue so bursts and retries are absorbed.`, id: n.id });
  }
  if ((types.has('db') || types.has('nosql')) && !types.has('cache'))
    out.push({ level: 'info', text: 'No cache. If the system is read-heavy, a cache in front of the database cuts latency and load dramatically.' });
  if (types.has('storage') && !types.has('cdn') && nodes.some(isClient))
    out.push({ level: 'info', text: 'Object storage without a CDN. Serve media and static files from the edge.' });
  if (types.has('external') && !types.has('queue') && !types.has('stream'))
    out.push({ level: 'info', text: 'Calls to external APIs with no queue: a slow provider will slow your request path. Consider async + retries.' });
  if (!out.length) out.push({ level: 'good', text: 'No obvious issues. Now stress it: what happens when each component fails?' });
  return out;
}

export default function Sandbox({ template }) {
  const [design, setDesign] = useState(() => {
    if (template && caseById(template)) return fromCase(caseById(template));
    try {
      return JSON.parse(localStorage.getItem(KEY)) || STARTER;
    } catch {
      return STARTER;
    }
  });
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null);
  const [link, setLink] = useState(null);
  const [trace, setTrace] = useState(null);
  const svg = useRef(null);
  const fileInput = useRef(null);
  const traceTimer = useRef(null);
  const { nodes, edges } = design;
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const findings = useMemo(() => review(design), [design]);

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(design)), [design]);
  useEffect(() => {
    if (template && caseById(template)) history.replaceState(null, '', '#/sandbox');
  }, [template]);

  const pt = (e) => {
    const p = svg.current.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.current.getScreenCTM().inverse());
  };
  const update = (fn) => setDesign((d) => fn(structuredClone(d)));

  const addNode = (type, x, y) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const count = nodes.filter((n) => n.type === type).length;
    const pos = x != null ? { x: snap(x), y: snap(y) } : { x: snap(200 + ((nodes.length * 170) % 1100)), y: snap(120 + Math.floor(nodes.length / 7) * 130) };
    update((d) => {
      d.nodes.push({ id, type, label: `${COMPONENTS[type].name}${count ? ` ${count + 1}` : ''}`, ...pos, stack: false });
      return d;
    });
    setSel({ kind: 'node', id });
  };

  const remove = () => {
    if (!sel) return;
    update((d) => {
      if (sel.kind === 'node') {
        d.nodes = d.nodes.filter((n) => n.id !== sel.id);
        d.edges = d.edges.filter((e) => e.from !== sel.id && e.to !== sel.id);
      } else d.edges = d.edges.filter((e) => e.id !== sel.id);
      return d;
    });
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        remove();
      }
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onMove = (e) => {
    if (drag) {
      const p = pt(e);
      update((d) => {
        const n = d.nodes.find((x) => x.id === drag.id);
        n.x = snap(Math.max(NW / 2, Math.min(W - NW / 2, p.x - drag.dx)));
        n.y = snap(Math.max(NH / 2, Math.min(H - NH / 2, p.y - drag.dy)));
        return d;
      });
    } else if (link) {
      const p = pt(e);
      setLink((l) => ({ ...l, x: p.x, y: p.y }));
    }
  };
  const onUp = (e) => {
    if (link) {
      const p = pt(e);
      const target = nodes.find((n) => Math.abs(n.x - p.x) < NW / 2 && Math.abs(n.y - p.y) < NH / 2 && n.id !== link.from);
      if (target && !edges.some((x) => (x.from === link.from && x.to === target.id) || (x.to === link.from && x.from === target.id))) {
        update((d) => {
          d.edges.push({ id: `e${Date.now().toString(36)}`, from: link.from, to: target.id, async: false });
          return d;
        });
      }
      setLink(null);
    }
    setDrag(null);
  };

  const runTrace = () => {
    const start = (sel?.kind === 'node' && byId[sel.id]) || nodes.find((n) => n.type === 'client' || n.type === 'mobile') || nodes[0];
    if (!start) return;
    const hops = [];
    const seen = new Set([start.id]);
    let frontier = [start.id];
    while (frontier.length) {
      const nextFrontier = [];
      const wave = [];
      for (const id of frontier)
        for (const e of edges.filter((x) => x.from === id || x.to === id)) {
          const other = e.from === id ? e.to : e.from;
          if (seen.has(other)) continue;
          seen.add(other);
          wave.push({ from: id, to: other });
          nextFrontier.push(other);
        }
      if (wave.length) hops.push(wave);
      frontier = nextFrontier;
    }
    stopTrace();
    const st = { hops, i: 0, t0: performance.now(), t: 0, lit: new Set([start.id]) };
    const loop = (now) => {
      st.t = (now - st.t0) / 750;
      if (st.t >= 1) {
        (st.hops[st.i] || []).forEach((h) => st.lit.add(h.to));
        st.i++;
        st.t0 = now;
        st.t = 0;
        if (st.i >= st.hops.length) {
          setTrace({ ...st, lit: new Set(st.lit), done: true });
          traceTimer.current = setTimeout(() => setTrace(null), 1500);
          return;
        }
      }
      setTrace({ ...st, lit: new Set(st.lit) });
      traceTimer.current = requestAnimationFrame(loop);
    };
    traceTimer.current = requestAnimationFrame(loop);
  };
  const stopTrace = () => {
    cancelAnimationFrame(traceTimer.current);
    clearTimeout(traceTimer.current);
  };
  useEffect(() => stopTrace, []);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'architecture.json';
    a.click();
  };
  const importJson = (file) => {
    file.text().then((t) => {
      try {
        const d = JSON.parse(t);
        if (Array.isArray(d.nodes) && Array.isArray(d.edges)) setDesign(d);
      } catch {}
    });
  };

  const selNode = sel?.kind === 'node' && byId[sel.id];
  const selEdge = sel?.kind === 'edge' && edges.find((e) => e.id === sel.id);

  return (
    <div className="sandbox">
      <aside className="sb-palette">
        <h5>Components</h5>
        <p>Drag onto the canvas, or click to add.</p>
        <div className="sb-items">
          {PALETTE_ORDER.map((t) => (
            <button
              key={t}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/component', t)}
              onClick={() => addNode(t)}
              style={{ '--c': COMPONENTS[t].color }}
              title={COMPONENTS[t].what}
            >
              <Icon type={t} size={16} color={COMPONENTS[t].color} />
              {COMPONENTS[t].name}
            </button>
          ))}
        </div>
      </aside>

      <div className="sb-main">
        <div className="sb-toolbar">
          <select value="" onChange={(e) => e.target.value && (setDesign(fromCase(caseById(e.target.value))), setSel(null))}>
            <option value="">Load a template…</option>
            {CASES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <button className="btn small" onClick={runTrace} disabled={!edges.length}>▶ Trace a request</button>
          <button className="btn ghost small" onClick={() => { setDesign({ nodes: [], edges: [] }); setSel(null); }}>Clear</button>
          <span className="spacer" />
          <button className="btn ghost small" onClick={exportJson}>Export JSON</button>
          <button className="btn ghost small" onClick={() => fileInput.current.click()}>Import</button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importJson(e.target.files[0])} />
        </div>

        <div className="sb-canvas-wrap">
          <svg
            ref={svg}
            className="sb-canvas"
            viewBox={`0 0 ${W} ${H}`}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onPointerDown={(e) => e.target === svg.current && setSel(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const t = e.dataTransfer.getData('text/component');
              if (!t) return;
              const p = pt(e);
              addNode(t, p.x, p.y);
            }}
          >
            <defs>
              <pattern id="sb-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M30 0H0V30" fill="none" stroke="rgba(94,225,255,0.06)" />
              </pattern>
              <marker id="sb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="rgba(148,197,255,0.6)" />
              </marker>
            </defs>
            <rect width={W} height={H} fill="url(#sb-grid)" pointerEvents="none" />

            {edges.map((e) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b) return null;
              const [x1, y1] = border(a, b);
              const [x2, y2] = border(b, a);
              const on = sel?.kind === 'edge' && sel.id === e.id;
              return (
                <g key={e.id} className={`sb-edge ${on ? 'on' : ''} ${e.async ? 'async' : ''}`} onPointerDown={(ev) => { ev.stopPropagation(); setSel({ kind: 'edge', id: e.id }); }}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="hit" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="line" markerEnd="url(#sb-arrow)" />
                </g>
              );
            })}

            {link && byId[link.from] && <line x1={byId[link.from].x} y1={byId[link.from].y} x2={link.x} y2={link.y} className="sb-link-preview" />}

            {nodes.map((n) => {
              const c = COMPONENTS[n.type] || COMPONENTS.service;
              const on = selNode?.id === n.id;
              const lit = trace?.lit.has(n.id);
              const issue = findings.some((f) => f.id === n.id && f.level !== 'info');
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  className={`sb-node ${on ? 'on' : ''} ${lit ? 'lit' : ''}`}
                  style={{ '--c': c.color }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const p = pt(e);
                    setSel({ kind: 'node', id: n.id });
                    setDrag({ id: n.id, dx: p.x - n.x, dy: p.y - n.y });
                  }}
                >
                  {n.stack && <rect x={-NW / 2 + 7} y={-NH / 2 - 7} width={NW} height={NH} rx="12" className="stack" />}
                  <rect x={-NW / 2} y={-NH / 2} width={NW} height={NH} rx="12" className="box" />
                  <g transform={`translate(${-NW / 2 + 12},-11) scale(0.92)`}>
                    <path d={iconPath(n.type)} fill="none" stroke={c.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <text x={-NW / 2 + 44} y="-2" className="label">{n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}</text>
                  <text x={-NW / 2 + 44} y="14" className="sub">{c.name}{n.stack ? ' ×N' : ''}</text>
                  {issue && <circle cx={NW / 2 - 8} cy={-NH / 2 + 8} r="5" className="issue-dot" />}
                  <circle
                    cx={NW / 2}
                    cy="0"
                    r="7"
                    className="handle"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const p = pt(e);
                      setLink({ from: n.id, x: p.x, y: p.y });
                    }}
                  />
                </g>
              );
            })}

            {trace &&
              !trace.done &&
              (trace.hops[trace.i] || []).map((h, k) => {
                const a = byId[h.from];
                const b = byId[h.to];
                if (!a || !b) return null;
                const t = trace.t || 0;
                return <circle key={k} cx={a.x + (b.x - a.x) * t} cy={a.y + (b.y - a.y) * t} r="7" className="sb-packet" />;
              })}
          </svg>
          {!nodes.length && <div className="sb-empty">Drag components here to start designing.</div>}
        </div>
        <p className="sb-help">Drag nodes to move · drag from the <b>●</b> handle to connect · click an arrow to select it · <kbd>Delete</kbd> removes the selection · autosaved in your browser</p>
      </div>

      <aside className="sb-inspector">
        {selNode ? (
          <div className="insp">
            <h5>Component</h5>
            <label>Label<input value={selNode.label} onChange={(e) => update((d) => ((d.nodes.find((x) => x.id === selNode.id).label = e.target.value), d))} /></label>
            <label>
              Type
              <select value={selNode.type} onChange={(e) => update((d) => ((d.nodes.find((x) => x.id === selNode.id).type = e.target.value), d))}>
                {PALETTE_ORDER.map((t) => <option key={t} value={t}>{COMPONENTS[t].name}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={!!selNode.stack} onChange={(e) => update((d) => ((d.nodes.find((x) => x.id === selNode.id).stack = e.target.checked), d))} />
              Replicated (multiple instances)
            </label>
            <p className="insp-what">{COMPONENTS[selNode.type].what}</p>
            <p className="insp-why">{COMPONENTS[selNode.type].why}</p>
            <button className="btn bad small" onClick={remove}>Delete component</button>
          </div>
        ) : selEdge ? (
          <div className="insp">
            <h5>Connection</h5>
            <p className="insp-what">{byId[selEdge.from]?.label} → {byId[selEdge.to]?.label}</p>
            <label className="check">
              <input type="checkbox" checked={!!selEdge.async} onChange={(e) => update((d) => ((d.edges.find((x) => x.id === selEdge.id).async = e.target.checked), d))} />
              Asynchronous (dashed)
            </label>
            <button className="btn ghost small" onClick={() => update((d) => { const x = d.edges.find((y) => y.id === selEdge.id); [x.from, x.to] = [x.to, x.from]; return d; })}>⇄ Reverse direction</button>
            <button className="btn bad small" onClick={remove}>Delete connection</button>
          </div>
        ) : (
          <div className="insp muted">
            <h5>Inspector</h5>
            <p>Select a component or connection to edit it.</p>
          </div>
        )}

        <div className="review">
          <h5>Design review <em>{findings.filter((f) => f.level === 'bad' || f.level === 'warn').length} issues</em></h5>
          <ul>
            {findings.map((f, i) => (
              <li key={i} className={f.level} onClick={() => f.id && setSel({ kind: 'node', id: f.id })}>
                <span dangerouslySetInnerHTML={{ __html: f.text.replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
