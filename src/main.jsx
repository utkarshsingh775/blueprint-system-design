import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// After first paint, fetch every lazily loaded page and simulator so later navigation is instant.
setTimeout(() => {
  for (const load of [
    () => import('./pages/Learn.jsx'),
    () => import('./pages/CaseStudy.jsx'),
    () => import('./pages/Cases.jsx'),
    () => import('./pages/Lab.jsx'),
    () => import('./pages/Sandbox.jsx'),
    () => import('./pages/Cheatsheet.jsx'),
    () => import('./pages/Practice.jsx'),
    () => import('./pages/References.jsx'),
    () => import('./sims/LoadBalancerSim.jsx'),
    () => import('./sims/HashingSim.jsx'),
    () => import('./sims/CacheSim.jsx'),
    () => import('./sims/RateLimiterSim.jsx'),
    () => import('./sims/ReplicationSim.jsx'),
    () => import('./sims/QueueSim.jsx'),
  ])
    load().catch(() => {});
}, 1500);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
