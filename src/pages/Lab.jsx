import { Suspense } from 'react';
import { SIMS, simById } from '../sims/index.js';
import { conceptById } from '../data/concepts.js';
import Icon from '../components/Icon.jsx';

export default function Lab({ id }) {
  const sim = id && simById(id);
  if (!sim) {
    return (
      <div className="lab-page">
        <div className="page-head">
          <div className="eyebrow">The lab</div>
          <h1>Break things on purpose.</h1>
          <p>Six live simulators for the ideas that are hardest to picture. Change a parameter and watch the system react.</p>
        </div>
        <div className="lab-grid big">
          {SIMS.map((s) => (
            <a key={s.id} className="lab-card" href={`#/lab/${s.id}`}>
              <span className="lab-icon"><Icon type={s.icon} size={24} /></span>
              <h4>{s.title}</h4>
              <p>{s.blurb}</p>
              <span className="lab-go">Launch →</span>
            </a>
          ))}
        </div>
      </div>
    );
  }
  const concept = conceptById(sim.concept);
  return (
    <div className="lab-page">
      <div className="lab-head">
        <a className="crumb" href="#/lab">← The lab</a>
        <h1>{sim.title}</h1>
        <p className="lede">{sim.blurb}</p>
        {concept && <a className="btn ghost small" href={`#/learn/${concept.id}`}>Read the concept: {concept.title} →</a>}
      </div>
      <div className="panel">
        <Suspense fallback={<div className="sim-loading" />}>
          <sim.Component />
        </Suspense>
      </div>
      <div className="lab-others">
        {SIMS.filter((s) => s.id !== sim.id).map((s) => (
          <a key={s.id} href={`#/lab/${s.id}`}><Icon type={s.icon} size={16} />{s.title}</a>
        ))}
      </div>
    </div>
  );
}
