import FlowDiagram from '../components/FlowDiagram.jsx';
import Icon from '../components/Icon.jsx';
import { CASES, caseById } from '../data/cases.js';
import { CONCEPTS, TRACKS } from '../data/concepts.js';
import { SIMS } from '../sims/index.js';
import { useProgress } from '../progress.js';

const HERO = caseById('url-shortener');

export const FRAMEWORK = [
  { n: '01', title: 'Requirements', time: '5–8 min', text: 'Clarify functional features and non-functional goals: scale, latency, consistency, availability. Agree on what is out of scope.' },
  { n: '02', title: 'Estimation', time: '3–5 min', text: 'Back-of-the-envelope QPS, storage and bandwidth. The numbers decide whether you need caching, sharding or queues.' },
  { n: '03', title: 'High-level design', time: '10–15 min', text: 'API, data model and a box-and-arrow diagram. Walk one request through it end to end.' },
  { n: '04', title: 'Deep dive', time: '15–20 min', text: 'Pick the hardest parts — bottlenecks, failure modes, trade-offs — and go deep. Justify every choice.' },
];

export default function Home() {
  const p = useProgress();
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="dot" /> Interactive high-level design</div>
          <h1>
            Learn system design
            <br />
            <span className="grad">by watching it run.</span>
          </h1>
          <p>
            Animated architectures you can step through, simulators you can break, and interview-grade case studies — from load balancers to payment ledgers.
          </p>
          <div className="hero-cta">
            <a className="btn big" href="#/learn/scalability">Start learning →</a>
            <a className="btn big ghost" href="#/cases">Explore case studies</a>
          </div>
          <div className="hero-stats">
            <div><b>{CONCEPTS.length}</b><span>concepts</span></div>
            <div><b>{CASES.length}</b><span>case studies</span></div>
            <div><b>{SIMS.length}</b><span>simulators</span></div>
            <div><b>{CASES.reduce((n, c) => n + c.flows.length, 0)}</b><span>animated flows</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="window">
            <div className="window-bar"><i /><i /><i /><span>url-shortener · redirect path</span></div>
            <FlowDiagram spec={HERO.diagram} flows={[HERO.flows[1]]} compact autoPlay loop caption />
          </div>
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>The interview framework</h2>
          <p>Every case study follows the same four steps — the structure interviewers look for.</p>
        </div>
        <div className="framework">
          {FRAMEWORK.map((f) => (
            <div key={f.n} className="fw-step">
              <span className="fw-n">{f.n}</span>
              <h4>{f.title}</h4>
              <em>{f.time}</em>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <h2>Learning path</h2>
          <p>Six tracks, from vocabulary to consensus. Each concept has diagrams, trade-offs and a quiz.</p>
        </div>
        <div className="tracks">
          {TRACKS.map((t) => {
            const items = CONCEPTS.filter((c) => c.track === t.id);
            const done = items.filter((c) => p.done[c.id]).length;
            return (
              <a key={t.id} className="track-card" href={`#/learn/${items[0].id}`} style={{ '--c': t.color }}>
                <div className="track-top">
                  <h4>{t.name}</h4>
                  <span>{done}/{items.length}</span>
                </div>
                <p>{t.blurb}</p>
                <ul>
                  {items.map((c) => (
                    <li key={c.id} className={p.done[c.id] ? 'done' : ''}>{c.title}</li>
                  ))}
                </ul>
                <div className="track-bar"><i style={{ width: `${(done / items.length) * 100}%` }} /></div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="block">
        <div className="block-head row">
          <div>
            <h2>Case studies</h2>
            <p>Real systems designed end to end, with live estimators and step-by-step request flows.</p>
          </div>
          <a className="btn ghost" href="#/cases">All case studies →</a>
        </div>
        <div className="case-grid">
          {CASES.slice(0, 6).map((c) => <CaseCard key={c.id} c={c} done={p.done[c.id]} />)}
        </div>
      </section>

      <section className="block">
        <div className="block-head row">
          <div>
            <h2>The lab</h2>
            <p>Don’t just read about trade-offs — cause them.</p>
          </div>
          <a className="btn ghost" href="#/lab">Open the lab →</a>
        </div>
        <div className="lab-grid">
          {SIMS.map((s) => (
            <a key={s.id} className="lab-card" href={`#/lab/${s.id}`}>
              <span className="lab-icon"><Icon type={s.icon} size={22} /></span>
              <h4>{s.title}</h4>
              <p>{s.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="block cta-block">
        <h2>Design your own.</h2>
        <p>Drag components onto a canvas, wire them up, trace a request — and get an instant design review.</p>
        <a className="btn big" href="#/sandbox">Open the sandbox →</a>
      </section>
    </div>
  );
}

export function CaseCard({ c, done }) {
  return (
    <a className={`case-card ${done ? 'done' : ''}`} href={`#/cases/${c.id}`}>
      <div className="case-top">
        <span className="case-icon"><Icon type={c.icon} size={20} /></span>
        <span className={`diff ${c.difficulty.toLowerCase()}`}>{c.difficulty}</span>
      </div>
      <h4>{c.title}</h4>
      <p>{c.tagline}</p>
      <div className="tags">
        {c.tags.map((t) => <span key={t}>{t}</span>)}
      </div>
      {done && <span className="done-badge">✓ Completed</span>}
    </a>
  );
}
