import { useEffect, useMemo, useRef, useState } from 'react';
import { CONCEPTS, trackById } from '../data/concepts.js';
import { CASES } from '../data/cases.js';
import { SIMS } from '../sims/index.js';
import { go } from '../router.js';
import Icon from './Icon.jsx';

const ITEMS = [
  ...CASES.map((c) => ({ kind: 'Case study', title: c.title, sub: c.tagline, href: `/cases/${c.id}`, icon: c.icon, text: `${c.title} ${c.tags.join(' ')} ${c.tagline}` })),
  ...CONCEPTS.map((c) => ({ kind: trackById(c.track).name, title: c.title, sub: c.summary, href: `/learn/${c.id}`, icon: 'service', text: `${c.title} ${c.summary} ${c.sections.map((s) => s.h).join(' ')}` })),
  ...SIMS.map((s) => ({ kind: 'Simulator', title: s.title, sub: s.blurb, href: `/lab/${s.id}`, icon: s.icon, text: `${s.title} ${s.blurb} simulator lab` })),
  { kind: 'Tool', title: 'Sandbox', sub: 'Draw your own architecture', href: '/sandbox', icon: 'coord', text: 'sandbox canvas draw design' },
  { kind: 'Quiz', title: 'Practice', sub: 'Mixed quiz across every topic', href: '/practice', icon: 'analytics', text: 'practice quiz test questions interview' },
  { kind: 'Reference', title: 'References & glossary', sub: 'Books, papers, engineering blogs and every key term', href: '/references', icon: 'search', text: 'references books papers blogs glossary terms reading' },
  { kind: 'Reference', title: 'Cheat sheet', sub: 'Latency numbers, estimation, interview framework', href: '/cheatsheet', icon: 'analytics', text: 'cheat sheet latency numbers powers of two interview framework' },
];

export default function CommandPalette({ onClose }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return ITEMS.slice(0, 12);
    return ITEMS.map((it) => {
      const hay = it.text.toLowerCase();
      const title = it.title.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return null;
      return { it, score: terms.reduce((s, t) => s + (title.includes(t) ? 3 : 1), 0) };
    })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.it)
      .slice(0, 12);
  }, [q]);

  const open = (it) => {
    go(it.href);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setActive((a) => Math.min(results.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Enter' && results[active]) open(results[active]);
    else return;
    e.preventDefault();
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} placeholder="Search concepts, case studies, simulators…" />
        <ul>
          {results.map((it, i) => (
            <li key={it.href} className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => open(it)}>
              <span className="p-icon"><Icon type={it.icon} size={17} /></span>
              <div>
                <b>{it.title}</b>
                <small>{it.sub}</small>
              </div>
              <em>{it.kind}</em>
            </li>
          ))}
          {!results.length && <li className="empty">Nothing matches “{q}”.</li>}
        </ul>
        <footer><kbd>↑↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close</footer>
      </div>
    </div>
  );
}
