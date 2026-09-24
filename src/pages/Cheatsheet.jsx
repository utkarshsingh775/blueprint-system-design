import { useState } from 'react';
import { FRAMEWORK } from './Home.jsx';

const LATENCY = [
  ['L1 cache reference', 0.5],
  ['Branch mispredict', 5],
  ['L2 cache reference', 7],
  ['Mutex lock/unlock', 25],
  ['Main memory reference', 100],
  ['Compress 1 KB (Snappy)', 3000],
  ['Send 1 KB over 1 Gbps', 10000],
  ['Read 4 KB randomly from SSD', 150000],
  ['Read 1 MB sequentially from memory', 250000],
  ['Round trip within a datacenter', 500000],
  ['Read 1 MB sequentially from SSD', 1000000],
  ['Redis GET (over network)', 1000000],
  ['Disk seek (HDD)', 10000000],
  ['Read 1 MB sequentially from HDD', 20000000],
  ['Round trip US ↔ Europe', 150000000],
];

const human = (ns) => {
  const s = ns;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  if (s < 3600) return `${(s / 60).toFixed(0)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 365) return `${(s / 86400).toFixed(0)} days`;
  return `${(s / (86400 * 365)).toFixed(1)} years`;
};
const real = (ns) => (ns < 1000 ? `${ns} ns` : ns < 1e6 ? `${ns / 1000} µs` : `${ns / 1e6} ms`);

const POWERS = [
  ['2¹⁰', 'Thousand', '1 KB'],
  ['2²⁰', 'Million', '1 MB'],
  ['2³⁰', 'Billion', '1 GB'],
  ['2⁴⁰', 'Trillion', '1 TB'],
  ['2⁵⁰', 'Quadrillion', '1 PB'],
];

const NINES = [
  ['99%', '3.65 days', '7.2 hours', '14.4 min'],
  ['99.9%', '8.77 hours', '43.8 min', '1.44 min'],
  ['99.99%', '52.6 min', '4.38 min', '8.6 s'],
  ['99.999%', '5.26 min', '26.3 s', '0.86 s'],
];

const THROUGHPUT = [
  ['Web/app server (simple requests)', '1K – 10K req/s'],
  ['Redis / Memcached node', '100K+ ops/s'],
  ['PostgreSQL / MySQL primary', '~5K – 20K simple writes/s'],
  ['Cassandra node', '~10K – 50K writes/s'],
  ['Kafka broker', '~100K – 1M msgs/s'],
  ['WebSocket gateway', '~100K – 1M idle connections'],
];

const WHICH_DB = [
  ['Money, orders, inventory — needs transactions', 'Relational (PostgreSQL, MySQL)'],
  ['Massive writes, simple key access, time series', 'Wide-column (Cassandra, ScyllaDB)'],
  ['Single-digit-ms lookups at any scale, managed', 'Key-value (DynamoDB)'],
  ['Flexible JSON documents', 'Document (MongoDB)'],
  ['Hot data, counters, sessions, leaderboards', 'In-memory (Redis)'],
  ['Full-text search, faceted filters', 'Search index (Elasticsearch, OpenSearch)'],
  ['Relationships and traversals', 'Graph (Neo4j, Neptune)'],
  ['Images, video, backups', 'Object storage (S3, GCS)'],
  ['Analytics over billions of rows', 'Columnar warehouse (BigQuery, ClickHouse)'],
];

export default function Cheatsheet() {
  const [humanScale, setHumanScale] = useState(false);
  const maxLog = Math.log10(LATENCY[LATENCY.length - 1][1] / 0.5);

  return (
    <div className="cheat">
      <div className="page-head">
        <div className="eyebrow">Cheat sheet</div>
        <h1>The numbers and rules of thumb.</h1>
        <p>Everything you need for estimation and trade-off discussions, on one page.</p>
      </div>

      <section className="panel">
        <div className="panel-row">
          <h3 className="panel-title">Latency numbers every engineer should know</h3>
          <div className="seg">
            <button className={!humanScale ? 'on' : ''} onClick={() => setHumanScale(false)}>Real time</button>
            <button className={humanScale ? 'on' : ''} onClick={() => setHumanScale(true)}>Human scale (1 ns = 1 s)</button>
          </div>
        </div>
        <div className="latency">
          {LATENCY.map(([label, ns]) => (
            <div key={label} className="lat-row">
              <span className="lat-label">{label}</span>
              <div className="lat-bar">
                <i style={{ width: `${Math.max(1.5, (Math.log10(ns / 0.5) / maxLog) * 100)}%`, '--h': `${190 - (Math.log10(ns / 0.5) / maxLog) * 190}` }} />
              </div>
              <b>{humanScale ? human(ns) : real(ns)}</b>
            </div>
          ))}
        </div>
        <p className="note">Log scale. Memory is ~100× faster than SSD, which is ~100× faster than a cross-ocean round trip. Design so the common path touches memory, not disk or the network.</p>
      </section>

      <div className="cheat-grid">
        <section className="panel">
          <h3 className="panel-title">Estimation shortcuts</h3>
          <ul className="points">
            <li>1 day ≈ <b>86,400 s ≈ 10⁵ s</b></li>
            <li>1 million requests/day ≈ <b>12 req/s</b></li>
            <li>1 billion requests/day ≈ <b>12K req/s</b></li>
            <li>Peak ≈ <b>2–3×</b> average (10× for flash sales)</li>
            <li>Storage = writes/day × size × days × <b>3</b> (replicas)</li>
            <li>Cache ≈ <b>20%</b> of the daily read working set</li>
            <li>Characters: ASCII 1 B, UTF-8 up to 4 B; a UUID is 16 B, a tweet-sized post ~1 KB</li>
          </ul>
        </section>

        <section className="panel">
          <h3 className="panel-title">Availability (downtime allowed)</h3>
          <table className="table">
            <thead><tr><th>SLA</th><th>per year</th><th>per month</th><th>per day</th></tr></thead>
            <tbody>{NINES.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h3 className="panel-title">Powers of two</h3>
          <table className="table">
            <thead><tr><th>Power</th><th>≈ Value</th><th>Size</th></tr></thead>
            <tbody>{POWERS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h3 className="panel-title">Rough capacity per component</h3>
          <table className="table">
            <tbody>{THROUGHPUT.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="num">{r[1]}</td></tr>)}</tbody>
          </table>
          <p className="note">Orders of magnitude only — always depends on payload, hardware and query shape.</p>
        </section>
      </div>

      <section className="panel">
        <h3 className="panel-title">Which store when?</h3>
        <table className="table wide">
          <thead><tr><th>You need…</th><th>Reach for</th></tr></thead>
          <tbody>{WHICH_DB.map((r) => <tr key={r[0]}><td>{r[0]}</td><td className="accent">{r[1]}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="panel">
        <h3 className="panel-title">The 45-minute interview plan</h3>
        <div className="framework">
          {FRAMEWORK.map((f) => (
            <div key={f.n} className="fw-step">
              <span className="fw-n">{f.n}</span>
              <h4>{f.title}</h4>
              <em>{f.time}</em>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
        <ul className="points two-col">
          <li>Think out loud; state assumptions explicitly.</li>
          <li>Start simple, then scale the parts the numbers say will break.</li>
          <li>Every component should have a reason — say it.</li>
          <li>Name the trade-off for every choice (consistency vs availability, latency vs cost).</li>
          <li>Discuss failure: what if this node, region or dependency dies?</li>
          <li>Finish with monitoring, alerting and how you’d evolve the design.</li>
        </ul>
      </section>
    </div>
  );
}
