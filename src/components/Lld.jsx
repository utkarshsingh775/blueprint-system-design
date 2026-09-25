import { useState } from 'react';
import { progress, useProgress } from '../progress.js';

const KEYWORDS = new Set(
  'abstract boolean break case catch class default do double else enum extends final finally for if implements import instanceof int interface long new null package private protected public record return static super switch synchronized this throw throws try var void volatile while true false'.split(' ')
);
const TOKEN = /(\/\/.*$)|("(?:\\.|[^"\\])*")|(@\w+)|\b(\d[\d_]*L?)\b|\b([A-Za-z_]\w*)\b/g;

function highlight(line) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push(line.slice(last, m.index));
    const [text, comment, str, ann, num, word] = m;
    const cls = comment ? 'c' : str ? 's' : ann ? 'a' : num ? 'n' : KEYWORDS.has(word) ? 'k' : /^[A-Z]/.test(word) ? 't' : null;
    out.push(cls ? <span key={m.index} className={`tk-${cls}`}>{text}</span> : text);
    last = m.index + text.length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy-btn"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CodeBlock({ code, startLine = 1, label }) {
  const lines = code.replace(/^\n/, '').split('\n');
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{label || 'Java'}</span>
        <CopyButton text={code.replace(/^\n/, '')} />
      </div>
      <pre>
        {lines.map((l, i) => (
          <div key={i} className="code-line">
            <i>{startLine + i}</i>
            <code>{highlight(l)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function TextDiagram({ title, text }) {
  return (
    <figure className="tdiag">
      <figcaption>
        <span>{title}</span>
        <CopyButton text={text} />
      </figcaption>
      <pre>{text}</pre>
    </figure>
  );
}

export function Dialogue({ rows }) {
  return (
    <div className="dialogue">
      {rows.map((r, i) => (
        <div key={i} className="dlg">
          <p className="dlg-int"><span>Interviewer says</span>{r.interviewer}</p>
          <p className="dlg-you"><span>You say</span>{r.you}</p>
          <p className="dlg-why"><span>Why</span>{r.why}</p>
        </div>
      ))}
    </div>
  );
}

// Interview mode: the ideal answer stays hidden until you've written your own attempt.
export function Reveal({ mode, id, ask, children }) {
  const p = useProgress();
  const [shown, setShown] = useState(false);
  if (mode !== 'interview') return children;
  const attempt = p.attempts[id] || '';
  return (
    <div className={`reveal ${shown ? 'shown' : ''}`}>
      <p className="reveal-ask"><span>Interviewer</span>{ask}</p>
      <textarea
        rows={3}
        value={attempt}
        onChange={(e) => progress.saveAttempt(id, e.target.value)}
        placeholder="Say your answer out loud, then jot the key points here. Saved on this device."
      />
      <button className="btn small" onClick={() => setShown((s) => !s)}>
        {shown ? 'Hide ideal answer' : attempt.trim() ? 'Reveal ideal answer' : 'Reveal without answering'}
      </button>
      {shown && <div className="reveal-answer">{children}</div>}
    </div>
  );
}

export function CorrectMe({ turn }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="correct-me">
      <b>Correct me</b>
      <p>A common first attempt: <code>{turn.wrong}</code></p>
      <p className="cm-ask">{turn.ask}</p>
      {open ? <p className="cm-answer">{turn.answer}</p> : <button className="btn ghost small" onClick={() => setOpen(true)}>Think, then show the answer</button>}
    </div>
  );
}

export function Checklist({ id, items }) {
  const p = useProgress();
  const ticks = p.check[id] || {};
  const done = items.filter((_, i) => ticks[i]).length;
  return (
    <div className="checklist">
      <div className="checklist-head">
        <b>{done} / {items.length} ready</b>
        <div className="track-bar"><i style={{ width: `${(done / items.length) * 100}%` }} /></div>
      </div>
      {items.map((it, i) => (
        <label key={i} className={ticks[i] ? 'on' : ''}>
          <input type="checkbox" checked={!!ticks[i]} onChange={() => progress.toggleCheck(id, i)} />
          <span>{it}</span>
        </label>
      ))}
    </div>
  );
}
