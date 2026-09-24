import { useMemo, useState } from 'react';
import { CONCEPTS, TRACKS } from '../data/concepts.js';
import { CASES } from '../data/cases.js';
import { shuffledOrder } from '../components/Content.jsx';

const ALL = [
  ...CONCEPTS.flatMap((c) => c.quiz.map((q) => ({ ...q, topic: c.title, href: `#/learn/${c.id}`, group: c.track }))),
  ...CASES.flatMap((c) => c.quiz.map((q) => ({ ...q, topic: c.title, href: `#/cases/${c.id}`, group: 'cases' }))),
];
const GROUPS = [...TRACKS.map((t) => ({ id: t.id, name: t.name, color: t.color })), { id: 'cases', name: 'Case studies', color: '#60a5fa' }];

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function Practice() {
  const [groups, setGroups] = useState(() => new Set(GROUPS.map((g) => g.id)));
  const [count, setCount] = useState(10);
  const [run, setRun] = useState(null);

  const pool = useMemo(() => ALL.filter((q) => groups.has(q.group)), [groups]);
  const toggle = (id) => setGroups((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const start = () => setRun({ qs: shuffle(pool).slice(0, count), i: 0, answers: [] });

  if (!run) {
    return (
      <div className="practice">
        <div className="page-head">
          <div className="eyebrow">Practice</div>
          <h1>Test yourself across everything.</h1>
          <p>{ALL.length} scenario-style questions from every concept and case study, shuffled. Each answer comes with an explanation, and the results tell you exactly what to review.</p>
        </div>
        <div className="panel practice-setup">
          <h3 className="panel-title">1 · Choose topics</h3>
          <div className="group-picks">
            {GROUPS.map((g) => (
              <button key={g.id} className={groups.has(g.id) ? 'on' : ''} style={{ '--c': g.color }} onClick={() => toggle(g.id)}>
                <i />
                {g.name}
                <span>{ALL.filter((q) => q.group === g.id).length}</span>
              </button>
            ))}
          </div>
          <h3 className="panel-title">2 · How many questions?</h3>
          <div className="seg">
            {[5, 10, 20, 40].map((n) => (
              <button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
          <button className="btn big" disabled={!pool.length} onClick={start}>Start practice ({Math.min(count, pool.length)} questions) →</button>
        </div>
      </div>
    );
  }

  const { qs, i, answers } = run;
  if (i >= qs.length) {
    const right = qs.filter((q, k) => answers[k] === q.answer).length;
    const missed = qs.filter((q, k) => answers[k] !== q.answer);
    const topics = [...new Map(missed.map((q) => [q.topic, q])).values()];
    const pct = Math.round((right / qs.length) * 100);
    return (
      <div className="practice">
        <div className="panel results">
          <div className="score-ring" style={{ '--p': pct }}><b>{pct}%</b><span>{right} / {qs.length}</span></div>
          <h2>{pct >= 90 ? 'Excellent — interview ready.' : pct >= 70 ? 'Solid. A few gaps to close.' : 'Good start — review the topics below.'}</h2>
          {topics.length > 0 && (
            <>
              <h4>Review these topics</h4>
              <div className="review-links">
                {topics.map((q) => <a key={q.topic} href={q.href}>{q.topic} →</a>)}
              </div>
            </>
          )}
          <div className="btn-row center">
            <button className="btn" onClick={start}>New set of questions</button>
            <button className="btn ghost" onClick={() => setRun(null)}>Change topics</button>
          </div>
        </div>
        {missed.length > 0 && (
          <div className="missed">
            <h3>Questions you missed</h3>
            {missed.map((q) => (
              <div key={q.q} className="quiz-q wrong">
                <p className="quiz-prompt">{q.q}</p>
                <p className="quiz-why"><b>Answer: {q.options[q.answer]}.</b> {q.why} <a href={q.href}>Read: {q.topic} →</a></p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const q = qs[i];
  const a = answers[i];
  const answer = (oi) => a == null && setRun({ ...run, answers: { ...answers, [i]: oi } });
  return (
    <div className="practice">
      <div className="practice-top">
        <span>Question {i + 1} of {qs.length}</span>
        <div className="practice-bar"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
        <button className="link-btn" onClick={() => setRun(null)}>Quit</button>
      </div>
      <div className={`quiz-q big ${a != null ? (a === q.answer ? 'right' : 'wrong') : ''}`}>
        <div className="practice-topic">{q.topic}</div>
        <p className="quiz-prompt">{q.q}</p>
        <div className="quiz-options column">
          {shuffledOrder(q).map((oi, pos) => (
            <button key={oi} onClick={() => answer(oi)} disabled={a != null} className={a == null ? '' : oi === q.answer ? 'correct' : oi === a ? 'picked' : 'muted'}>
              <span className="opt-letter">{'ABCD'[pos]}</span>
              {q.options[oi]}
            </button>
          ))}
        </div>
        {a != null && (
          <>
            <p className="quiz-why">
              <b>{a === q.answer ? '✓ Correct.' : `✗ The answer is “${q.options[q.answer]}”.`}</b> {q.why}{' '}
              <a href={q.href}>Read more: {q.topic} →</a>
            </p>
            <button className="btn" onClick={() => setRun({ ...run, i: i + 1 })}>{i + 1 < qs.length ? 'Next question →' : 'See results →'}</button>
          </>
        )}
      </div>
    </div>
  );
}
