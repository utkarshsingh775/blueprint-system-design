import { useEffect, useState } from 'react';
import { LLD_CASES, READY_LLD, lldById, loadLldCase } from '../data/lld/index.js';
import Icon from '../components/Icon.jsx';
import { Points, Quiz, DoneToggle } from '../components/Content.jsx';
import { CodeBlock, TextDiagram, Dialogue, Reveal, CorrectMe, Checklist } from '../components/Lld.jsx';
import { useProgress } from '../progress.js';

export const TIMELINE = [
  { from: 0, to: 15, name: 'Design / discussion', parts: [['0–5', 'Requirements + clarification'], ['5–10', 'Entities + responsibilities'], ['10–13', 'Relationships + interaction flow'], ['13–15', 'Patterns + class design + coding plan']] },
  { from: 15, to: 50, name: 'Coding + live explanation', parts: [['15–20', 'First domain classes'], ['20–30', 'Core business logic'], ['30–38', 'Interfaces / patterns'], ['38–45', 'Services / orchestration'], ['45–50', 'Main flow / testing']] },
  { from: 50, to: 60, name: 'Edge cases + follow-ups', parts: [['50–56', 'Edge cases / concurrency / failures'], ['56–60', 'Extensions + final summary']] },
];

const SECTIONS = [
  { id: 'prompt', label: 'Prompt', time: '0', from: 0, to: 0 },
  { id: 'requirements', label: 'Requirements', time: '0–5', from: 0, to: 5 },
  { id: 'entities', label: 'Entities', time: '5–10', from: 5, to: 10 },
  { id: 'relations', label: 'Relationships + flow', time: '10–13', from: 10, to: 13 },
  { id: 'patterns', label: 'Patterns + class design', time: '13–15', from: 13, to: 15 },
  { id: 'coding', label: 'Coding', time: '15–45', from: 15, to: 45 },
  { id: 'test', label: 'Test the hero flow', time: '45–50', from: 45, to: 50 },
  { id: 'edge', label: 'Edge cases', time: '50–56', from: 50, to: 56 },
  { id: 'extensions', label: 'Extensions', time: '56–60', from: 56, to: 60 },
  { id: 'summary', label: 'Cheat sheet', time: '60', from: 60, to: 61 },
  { id: 'check', label: 'Check yourself', time: '✓' },
];

const PRIORITY = ['Correct scope', 'Clear design', 'Strong domain model', 'Core business logic', 'Good abstractions', 'Relevant patterns', 'Edge cases', 'Extensibility', 'Extra features'];

export default function Lld({ id }) {
  return id ? <LldCase id={id} /> : <LldIndex />;
}

function LldIndex() {
  const p = useProgress();
  return (
    <div className="lld-index">
      <div className="page-head">
        <div className="eyebrow">Low-level design</div>
        <h1>Rehearse the 60 minutes, not just the answer.</h1>
        <p>Every case runs like the real interview: scope it, derive the objects, draw who owns what, then code in small blocks while you explain each decision. Switch to Interview mode to answer before you peek.</p>
      </div>

      <section className="panel">
        <h3 className="panel-title">The 60-minute structure every case follows</h3>
        <Timeline />
        <p className="note">Say → code → explain → code → explain. Never 30 minutes of silent coding.</p>
      </section>

      <section className="panel">
        <h3 className="panel-title">What the interviewer is scoring, in order</h3>
        <ol className="priority">
          {PRIORITY.map((x) => <li key={x}>{x}</li>)}
        </ol>
      </section>

      <div className="block-head"><h2>Case studies</h2><p>{READY_LLD.length} ready · {LLD_CASES.length - READY_LLD.length} coming next</p></div>
      <div className="case-grid">
        {LLD_CASES.map((c) =>
          c.upcoming ? (
            <div key={c.id} className="case-card upcoming">
              <div className="case-top"><span className="diff">Coming next</span></div>
              <h4>{c.title}</h4>
              <p>“{c.prompt}”</p>
            </div>
          ) : (
            <a key={c.id} className={`case-card ${p.done[c.id] ? 'done' : ''}`} href={`#/lld/${c.id}`}>
              <div className="case-top">
                <span className="case-icon"><Icon type={c.icon} size={20} /></span>
                <span className={`diff ${c.difficulty.toLowerCase()}`}>{c.difficulty}</span>
              </div>
              <h4>{c.title}</h4>
              <p>“{c.prompt}”</p>
              <div className="tags">{c.teaches.map((t) => <span key={t}>{t}</span>)}</div>
              {p.done[c.id] && <span className="done-badge">✓ Completed</span>}
            </a>
          )
        )}
      </div>
    </div>
  );
}

function Timeline({ minute }) {
  return (
    <div className="timeline">
      {TIMELINE.map((t) => (
        <div key={t.name} className={`tl-phase ${minute != null && minute >= t.from && minute < t.to ? 'now' : ''}`} style={{ flex: t.to - t.from }}>
          <b>{t.from}–{t.to} min</b>
          <span>{t.name}</span>
          <ul>{t.parts.map(([m, x]) => <li key={m}><em>{m}</em>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function PracticeTimer({ onMinute }) {
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((s) => Math.min(s + 1, 3600)), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => onMinute(running || secs ? secs / 60 : null), [secs, running, onMinute]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <div className="lld-timer">
      <span className="mono">{mm}:{ss}</span>
      <button className="btn ghost small" onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : secs ? 'Resume' : 'Start 60-min practice'}</button>
      {secs > 0 && <button className="btn ghost small" onClick={() => { setRunning(false); setSecs(0); }}>Reset</button>}
    </div>
  );
}

function useActiveSection(ready) {
  const [active, setActive] = useState('prompt');
  useEffect(() => {
    if (!ready) return;
    const io = new IntersectionObserver(
      (entries) => {
        const v = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (v[0]) setActive(v[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ready]);
  return active;
}

function Section({ id, time, title, children }) {
  return (
    <section id={id} className="case-section">
      <h2><span>{time}</span>{title}</h2>
      {children}
    </section>
  );
}

function LldCase({ id }) {
  const meta = lldById(id);
  const [c, setC] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem('blueprint.lldMode') || 'coach');
  const [minute, setMinute] = useState(null);
  const active = useActiveSection(!!c);

  useEffect(() => { loadLldCase(id).then(setC); }, [id]);
  useEffect(() => localStorage.setItem('blueprint.lldMode', mode), [mode]);

  if (!meta || meta.upcoming) return <div className="page-head"><h1>{meta ? `${meta.title} is coming next` : 'Case not found'}</h1><a href="#/lld">← All LLD cases</a></div>;
  if (!c) return <div className="page-loading"><span /></div>;

  const jump = (e, sid) => { e.preventDefault(); document.getElementById(sid)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const timerSection = minute == null ? null : SECTIONS.find((s) => s.to != null && minute >= s.from && minute < s.to)?.id;
  const R = c.requirements, E = c.entities, L = c.relations, P = c.patterns;
  const turns = (phase) => c.wrongTurns.filter((t) => t.phase === phase).map((t) => <CorrectMe key={t.ask} turn={t} />);

  let line = 1;
  const numbered = c.blocks.map((b) => {
    const start = line;
    line += b.code.replace(/^\n/, '').split('\n').length;
    return { ...b, start };
  });
  const coding = numbered.filter((b) => b.phase !== 'Test');
  const testBlock = numbered.find((b) => b.phase === 'Test');
  const total = c.blocks.map((b) => b.code).join('\n').split('\n').filter((l) => l.trim()).length;

  return (
    <div className={`case lld mode-${mode}`}>
      <header className="case-hero">
        <a className="crumb" href="#/lld">← LLD case studies</a>
        <div className="case-hero-row">
          <span className="case-hero-icon"><Icon type={meta.icon} size={30} /></span>
          <div>
            <h1>{meta.title}</h1>
            <p className="lede">A 60-minute LLD interview, rehearsed step by step. Java.</p>
          </div>
        </div>
        <div className="case-hero-meta">
          <span className={`diff ${meta.difficulty.toLowerCase()}`}>{meta.difficulty}</span>
          {meta.teaches.map((t) => <span key={t} className="tag">{t}</span>)}
          <span className="spacer" />
          <div className="seg">
            <button className={mode === 'coach' ? 'on' : ''} onClick={() => setMode('coach')}>Coach mode</button>
            <button className={mode === 'interview' ? 'on' : ''} onClick={() => setMode('interview')}>Interview mode</button>
          </div>
          <DoneToggle id={c.id} />
        </div>
        <p className="mode-hint">
          {mode === 'coach'
            ? 'Coach mode: every step is shown, with what to say, what to write and why.'
            : 'Interview mode: each step starts with the interviewer’s question. Answer it yourself first, then reveal the ideal answer.'}
        </p>
      </header>

      <div className="case-layout">
        <nav className="case-nav">
          <PracticeTimer onMinute={setMinute} />
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => jump(e, s.id)} className={`${active === s.id ? 'on' : ''} ${timerSection === s.id ? 'timer' : ''}`}>
              <span>{s.time}</span>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="case-main" key={mode}>
          <Section id="prompt" time="0" title="The interviewer’s prompt">
            <blockquote className="lld-prompt">“{c.prompt}”</blockquote>
            <p className="section-lede">{c.vague}</p>
          </Section>

          <Section id="requirements" time="0–5" title="Requirements + clarification">
            <Reveal mode={mode} id={`${c.id}:requirements`} ask={R.ask}>
              <Dialogue rows={R.dialogue} />
              <div className="req-grid">
                <div className="req-card"><h4>Functional requirements</h4><Points points={R.functional} /></div>
                <div className="req-card nf"><h4>Constraints that shape the design</h4><Points points={R.constraints} /></div>
              </div>
              <div className="big-idea"><b>Hero use case</b><p>{R.hero}</p></div>
              <div className="lld-two">
                <div>
                  <h4 className="lld-h">NFRs that actually matter</h4>
                  <table className="table nfr-table">
                    <tbody>{R.nfrs.map(([n, why]) => <tr key={n}><td className="accent">{n}</td><td>{why}</td></tr>)}</tbody>
                  </table>
                </div>
                <div>
                  <h4 className="lld-h">Parked for extensions</h4>
                  <div className="parked">{R.parked.map((x) => <span key={x}>{x}</span>)}</div>
                  <p className="note">Say: “Possible extensions would be …” and come back to them only after the core works.</p>
                </div>
              </div>
            </Reveal>
          </Section>

          <Section id="entities" time="5–10" title="Entities + responsibilities">
            <Reveal mode={mode} id={`${c.id}:entities`} ask={E.ask}>
              <p className="section-lede">Derive, don’t memorise: <b>nouns</b> → possible entities, <b>verbs</b> → methods, <b>rules</b> → business logic.</p>
              <h4 className="lld-h">1 · Nouns → which ones become classes?</h4>
              <div className="table-wrap">
                <table className="api-table lld-table nouns">
                  <colgroup><col style={{ width: '20%' }} /><col style={{ width: '20%' }} /><col /></colgroup>
                  <thead><tr><th>Noun in the prompt</th><th>Becomes</th><th>Why</th></tr></thead>
                  <tbody>{E.nouns.map(([n, v, why]) => <tr key={n}><td><b>{n}</b></td><td><span className={`verdict ${/not/i.test(v) ? 'no' : ''}`}>{v}</span></td><td>{why}</td></tr>)}</tbody>
                </table>
              </div>
              <h4 className="lld-h">2 · Verbs → methods</h4>
              <MapList rows={E.verbs} />
              <h4 className="lld-h">3 · Rules → where the rule lives</h4>
              <MapList rows={E.rules} />
              <h4 className="lld-h">4 · The classes you end up with</h4>
              <div className="class-cards">
                {E.list.map((e) => (
                  <div key={e.name} className="class-card">
                    <div className="class-card-head">
                      <code>{e.name}</code>
                      <span className={`kind k-${e.kind.split(' ')[0].toLowerCase()}`}>{e.kind}</span>
                    </div>
                    <p>{e.does}</p>
                    {e.attrs !== '—' && <div className="attrs">{e.attrs.split(', ').map((a) => <span key={a}>{a}</span>)}</div>}
                  </div>
                ))}
              </div>
              <TextDiagram title="Entity diagram · keep this beside you" text={E.diagram} />
              <Say text={E.say} />
            </Reveal>
            {turns('entities')}
          </Section>

          <Section id="relations" time="10–13" title="Relationships + hero flow">
            <Reveal mode={mode} id={`${c.id}:relations`} ask={L.ask}>
              <p className="section-lede">Two questions only: <b>who owns whom?</b> and <b>who is responsible for what?</b></p>
              <div className="rel-list">
                {L.rows.map((r) => (
                  <div key={r.from + r.to} className="rel">
                    <div className="rel-line">
                      <code>{r.from}</code>
                      <span className="rel-edge"><b>{r.card}</b><em>{r.kind}</em></span>
                      <code>{r.to}</code>
                    </div>
                    <p>{r.why}</p>
                  </div>
                ))}
              </div>
              <Say text={L.ownership} />
              <TextDiagram title="Hero flow · draw this before coding" text={L.heroFlow} />
              <div className="flow-notes">{L.notes.map(([k, v]) => <div key={k}><b>{k}</b><p>{v}</p></div>)}</div>
            </Reveal>
          </Section>

          <Section id="patterns" time="13–15" title="Patterns + class design + coding plan">
            <Reveal mode={mode} id={`${c.id}:patterns`} ask={P.ask}>
              <p className="section-lede">A pattern earns its place only by solving a problem in this design.</p>
              <div className="pattern-list">
                {P.rows.map((r) => (
                  <div key={r.name} className="pattern">
                    <h4>{r.name}</h4>
                    <p><b>Problem it solves:</b> {r.problem}</p>
                    <p><b>Where:</b> <code>{r.where}</code></p>
                    <Say text={r.say} />
                  </div>
                ))}
              </div>
              <h4 className="lld-h">Considered and deliberately not used</h4>
              <div className="table-wrap">
                <table className="api-table lld-table">
                  <colgroup><col style={{ width: '32%' }} /><col /></colgroup>
                  <thead><tr><th>Pattern</th><th>Why not here</th></tr></thead>
                  <tbody>{P.rejected.map(([n, why]) => <tr key={n}><td><b>{n}</b></td><td>{why}</td></tr>)}</tbody>
                </table>
              </div>
              <TextDiagram title="Class design · layers" text={P.layers} />
              <div className="table-wrap">
                <table className="api-table lld-table">
                  <colgroup><col style={{ width: '18%' }} /><col style={{ width: '30%' }} /><col /></colgroup>
                  <thead><tr><th>Layer</th><th>Class</th><th>Its only job</th></tr></thead>
                  <tbody>{P.roles.map(([l, cl, j]) => <tr key={l}><td className="accent-t">{l}</td><td><code>{cl}</code></td><td>{j}</td></tr>)}</tbody>
                </table>
              </div>
              <h4 className="lld-h">Coding plan</h4>
              <ol className="code-plan">{P.plan.map((x) => <li key={x}>{x}</li>)}</ol>
              <Say text={P.transition} label="Transition into coding" />
            </Reveal>
            {turns('patterns')}
          </Section>

          <Section id="coding" time="15–45" title="Coding + live explanation">
            <p className="section-lede">
              Say → code → explain, block by block. {total} lines of code in total, the size you can really write in 35 minutes. Line numbers continue across blocks, so together they form one runnable <code>Main.java</code>.
            </p>
            {coding.map((b, i) => <CodeStep key={b.title} b={b} n={i + 1} mode={mode} caseId={c.id} />)}
          </Section>

          <Section id="test" time="45–50" title="Test the hero flow">
            <CodeStep b={testBlock} n={coding.length + 1} mode={mode} caseId={c.id} />
            <div className="console">
              <div className="codeblock-bar"><span>Output · java Main</span></div>
              <pre>{c.test.output}</pre>
            </div>
            <Say text={c.test.say} />
          </Section>

          <Section id="edge" time="50–56" title="Edge cases, concurrency, failures">
            <Reveal mode={mode} id={`${c.id}:edge`} ask="What can go wrong, and how does your design handle it? What about concurrent requests?">
              <div className="edge-list">
                {c.edgeCases.map((e) => (
                  <div key={e.problem} className="edge-case">
                    <h4>{e.problem}</h4>
                    <p><em>Why it happens</em>{e.why}</p>
                    <p><em>How we handle it</em>{e.how}</p>
                    {e.hld && <p className="hld"><em>If they push to HLD</em>{e.hld}</p>}
                  </div>
                ))}
              </div>
            </Reveal>
          </Section>

          <Section id="extensions" time="56–60" title="Extensions (only after the core works)">
            <div className="ext-list">
              {c.extensions.map((x) => (
                <Reveal key={x.ask} mode={mode} id={`${c.id}:ext:${x.ask}`} ask={x.ask}>
                  <div className="ext">
                    {mode === 'coach' && <p className="ext-ask">{x.ask}</p>}
                    <div className="ext-row">
                      <div><em>Current</em>{x.current}</div>
                      <i>→</i>
                      <div><em>Extension</em>{x.next}</div>
                      <i>→</i>
                      <div><em>Design change</em>{x.change}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Section>

          <Section id="summary" time="60" title="Final cheat sheet">
            <div className="cheat">
              {[
                ['Problem', c.summary.problem],
                ['Requirements', c.summary.requirements],
                ['Entities', c.summary.entities],
                ['Relationships', c.summary.relationships],
                ['Hero flow', c.summary.heroFlow],
                ['Patterns', c.summary.patterns],
                ['Code order', c.summary.codeOrder],
                ['Edge cases', c.summary.edgeCases],
                ['Final summary', c.summary.final],
              ].map(([k, v], i, all) => (
                <div key={k} className="cheat-row">
                  <b>{k}</b>
                  <p>{v}</p>
                  {i < all.length - 1 && <i>↓</i>}
                </div>
              ))}
            </div>
            <div className="answer30">
              <b>Your 30-second final answer</b>
              <p>{c.answer30s}</p>
            </div>
          </Section>

          <Section id="check" time="✓" title="Check yourself">
            <h4 className="lld-h">Am I interview-ready on this one?</h4>
            <Checklist id={c.id} items={c.checklist} />
            <h4 className="lld-h">Why-questions</h4>
            <Quiz key={c.id} id={c.id} questions={meta.quiz} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function MapList({ rows }) {
  return (
    <div className="maplist">
      {rows.map(([left, right]) => (
        <div key={left} className="map-row">
          <span>{left}</span>
          <i>→</i>
          <code>{right}</code>
        </div>
      ))}
    </div>
  );
}

function Say({ text, label = 'What you say' }) {
  return (
    <blockquote className="say">
      <span>{label}</span>
      “{text}”
    </blockquote>
  );
}

function CodeStep({ b, n, mode, caseId }) {
  const lines = b.code.replace(/^\n/, '').split('\n').length;
  const body = (
    <>
      <Say text={b.say} />
      <CodeBlock code={b.code} startLine={b.start} label={b.inside ? `Java · continues inside ${b.inside}` : 'Java'} />
      <div className="explain">
        <span>Why this code exists</span>
        <p>{b.explain}</p>
        <em>{b.principle}</em>
      </div>
    </>
  );
  return (
    <div className="code-step">
      <div className="code-step-head">
        <span className="cs-n">{n}</span>
        <h3>{b.title}</h3>
        <span className="cs-phase">{b.phase}</span>
        <span className="cs-slot">{b.slot} min · {lines} lines</span>
      </div>
      <Reveal mode={mode} id={`${caseId}:block:${n}`} ask={`Write block ${n}: ${b.title}. What do you say while you write it?`}>
        {body}
      </Reveal>
    </div>
  );
}
