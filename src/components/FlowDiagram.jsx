import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { COMPONENTS } from '../data/components.js';
import { iconPath } from './Icon.jsx';

const UX = 160;
const UY = 100;
const NW = 150;
const NH = 62;
const PAD = 30;

// Inline formatting for narration: **bold** and `code`.
export function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>
  );
}

function clipToBox(cx, cy, dx, dy) {
  const hw = NW / 2 + 6;
  const hh = NH / 2 + 6;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * t, cy + dy * t];
}

function edgeGeometry(a, b, bend = 0) {
  const ax = a.x * UX, ay = a.y * UY, bx = b.x * UX, by = b.y * UY;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (ax + bx) / 2 - (dy / len) * bend * len;
  const cy = (ay + by) / 2 + (dx / len) * bend * len;
  const [sx, sy] = clipToBox(ax, ay, bend ? cx - ax : dx, bend ? cy - ay : dy);
  const [ex, ey] = clipToBox(bx, by, bend ? cx - bx : -dx, bend ? cy - by : -dy);
  const d = bend ? `M${sx},${sy} Q${cx},${cy} ${ex},${ey}` : `M${sx},${sy} L${ex},${ey}`;
  const mx = bend ? 0.25 * sx + 0.5 * cx + 0.25 * ex : (sx + ex) / 2;
  const my = bend ? 0.25 * sy + 0.5 * cy + 0.25 * ey : (sy + ey) / 2;
  return { d, mx, my };
}

const edgeKey = (a, b) => `${a}→${b}`;
const targetsOf = (step) => (Array.isArray(step.to) ? step.to : step.to ? [step.to] : []);

export default function FlowDiagram({ spec, flows = [], intros = {}, compact = false, autoPlay = false, loop = false, caption = false, onNodeSelect }) {
  const nodes = useMemo(() => Object.fromEntries(spec.nodes.map((n) => [n.id, n])), [spec]);
  const [flowIndex, setFlowIndex] = useState(0);
  const [step, setStep] = useState(autoPlay ? 0 : -1);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const pathRefs = useRef({});
  const packetRefs = useRef([]);
  const flow = flows[flowIndex];
  const steps = flow?.steps || [];
  const current = step >= 0 ? steps[step] : null;

  // Edges declared in the spec, plus implicit ones used by flow steps.
  const edges = useMemo(() => {
    const list = spec.edges.map((e) => ({ ...e, key: edgeKey(e.from, e.to) }));
    const known = new Set(list.flatMap((e) => [edgeKey(e.from, e.to), edgeKey(e.to, e.from)]));
    for (const f of flows)
      for (const s of f.steps)
        for (const t of targetsOf(s))
          if (s.from && !known.has(edgeKey(s.from, t))) {
            list.push({ from: s.from, to: t, key: edgeKey(s.from, t), implicit: true });
            known.add(edgeKey(s.from, t));
            known.add(edgeKey(t, s.from));
          }
    return list.filter((e) => nodes[e.from] && nodes[e.to]);
  }, [spec, flows, nodes]);

  const findEdge = (a, b) => {
    const fwd = edges.find((e) => e.from === a && e.to === b);
    if (fwd) return { edge: fwd, reverse: false };
    const back = edges.find((e) => e.from === b && e.to === a);
    return back ? { edge: back, reverse: true } : null;
  };

  const active = useMemo(() => {
    const set = new Set();
    const nodeSet = new Set();
    if (current) {
      if (current.at) nodeSet.add(current.at);
      if (current.from) nodeSet.add(current.from);
      for (const t of targetsOf(current)) {
        nodeSet.add(t);
        const found = current.from && findEdge(current.from, t);
        if (found) set.add(found.edge.key);
      }
    }
    return { edges: set, nodes: nodeSet };
  }, [current, edges]);

  // Animate packets along the active edges, then dwell so the narration can be read.
  useEffect(() => {
    if (!current) return;
    let raf;
    let timer;
    const targets = current.from ? targetsOf(current) : [];
    const travel = targets.length ? 900 / speed : 0;
    const dwell = Math.max(1300, String(current.text).length * 26) / speed;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / travel);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      targets.forEach((to, i) => {
        const g = packetRefs.current[i];
        const found = findEdge(current.from, to);
        const path = found && pathRefs.current[found.edge.key];
        if (!g || !path) return;
        const L = path.getTotalLength();
        const p = path.getPointAtLength((found.reverse ? 1 - ease : ease) * L);
        g.setAttribute('transform', `translate(${p.x},${p.y})`);
        g.style.opacity = t >= 1 ? 0 : 1;
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    if (targets.length) raf = requestAnimationFrame(tick);
    if (playing) {
      timer = setTimeout(() => {
        if (step < steps.length - 1) setStep((s) => s + 1);
        else if (loop) setTimeout(() => setStep(0), 600);
        else setPlaying(false);
      }, travel + dwell);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [step, flowIndex, playing, speed]);

  const choose = (i) => {
    setFlowIndex(i);
    setStep(0);
    setPlaying(true);
  };
  const toggle = () => {
    if (step >= steps.length - 1 && !playing) setStep(0);
    else if (step < 0) setStep(0);
    setPlaying((p) => !p);
  };
  const go = (d) => {
    setPlaying(false);
    setStep((s) => Math.max(0, Math.min(steps.length - 1, s + d)));
  };
  const selectNode = (id) => {
    const next = selected === id ? null : id;
    setSelected(next);
    onNodeSelect?.(next && nodes[next]);
  };

  const maxX = Math.max(...spec.nodes.map((n) => n.x));
  const maxY = Math.max(...spec.nodes.map((n) => n.y));
  const vb = `${-NW / 2 - PAD} ${-NH / 2 - PAD} ${maxX * UX + NW + PAD * 2} ${maxY * UY + NH + PAD * 2}`;
  const color = flow?.color || '#5ee1ff';
  const sel = selected && nodes[selected];
  const selType = sel && COMPONENTS[sel.type];

  return (
    <div className={`flow ${compact ? 'compact' : ''}`} style={{ '--flow': color }}>
      {!compact && flows.length > 0 && (
        <div className="flow-tabs">
          {flows.map((f, i) => (
            <button key={f.id || i} className={i === flowIndex && step >= 0 ? 'on' : ''} style={{ '--c': f.color || '#5ee1ff' }} onClick={() => choose(i)}>
              <i />
              {f.name}
            </button>
          ))}
        </div>
      )}

      {!compact && flow && step >= 0 && intros[flow.id] && (
        <p className="flow-intro"><span>What you’re watching</span>{intros[flow.id]}</p>
      )}

      <div className="flow-stage">
        <div className="flow-canvas">
          <svg viewBox={vb} role="img" aria-label="Architecture diagram">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="rgba(148,197,255,0.45)" />
              </marker>
              <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={color} />
              </marker>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {spec.groups?.map((g) => (
              <g key={g.label} className="flow-group">
                <rect x={g.x * UX - NW / 2 - 16} y={g.y * UY - NH / 2 - 26} width={g.w * UX + NW + 32} height={g.h * UY + NH + 42} rx="18" />
                <text x={g.x * UX - NW / 2 - 4} y={g.y * UY - NH / 2 - 10}>{g.label}</text>
              </g>
            ))}

            {edges.map((e) => {
              const { d, mx, my } = edgeGeometry(nodes[e.from], nodes[e.to], e.bend);
              const on = active.edges.has(e.key);
              if (e.implicit && !on) return <path key={e.key} ref={(el) => (pathRefs.current[e.key] = el)} d={d} className="flow-edge hidden" />;
              return (
                <g key={e.key} className={`flow-edge-g ${on ? 'on' : ''} ${e.dashed ? 'dashed' : ''}`}>
                  <path ref={(el) => (pathRefs.current[e.key] = el)} d={d} className="flow-edge" markerEnd={on ? 'url(#arrow-on)' : 'url(#arrow)'} markerStart={e.both ? (on ? 'url(#arrow-on)' : 'url(#arrow)') : undefined} />
                  {on && <path d={d} className="flow-edge-pulse" />}
                  {e.label && !compact && (
                    <text x={mx} y={my - 6} className="flow-edge-label">
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {spec.nodes.map((n) => {
              const c = COMPONENTS[n.type] || COMPONENTS.service;
              const on = active.nodes.has(n.id);
              const pulse = current?.at === n.id;
              return (
                <g
                  key={n.id}
                  className={`flow-node ${on ? 'on' : ''} ${pulse ? 'pulse' : ''} ${selected === n.id ? 'sel' : ''} ${current && !on ? 'dim' : ''}`}
                  transform={`translate(${n.x * UX},${n.y * UY})`}
                  style={{ '--c': c.color }}
                  onClick={() => selectNode(n.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && selectNode(n.id)}
                >
                  {n.stack && <rect x={-NW / 2 + 6} y={-NH / 2 - 6} width={NW} height={NH} rx="12" className="flow-node-stack" />}
                  <rect x={-NW / 2} y={-NH / 2} width={NW} height={NH} rx="12" className="flow-node-box" />
                  <g transform={`translate(${-NW / 2 + 12},${-11}) scale(0.92)`}>
                    <path d={iconPath(n.type)} fill="none" stroke={c.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <text x={-NW / 2 + 44} y={n.sub ? -3 : 5} className="flow-node-label">
                    {n.label}
                  </text>
                  {n.sub && (
                    <text x={-NW / 2 + 44} y={13} className="flow-node-sub">
                      {n.sub}
                    </text>
                  )}
                </g>
              );
            })}

            {current &&
              targetsOf(current).map((t, i) => (
                <g key={`${step}-${t}`} ref={(el) => (packetRefs.current[i] = el)} className="flow-packet" filter="url(#glow)" style={{ opacity: 0 }}>
                  <circle r="11" fill={color} />
                  <text textAnchor="middle" y="4" className="flow-packet-n">{step + 1}</text>
                </g>
              ))}
          </svg>
        </div>

        {!compact && (
          <aside className="flow-side">
            {sel ? (
              <div className="flow-info" style={{ '--c': selType.color }}>
                <button className="x" onClick={() => selectNode(null)} aria-label="Close">×</button>
                <div className="kicker">{selType.name}</div>
                <h4>{sel.label}</h4>
                {sel.note && <p className="note"><Rich text={sel.note} /></p>}
                <p><b>What:</b> {selType.what}</p>
                <p><b>Why:</b> {selType.why}</p>
              </div>
            ) : current ? (
              <div className="flow-narration" key={`${flowIndex}-${step}`}>
                <div className="kicker">
                  {flow.name} · step {step + 1}/{steps.length}
                </div>
                {current.from && (
                  <div className="flow-route">
                    <span style={{ '--c': COMPONENTS[nodes[current.from].type].color }}>{nodes[current.from].label}</span>
                    <i>→</i>
                    {targetsOf(current).map((t) => (
                      <span key={t} style={{ '--c': COMPONENTS[nodes[t].type].color }}>{nodes[t].label}</span>
                    ))}
                  </div>
                )}
                {current.at && (
                  <div className="flow-route">
                    <span style={{ '--c': COMPONENTS[nodes[current.at].type].color }}>{nodes[current.at].label}</span>
                    <i>thinks…</i>
                  </div>
                )}
                <p><Rich text={current.text} /></p>
                <div className="chips" hidden>
                  {[...active.nodes].map((id) => (
                    <span key={id} style={{ '--c': COMPONENTS[nodes[id].type].color }}>{nodes[id].label}</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flow-narration idle">
                <div className="kicker">How to use</div>
                <p>Pick a flow above to watch a request travel through the system, step by step. Click any component to learn what it does.</p>
              </div>
            )}
            {flow && (
              <div className="flow-progress">
                {steps.map((_, i) => (
                  <button key={i} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => { setPlaying(false); setStep(i); }} aria-label={`Step ${i + 1}`} />
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {compact && caption && current && (
        <div className="flow-caption" key={step}>
          <span>{step + 1}/{steps.length}</span>
          <p><Rich text={current.text} /></p>
        </div>
      )}

      {!compact && flow && (
        <div className="flow-controls">
          <button onClick={() => go(-1)} disabled={step <= 0} title="Previous step">‹</button>
          <button className="play" onClick={toggle} title={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <button onClick={() => go(1)} disabled={step >= steps.length - 1} title="Next step">›</button>
          <div className="speed">
            {[0.5, 1, 2].map((s) => (
              <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button className={`steps-toggle ${showSteps ? 'on' : ''}`} onClick={() => setShowSteps((v) => !v)}>
            {showSteps ? 'Hide' : 'Show'} all steps
          </button>
        </div>
      )}

      {!compact && (
        <div className="flow-legend">
          <span><i className="lg-solid" />Request / response (waits for an answer)</span>
          <span><i className="lg-dashed" />Asynchronous (fire-and-forget)</span>
          <span><i className="lg-packet" />Moving dot = the current step</span>
          <span><i className="lg-stack" />Stacked box = many identical copies</span>
          <span><i className="lg-click" />Click any box for an explanation</span>
        </div>
      )}

      {!compact && flow && showSteps && (
        <ol className="flow-steps">
          {steps.map((s, i) => (
            <li key={i} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => { setPlaying(false); setStep(i); }}>
              <span className="n">{i + 1}</span>
              <div>
                <em>
                  {s.from ? `${nodes[s.from]?.label} → ${targetsOf(s).map((t) => nodes[t]?.label).join(', ')}` : `${nodes[s.at]?.label}`}
                </em>
                <p><Rich text={s.text} /></p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
