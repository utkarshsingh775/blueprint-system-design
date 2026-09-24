import { useMemo, useState } from 'react';
import { REFERENCES, REF_KINDS } from '../data/references.js';
import { CONCEPTS } from '../data/concepts.js';
import { CASES } from '../data/cases.js';

const TERMS = CONCEPTS.flatMap((c) => (c.terms || []).map(([term, def]) => ({ term, def, id: c.id, from: c.title })))
  .sort((a, b) => a.term.localeCompare(b.term));

export default function References() {
  const [q, setQ] = useState('');
  const usedBy = useMemo(() => {
    const map = {};
    for (const x of [...CONCEPTS.map((c) => ({ ...c, href: `#/learn/${c.id}` })), ...CASES.map((c) => ({ ...c, href: `#/cases/${c.id}` }))])
      for (const r of x.refs || []) (map[r] ||= []).push(x);
    return map;
  }, []);
  const terms = TERMS.filter((t) => !q || `${t.term} ${t.def}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="refs-page">
      <div className="page-head">
        <div className="eyebrow">References & glossary</div>
        <h1>The best material to go deeper.</h1>
        <p>Everything this site draws on — the classic books, the original papers, and engineering blogs from the companies that built these systems. Start with the two ★ books.</p>
      </div>

      {REF_KINDS.map((kind) => {
        const list = Object.entries(REFERENCES).filter(([, r]) => r.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="ref-section">
            <h3>{kind === 'Book' ? 'Books' : kind === 'Docs' ? 'Documentation' : `${kind}s`}</h3>
            <div className="ref-list">
              {list.map(([id, r]) => (
                <a key={id} href={r.url} target="_blank" rel="noopener noreferrer" className="ref">
                  <b>{['ddia', 'sdi1'].includes(id) ? '★ ' : ''}{r.title} ↗</b>
                  <small>{r.by}</small>
                  <p>{r.note}</p>
                  {usedBy[id] && <em>Used in: {usedBy[id].map((x) => x.title).join(' · ')}</em>}
                </a>
              ))}
            </div>
          </section>
        );
      })}

      <section className="ref-section" id="glossary">
        <div className="panel-row">
          <h3>Glossary <em className="q-count">{TERMS.length} terms</em></h3>
          <input className="gloss-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" />
        </div>
        <div className="terms">
          <table>
            <thead><tr><th>Term</th><th>What it means</th><th>Learn it in</th></tr></thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.term + t.id}>
                  <td>{t.term}</td>
                  <td>{t.def}</td>
                  <td><a href={`#/learn/${t.id}`}>{t.from} →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
