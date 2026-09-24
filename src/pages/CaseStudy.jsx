import { useEffect, useState } from 'react';
import { CASES, caseById } from '../data/cases.js';
import FlowDiagram from '../components/FlowDiagram.jsx';
import Estimator from '../components/Estimator.jsx';
import Icon from '../components/Icon.jsx';
import { Points, Tradeoffs, Quiz, DoneToggle, RefList } from '../components/Content.jsx';
import { conceptById } from '../data/concepts.js';
import { useProgress } from '../progress.js';

const SECTIONS = [
  { id: 'overview', label: 'Big picture', step: '00' },
  { id: 'requirements', label: 'Requirements', step: '01' },
  { id: 'estimation', label: 'Estimation', step: '02' },
  { id: 'api', label: 'API design', step: '03' },
  { id: 'data', label: 'Data model', step: '03' },
  { id: 'architecture', label: 'Architecture', step: '03' },
  { id: 'deep-dives', label: 'Deep dives', step: '04' },
  { id: 'tradeoffs', label: 'Trade-offs', step: '04' },
  { id: 'quiz', label: 'Quiz', step: '✓' },
  { id: 'learn-more', label: 'Learn more', step: '↗' },
];

export default function CaseStudy({ id }) {
  const c = caseById(id);
  const [active, setActive] = useState('overview');
  const p = useProgress();
  const [open, setOpen] = useState(0);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [id]);

  if (!c) return <div className="page-head"><h1>Case study not found</h1><a href="#/cases">← All case studies</a></div>;
  const idx = CASES.indexOf(c);
  const next = CASES[(idx + 1) % CASES.length];
  const jump = (e, sid) => {
    e.preventDefault();
    document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="case">
      <header className="case-hero">
        <a className="crumb" href="#/cases">← Case studies</a>
        <div className="case-hero-row">
          <span className="case-hero-icon"><Icon type={c.icon} size={30} /></span>
          <div>
            <h1>{c.title}</h1>
            <p className="lede">{c.tagline}</p>
          </div>
        </div>
        <div className="case-hero-meta">
          <span className={`diff ${c.difficulty.toLowerCase()}`}>{c.difficulty}</span>
          {c.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          <span className="spacer" />
          <a className="btn ghost small" href={`#/sandbox/${c.id}`}>Open in sandbox</a>
          <DoneToggle id={c.id} />
        </div>
      </header>

      <div className="case-layout">
        <nav className="case-nav">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => jump(e, s.id)} className={active === s.id ? 'on' : ''}>
              <span>{s.step}</span>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="case-main">
          <section id="overview" className="case-section">
            <h2><span>00</span>The big picture, in plain English</h2>
            <ol className="story">
              {c.story?.map((s, i) => (
                <li key={i}><span>{i + 1}</span><p>{s}</p></li>
              ))}
            </ol>
            {c.bigIdea && (
              <div className="big-idea">
                <b>The key idea</b>
                <p>{c.bigIdea}</p>
              </div>
            )}
            {c.prereqs && (
              <div className="prereqs">
                <h4>Concepts to understand first</h4>
                <p>New to any of these? Read them first — each takes about 5 minutes.</p>
                <div className="prereq-list">
                  {c.prereqs.map((id) => {
                    const k = conceptById(id);
                    return (
                      <a key={id} href={`#/learn/${id}`} className={p.done[id] ? 'done' : ''}>
                        <i>{p.done[id] ? '✓' : ''}</i>
                        <div><b>{k.title}</b><small>{k.summary}</small></div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section id="requirements" className="case-section">
            <h2><span>01</span>Requirements</h2>
            <div className="req-grid">
              <div className="req-card">
                <h4>Functional</h4>
                <Points points={c.functional} />
              </div>
              <div className="req-card nf">
                <h4>Non-functional</h4>
                <Points points={c.nonFunctional} />
              </div>
            </div>
          </section>

          <section id="estimation" className="case-section">
            <h2><span>02</span>Capacity estimation</h2>
            <p className="section-lede">Drag the assumptions — every number below recalculates. This is how you decide what the architecture needs.</p>
            <div className="how-read">
              <b>How to read these numbers</b>
              <ul>
                <li><b>QPS</b> = requests per second = requests per day ÷ 86,400. <b>Peak</b> is the busiest moment, usually 2–3× the average.</li>
                <li>One ordinary server handles roughly 1,000–10,000 simple requests per second, so QPS tells you how many servers (and whether you need a cache).</li>
                <li><b>Storage</b> tells you whether one database is enough or data must be split across machines (sharding).</li>
                <li>Units: K = thousand, M = million, B = billion · KB → MB → GB → TB → PB, each 1,000× bigger.</li>
              </ul>
            </div>
            <Estimator estimate={c.estimate} />
          </section>

          <section id="api" className="case-section">
            <h2><span>03</span>API design</h2>
            <p className="section-lede">The requests clients can make. Each row: what it does, what you send, and what comes back.</p>
            <div className="table-wrap">
              <table className="api-table">
                <thead><tr><th>Method</th><th>Endpoint</th><th>What it does</th><th>You send</th><th>You get back</th></tr></thead>
                <tbody>
                  {c.api.map((a, i) => (
                    <tr key={a.path}>
                      <td><span className={`method ${a.method.toLowerCase()}`}>{a.method}</span></td>
                      <td><code>{a.path}</code></td>
                      <td>{c.apiDoes?.[i]}{a.note && <small>{a.note}</small>}</td>
                      <td>{a.body ? <code>{a.body}</code> : <span className="none">—</span>}</td>
                      <td><code>{a.returns}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="data" className="case-section">
            <h2><span>03</span>Data model</h2>
            <div className="schema-grid">
              {c.data.map((t, i) => (
                <div key={t.name} className="schema">
                  <div className="schema-head">
                    <b>{t.name}</b>
                    <span>{t.store}</span>
                  </div>
                  {c.dataWhy?.[i] && <p className="schema-why">{c.dataWhy[i]}</p>}
                  <table>
                    <thead><tr><th>Field</th><th>Type / meaning</th></tr></thead>
                    <tbody>
                      {t.fields.map(([f, type]) => (
                        <tr key={f}><td>{f}</td><td>{type}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {t.note && <p className="schema-note"><b>Why this store?</b> {t.note}</p>}
                </div>
              ))}
            </div>
          </section>

          <section id="architecture" className="case-section">
            <h2><span>03</span>High-level architecture</h2>
            <p className="section-lede">Choose a flow to watch a request travel through the system. Click any component for details.</p>
            <FlowDiagram key={c.id} spec={c.diagram} flows={c.flows} intros={c.flowIntro} />
          </section>

          <section id="deep-dives" className="case-section">
            <h2><span>04</span>Deep dives</h2>
            <div className="accordion">
              {c.deepDives.map((d, i) => (
                <div key={d.title} className={`acc-item ${open === i ? 'open' : ''}`}>
                  <button onClick={() => setOpen(open === i ? -1 : i)}>
                    {d.title}
                    <span>{open === i ? '−' : '+'}</span>
                  </button>
                  {open === i && <div className="acc-body"><Points points={d.points} /></div>}
                </div>
              ))}
            </div>
          </section>

          <section id="tradeoffs" className="case-section">
            <h2><span>04</span>Trade-offs & bottlenecks</h2>
            <Tradeoffs rows={c.tradeoffs} />
            <div className="bottlenecks">
              <h4>⚠ Where it breaks first</h4>
              <Points points={c.bottlenecks} />
            </div>
          </section>

          <section id="quiz" className="case-section">
            <h2><span>✓</span>Check yourself <em className="q-count">{c.quiz.length} questions</em></h2>
            <Quiz key={c.id} id={c.id} questions={c.quiz} />
          </section>

          <section id="learn-more" className="case-section">
            <h2><span>↗</span>Learn more</h2>
            <p className="section-lede">Where this design comes from, and the best places to go deeper.</p>
            <RefList ids={c.refs} />
          </section>

          <a className="next-case" href={`#/cases/${next.id}`}>
            <span>Next case study</span>
            <b>{next.title} →</b>
          </a>
        </div>
      </div>
    </div>
  );
}
