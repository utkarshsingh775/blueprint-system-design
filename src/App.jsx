import { Suspense, lazy, useEffect, useState } from 'react';
import { useRoute } from './router.js';
import { useProgress } from './progress.js';
import { CONCEPTS } from './data/concepts.js';
import { CASES } from './data/cases.js';
import CommandPalette from './components/CommandPalette.jsx';
import Home from './pages/Home.jsx';

const Learn = lazy(() => import('./pages/Learn.jsx'));
const Cases = lazy(() => import('./pages/Cases.jsx'));
const CaseStudy = lazy(() => import('./pages/CaseStudy.jsx'));
const Lab = lazy(() => import('./pages/Lab.jsx'));
const Sandbox = lazy(() => import('./pages/Sandbox.jsx'));
const Cheatsheet = lazy(() => import('./pages/Cheatsheet.jsx'));
const Practice = lazy(() => import('./pages/Practice.jsx'));
const References = lazy(() => import('./pages/References.jsx'));

const NAV = [
  { href: '#/learn', section: 'learn', label: 'Learn' },
  { href: '#/cases', section: 'cases', label: 'Case studies' },
  { href: '#/lab', section: 'lab', label: 'Lab' },
  { href: '#/practice', section: 'practice', label: 'Practice' },
  { href: '#/sandbox', section: 'sandbox', label: 'Sandbox' },
  { href: '#/cheatsheet', section: 'cheatsheet', label: 'Cheat sheet' },
  { href: '#/references', section: 'references', label: 'References' },
];

function ProgressRing() {
  const p = useProgress();
  const total = CONCEPTS.length + CASES.length;
  const done = [...CONCEPTS, ...CASES].filter((x) => p.done[x.id]).length;
  const pct = done / total;
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <a className="progress-ring" href="#/learn" title={`${done} of ${total} topics complete`}>
      <svg width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r={r} className="track" />
        <circle cx="17" cy="17" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span>{Math.round(pct * 100)}%</span>
    </a>
  );
}

function Page({ route }) {
  switch (route.section) {
    case 'learn':
      return <Learn id={route.id} />;
    case 'cases':
      return route.id ? <CaseStudy id={route.id} /> : <Cases />;
    case 'lab':
      return <Lab id={route.id} />;
    case 'sandbox':
      return <Sandbox template={route.id} />;
    case 'cheatsheet':
      return <Cheatsheet />;
    case 'practice':
      return <Practice />;
    case 'references':
      return <References />;
    default:
      return <Home />;
  }
}

export default function App() {
  const route = useRoute();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setMenu(false), [route.path]);

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="8" height="7" rx="1.5" />
              <rect x="13" y="13" width="8" height="7" rx="1.5" />
              <path d="M11 7.5h3a2 2 0 0 1 2 2V13" />
            </svg>
          </span>
          Blueprint
        </a>
        <nav className={`nav ${menu ? 'open' : ''}`}>
          {NAV.map((n) => (
            <a key={n.section} href={n.href} className={route.section === n.section ? 'on' : ''}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="top-actions">
          <button className="search-btn" onClick={() => setPalette(true)}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <ProgressRing />
          <button className="menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu">☰</button>
        </div>
      </header>

      <main key={route.section + route.id} className="page">
        <Suspense fallback={<div className="page-loading"><span /></div>}>
          <Page route={route} />
        </Suspense>
      </main>

      <footer className="footer">
        Blueprint — learn system design by watching it run. Press <kbd>/</kbd> to search.
      </footer>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
