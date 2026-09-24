import { useState } from 'react';
import { Rich } from './FlowDiagram.jsx';
import { progress, useProgress } from '../progress.js';
import { REFERENCES } from '../data/references.js';

// Stable per-question shuffle, so the correct answer isn't always in the same position.
export function shuffledOrder(q) {
  let h = 2166136261;
  for (const ch of q.q) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    h = Math.imul(h ^ i, 16777619) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function Explainer({ item }) {
  if (!item.what) return null;
  return (
    <div className="explainer">
      <div className="ex-analogy">
        <span className="ex-tag">In plain English</span>
        <p>{item.analogy}</p>
      </div>
      <div className="ex-grid">
        {[
          ['What is it?', item.what, 'what'],
          ['Why does it matter?', item.why, 'why'],
          ['How does it work?', item.how, 'how'],
        ].map(([h, text, k]) => (
          <div key={k} className={`ex-card ${k}`}>
            <h4>{h}</h4>
            <p><Rich text={text} /></p>
          </div>
        ))}
      </div>
      {item.terms && (
        <div className="terms">
          <h4>Key terms</h4>
          <table>
            <thead><tr><th>Term</th><th>What it means</th></tr></thead>
            <tbody>
              {item.terms.map(([t, d]) => (
                <tr key={t}><td>{t}</td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RefList({ ids }) {
  const refs = (ids || []).map((id) => REFERENCES[id]).filter(Boolean);
  if (!refs.length) return null;
  return (
    <div className="ref-list">
      {refs.map((r) => (
        <a key={r.url + r.title} href={r.url} target="_blank" rel="noopener noreferrer" className="ref">
          <span className="ref-kind">{r.kind}</span>
          <b>{r.title} ↗</b>
          <small>{r.by}</small>
          <p>{r.note}</p>
        </a>
      ))}
    </div>
  );
}

export function Points({ points }) {
  return (
    <ul className="points">
      {points.map((p, i) => (
        <li key={i}><Rich text={p} /></li>
      ))}
    </ul>
  );
}

export function Tradeoffs({ rows }) {
  return (
    <div className="tradeoffs">
      {rows.map((r) => (
        <div key={r.choice} className="tradeoff">
          <h5>{r.choice}</h5>
          <p className="pro"><span>+</span><em>You gain</em>{r.pros}</p>
          <p className="con"><span>−</span><em>You pay</em>{r.cons}</p>
        </div>
      ))}
    </div>
  );
}

export function Quiz({ id, questions }) {
  const [answers, setAnswers] = useState({});
  const p = useProgress();
  const best = p.quiz[id];
  const answered = Object.keys(answers).length;
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;

  const choose = (qi, oi) => {
    if (answers[qi] != null) return;
    const next = { ...answers, [qi]: oi };
    setAnswers(next);
    if (Object.keys(next).length === questions.length) {
      const score = questions.filter((q, i) => next[i] === q.answer).length;
      if (!best || score >= best.score) progress.saveQuiz(id, score, questions.length);
      if (score === questions.length) progress.markDone(id);
    }
  };

  return (
    <div className="quiz">
      {questions.map((q, qi) => {
        const a = answers[qi];
        return (
          <div key={qi} className={`quiz-q ${a != null ? (a === q.answer ? 'right' : 'wrong') : ''}`}>
            <p className="quiz-prompt"><span>Q{qi + 1}</span>{q.q}</p>
            <div className="quiz-options">
              {shuffledOrder(q).map((oi, pos) => (
                <button
                  key={oi}
                  onClick={() => choose(qi, oi)}
                  className={a == null ? '' : oi === q.answer ? 'correct' : oi === a ? 'picked' : 'muted'}
                  disabled={a != null}
                >
                  <span className="opt-letter">{'ABCD'[pos]}</span>
                  {q.options[oi]}
                </button>
              ))}
            </div>
            {a != null && (
              <p className="quiz-why">
                <b>{a === q.answer ? '✓ Correct.' : `✗ Not quite — the answer is “${q.options[q.answer]}”.`}</b> {q.why}
              </p>
            )}
          </div>
        );
      })}
      <div className="quiz-foot">
        {answered === questions.length ? (
          <>
            <b className={correct === questions.length ? 'good' : ''}>{correct} / {questions.length} correct</b>
            <button className="btn ghost" onClick={() => setAnswers({})}>Retry</button>
          </>
        ) : (
          <span>{answered} / {questions.length} answered</span>
        )}
        {best && <em>Best: {best.score}/{best.total}</em>}
      </div>
    </div>
  );
}

export function DoneToggle({ id }) {
  const p = useProgress();
  const done = !!p.done[id];
  return (
    <button className={`done-toggle ${done ? 'on' : ''}`} onClick={() => progress.toggleDone(id)}>
      <span>{done ? '✓' : ''}</span>
      {done ? 'Completed' : 'Mark as complete'}
    </button>
  );
}
