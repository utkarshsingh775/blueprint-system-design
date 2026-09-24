import { useState } from 'react';
import { CASES } from '../data/cases.js';
import { useProgress } from '../progress.js';
import { CaseCard } from './Home.jsx';

export default function Cases() {
  const [level, setLevel] = useState('All');
  const p = useProgress();
  const list = CASES.filter((c) => level === 'All' || c.difficulty === level);
  return (
    <div className="cases-page">
      <div className="page-head">
        <div className="eyebrow">Case studies</div>
        <h1>Design real systems, end to end.</h1>
        <p>Each one walks the interview framework: requirements, a live capacity estimator, API, data model, an animated architecture, deep dives and trade-offs.</p>
      </div>
      <div className="filter-row">
        {['All', 'Easy', 'Medium', 'Hard'].map((l) => (
          <button key={l} className={level === l ? 'on' : ''} onClick={() => setLevel(l)}>
            {l}
            <span>{l === 'All' ? CASES.length : CASES.filter((c) => c.difficulty === l).length}</span>
          </button>
        ))}
      </div>
      <div className="case-grid">
        {list.map((c) => <CaseCard key={c.id} c={c} done={p.done[c.id]} />)}
      </div>
    </div>
  );
}
