import { Suspense } from 'react';
import { CONCEPTS, TRACKS, conceptById, trackById } from '../data/concepts.js';
import { simById } from '../sims/index.js';
import { useProgress } from '../progress.js';
import FlowDiagram, { Rich } from '../components/FlowDiagram.jsx';
import { Points, Tradeoffs, Quiz, DoneToggle, Explainer, RefList } from '../components/Content.jsx';

function Sidebar({ current }) {
  const p = useProgress();
  return (
    <aside className="learn-nav">
      {TRACKS.map((t) => (
        <div key={t.id} className="learn-track" style={{ '--c': t.color }}>
          <h6>{t.name}</h6>
          {CONCEPTS.filter((c) => c.track === t.id).map((c) => (
            <a key={c.id} href={`#/learn/${c.id}`} className={`${c.id === current ? 'on' : ''} ${p.done[c.id] ? 'done' : ''}`}>
              <i />
              {c.title}
            </a>
          ))}
        </div>
      ))}
    </aside>
  );
}

function Overview() {
  const p = useProgress();
  return (
    <div className="learn-overview">
      <div className="page-head">
        <div className="eyebrow">Concept library</div>
        <h1>Everything behind the boxes and arrows.</h1>
        <p>{CONCEPTS.length} building blocks in six tracks. Work through them in order, or jump to what your next interview needs.</p>
      </div>
      {TRACKS.map((t) => (
        <section key={t.id} className="ov-track" style={{ '--c': t.color }}>
          <h3><span />{t.name}<em>{t.blurb}</em></h3>
          <div className="ov-grid">
            {CONCEPTS.filter((c) => c.track === t.id).map((c) => (
              <a key={c.id} href={`#/learn/${c.id}`} className={`ov-card ${p.done[c.id] ? 'done' : ''}`}>
                <h4>{c.title}</h4>
                <p>{c.summary}</p>
                <div className="ov-meta">
                  {c.sim && <span>▶ Simulator</span>}
                  {c.diagram && <span>◇ Animated flow</span>}
                  <span>{c.quiz.length} questions</span>
                  {p.done[c.id] && <span className="good">✓ Done</span>}
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Learn({ id }) {
  const concept = id && conceptById(id);
  if (!concept) {
    return (
      <div className="learn">
        <Sidebar />
        <Overview />
      </div>
    );
  }
  const track = trackById(concept.track);
  const idx = CONCEPTS.indexOf(concept);
  const prev = CONCEPTS[idx - 1];
  const next = CONCEPTS[idx + 1];
  const sim = concept.sim && simById(concept.sim);

  return (
    <div className="learn">
      <Sidebar current={concept.id} />
      <article className="concept" style={{ '--c': track.color }}>
        <header className="concept-head">
          <div className="eyebrow">{track.name} · {idx + 1} of {CONCEPTS.length}</div>
          <h1>{concept.title}</h1>
          <p className="lede"><Rich text={concept.summary} /></p>
          <DoneToggle id={concept.id} />
        </header>

        <Explainer item={concept} />

        {concept.diagram && (
          <section className="panel">
            <h3 className="panel-title">See it in motion</h3>
            <FlowDiagram spec={concept.diagram.spec} flows={concept.diagram.flows} />
          </section>
        )}

        {sim && (
          <section className="panel">
            <h3 className="panel-title">Simulator · {sim.title}</h3>
            <Suspense fallback={<div className="sim-loading" />}>
              <sim.Component />
            </Suspense>
          </section>
        )}

        <div className="deeper-head">
          <h2>Going deeper</h2>
          <p>The details interviewers expect, once the basics above make sense.</p>
        </div>
        {concept.sections.map((s) => (
          <section key={s.h} className="concept-section">
            <h3 className="sub-h">{s.h}</h3>
            <Points points={s.points} />
          </section>
        ))}

        {concept.tradeoffs && (
          <section className="concept-section">
            <h2>Trade-offs</h2>
            <Tradeoffs rows={concept.tradeoffs} />
          </section>
        )}

        <section className="concept-section">
          <h2>Check yourself <em className="q-count">{concept.quiz.length} questions</em></h2>
          <Quiz key={concept.id} id={concept.id} questions={concept.quiz} />
        </section>

        {concept.refs && (
          <section className="concept-section">
            <h2>Learn more</h2>
            <p className="section-lede">The best material on this topic — books, papers and engineering blogs.</p>
            <RefList ids={concept.refs} />
          </section>
        )}

        <nav className="pager">
          {prev ? <a href={`#/learn/${prev.id}`}><span>← Previous</span>{prev.title}</a> : <span />}
          {next ? <a className="next" href={`#/learn/${next.id}`}><span>Next →</span>{next.title}</a> : <a className="next" href="#/cases"><span>Next →</span>Case studies</a>}
        </nav>
      </article>
    </div>
  );
}
