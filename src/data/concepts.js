export const TRACKS = [
  { id: 'foundations', name: 'Foundations', color: '#5ee1ff', blurb: 'The vocabulary and maths of scale.' },
  { id: 'scaling', name: 'Scaling reads & traffic', color: '#fbbf24', blurb: 'Spread load and serve it fast.' },
  { id: 'data', name: 'Data & storage', color: '#34d399', blurb: 'Where state lives and how it grows.' },
  { id: 'communication', name: 'Communication', color: '#a78bfa', blurb: 'How services talk to each other and to clients.' },
  { id: 'reliability', name: 'Reliability', color: '#fb7185', blurb: 'Keep working when things break.' },
  { id: 'distributed', name: 'Distributed systems', color: '#e879f9', blurb: 'Agreement, ordering and transactions across machines.' },
];

export const CONCEPTS = [
  // ------------------------------------------------ Foundations
  {
    id: 'scalability',
    track: 'foundations',
    title: 'Scalability',
    summary: 'The ability to handle more load by adding resources — ideally without redesigning the system.',
    sections: [
      { h: 'Vertical vs horizontal', points: ['**Vertical scaling (scale up):** a bigger machine. Simple, no code changes — but there’s a ceiling, it gets expensive fast, and it’s still a single point of failure.', '**Horizontal scaling (scale out):** more machines behind a load balancer. Nearly unlimited and fault-tolerant, but requires the application to be designed for it.'] },
      { h: 'Make services stateless', points: ['A stateless server keeps no user-specific data in memory between requests — sessions live in a shared store (Redis) or a signed token (JWT).', 'Any request can then go to any server, so you can add, remove or replace servers freely.', 'State doesn’t disappear — it moves into databases, caches and queues, which then become the scaling challenge.'] },
      { h: 'Where systems usually break first', points: ['The database (a single writer).', 'Hot keys — one celebrity, one viral product.', 'Synchronous chains of calls: the slowest dependency sets your latency.'] },
    ],
    tradeoffs: [{ choice: 'Scale up', pros: 'No code changes, strong consistency is easy.', cons: 'Hard limit; expensive; single point of failure.' }, { choice: 'Scale out', pros: 'Elastic, redundant, cheaper commodity hardware.', cons: 'Distributed-systems complexity: consistency, coordination, partial failure.' }],
    quiz: [
      { q: 'What makes a web server easy to scale horizontally?', options: ['A large amount of RAM', 'Being stateless', 'Using SQL', 'Running on bare metal'], answer: 1, why: 'Without per-user state in memory, any server can handle any request.' },
      { q: 'A drawback of vertical scaling is…', options: ['It needs a load balancer', 'It has a hard ceiling and remains a single point of failure', 'It requires sharding', 'It breaks transactions'], answer: 1, why: 'You can only buy so big a machine, and when it dies, everything dies.' },
    ],
  },
  {
    id: 'latency-throughput',
    track: 'foundations',
    title: 'Latency, throughput & percentiles',
    summary: 'How fast one request is, how many you can handle, and why averages lie.',
    sections: [
      { h: 'Definitions', points: ['**Latency:** time to complete one request (ms).', '**Throughput:** requests completed per unit of time (QPS/RPS).', 'They’re related but different: a pipeline can have high throughput *and* high latency.'] },
      { h: 'Why percentiles, not averages', points: ['The average hides the slowest users. Report **p50** (typical), **p95**, **p99** (the tail).', 'If a page fans out to 100 backend calls, the page’s p50 is roughly the backends’ **p99** — tail latency compounds with fan-out.', 'Fixes for tail latency: hedged requests (send a duplicate after the p95 time), timeouts, and fewer serial hops.'] },
      { h: 'Little’s law', points: ['**Concurrency = throughput × latency.** At 1,000 RPS and 200 ms latency, ~200 requests are in flight at once.', 'Useful for sizing thread pools, connection pools and queues.'] },
    ],
    quiz: [
      { q: 'Why is p99 latency more useful than average latency?', options: ['It’s easier to compute', 'It shows the experience of the slowest users, which averages hide', 'It is always lower', 'It measures throughput'], answer: 1, why: 'Averages are skewed by the fast majority; the tail is where users suffer.' },
      { q: 'By Little’s law, a service at 500 RPS with 100 ms latency has how many requests in flight?', options: ['5', '50', '500', '5,000'], answer: 1, why: '500 × 0.1 s = 50 concurrent requests.' },
    ],
  },
  {
    id: 'availability',
    track: 'foundations',
    title: 'Availability & the nines',
    summary: 'How to measure uptime and design out single points of failure.',
    sections: [
      { h: 'The nines', points: ['99% → 3.65 days of downtime a year.', '99.9% → 8.8 hours.', '99.99% → 52.6 minutes.', '99.999% → 5.3 minutes.', 'Each extra nine costs roughly 10× more effort.'] },
      { h: 'SLI, SLO, SLA', points: ['**SLI:** what you measure (success rate, p99 latency).', '**SLO:** your internal target (99.9% of requests succeed within 300 ms).', '**SLA:** the contract with customers, with penalties — always looser than the SLO.', '**Error budget:** 100% − SLO. Spend it on shipping features; when it’s gone, focus on reliability.'] },
      { h: 'Maths of dependencies', points: ['Components in **series** multiply: two 99.9% services in a chain → 99.8%.', 'Redundant components in **parallel**: two independent 99% replicas → 1 − 0.01² = 99.99%.', 'So: remove serial hard dependencies, and replicate everything that remains.'] },
    ],
    quiz: [
      { q: 'Two services each 99.9% available, both needed for a request. Overall availability?', options: ['99.9%', '≈99.8%', '99.99%', '100%'], answer: 1, why: 'In series availabilities multiply: 0.999 × 0.999 ≈ 0.998.' },
      { q: 'What is an error budget?', options: ['Money set aside for outages', 'The allowed unreliability (100% − SLO) that can be "spent"', 'Number of bugs allowed', 'Retry limit'], answer: 1, why: 'It turns reliability into a shared, quantifiable trade-off with feature velocity.' },
    ],
  },
  {
    id: 'estimation',
    track: 'foundations',
    title: 'Back-of-the-envelope estimation',
    summary: 'Rough numbers that decide the whole architecture — in two minutes.',
    sections: [
      { h: 'The recipe', points: ['Start with **DAU** and actions per user per day.', 'QPS = daily requests ÷ 86,400 (≈ 10⁵). Peak ≈ 2–3× average.', 'Storage = writes/day × bytes per write × retention × replication factor.', 'Bandwidth = QPS × response size.', 'Cache ≈ 20% of the daily read working set (the 80/20 rule).'] },
      { h: 'Handy numbers', points: ['1 day ≈ 86,400 s ≈ 10⁵ s. 1 year ≈ 3 × 10⁷ s.', '1M requests/day ≈ 12 RPS. 1B/day ≈ 12K RPS.', 'A single well-tuned server: roughly 1K–10K simple requests/s; Redis ~100K ops/s; a SQL primary a few thousand writes/s.'] },
      { h: 'What the numbers tell you', points: ['Reads ≫ writes? Cache and replicate.', 'Writes huge? Partition and use log-structured stores.', 'Storage in PB? Object storage and tiering.', 'Round aggressively — you want the order of magnitude, not decimals.'] },
    ],
    quiz: [
      { q: '100 million requests per day is roughly how many per second?', options: ['~120', '~1,200', '~12,000', '~120,000'], answer: 1, why: '10⁸ ÷ 10⁵ ≈ 1,000 — about 1,160/s.' },
      { q: 'A common rule of thumb for cache sizing?', options: ['Cache everything', 'Cache ~20% of the daily working set', 'Cache 1% of writes', 'Cache equals database size'], answer: 1, why: 'Access is skewed — 20% of items typically serve ~80% of reads.' },
    ],
  },

  // ------------------------------------------------ Scaling
  {
    id: 'load-balancing',
    track: 'scaling',
    title: 'Load balancing',
    summary: 'Distribute requests across many servers and route around the unhealthy ones.',
    sim: 'load-balancer',
    sections: [
      { h: 'Layer 4 vs layer 7', points: ['**L4 (transport):** routes TCP/UDP connections by IP and port. Very fast, protocol-agnostic, can’t see HTTP.', '**L7 (application):** understands HTTP — route by path, header or cookie; terminate TLS; retry; compress. More CPU, more power.'] },
      { h: 'Algorithms', points: ['**Round robin:** each server in turn. Great when requests and servers are uniform.', '**Least connections:** send to the least busy — handles uneven request costs.', '**Weighted:** bigger machines get more traffic.', '**Hash (IP / consistent hashing):** the same client or key always goes to the same server — useful for caches and sticky sessions.', '**Power of two choices:** pick two at random, use the less loaded — nearly as good as least-connections with no global state.'] },
      { h: 'Health checks & HA', points: ['Active checks (`GET /health` every few seconds) and passive checks (watch for errors) eject bad servers.', 'The load balancer itself must be redundant: an active/passive pair with a floating IP, or DNS across several LBs.'] },
    ],
    quiz: [
      { q: 'Which algorithm copes best when some requests are much slower than others?', options: ['Round robin', 'Least connections', 'Random', 'IP hash'], answer: 1, why: 'It accounts for in-flight work instead of just taking turns.' },
      { q: 'What can an L7 load balancer do that an L4 one cannot?', options: ['Handle TCP', 'Route based on the HTTP path or headers', 'Be faster', 'Balance UDP'], answer: 1, why: 'L7 parses the HTTP request, so it can route /api and /static differently.' },
    ],
  },
  {
    id: 'caching',
    track: 'scaling',
    title: 'Caching',
    summary: 'Keep hot data in fast memory. The hardest parts: invalidation and stampedes.',
    sim: 'cache',
    diagram: {
      spec: {
        nodes: [
          { id: 'app', type: 'service', label: 'App server', x: 0, y: 1 },
          { id: 'cache', type: 'cache', label: 'Cache', x: 1.6, y: 0 },
          { id: 'db', type: 'db', label: 'Database', x: 1.6, y: 2 },
        ],
        edges: [{ from: 'app', to: 'cache' }, { from: 'app', to: 'db' }, { from: 'cache', to: 'db', dashed: true }],
      },
      flows: [
        { id: 'aside', name: 'Cache-aside (read)', color: '#fbbf24', steps: [
          { from: 'app', to: 'cache', text: 'Look up the key in the cache.' },
          { from: 'app', to: 'db', text: '**Miss** → read from the database.' },
          { from: 'app', to: 'cache', text: 'Store the result with a TTL, then return it. The next read is a hit.' },
        ] },
        { id: 'through', name: 'Write-through', color: '#a78bfa', steps: [
          { from: 'app', to: 'cache', text: 'The app writes to the cache…' },
          { from: 'cache', to: 'db', text: '…which synchronously writes to the database before acknowledging. Always fresh, but every write pays both latencies.' },
        ] },
        { id: 'back', name: 'Write-back', color: '#fb7185', steps: [
          { from: 'app', to: 'cache', text: 'The write is acknowledged as soon as the cache has it — very fast.' },
          { from: 'cache', to: 'db', text: 'Dirty entries are flushed to the database later, in batches. Risk: a cache crash loses recent writes.' },
        ] },
      ],
    },
    sections: [
      { h: 'Where to cache', points: ['Client/browser → CDN → load balancer → application (in-process) → distributed cache (Redis) → database buffer pool.', 'The closer to the user, the faster — and the harder to invalidate.'] },
      { h: 'Strategies', points: ['**Cache-aside (lazy loading):** the app checks the cache, loads from the DB on a miss. Most common.', '**Read-through:** the cache itself loads from the DB on a miss.', '**Write-through:** writes go through the cache to the DB synchronously.', '**Write-back:** writes land in the cache and flush later — fast but risky.', '**Write-around:** writes go only to the DB; the cache fills on read.'] },
      { h: 'Eviction', points: ['**LRU:** evict the least recently used — the usual default.', '**LFU:** evict the least frequently used — better for stable popularity.', '**TTL:** expire after a fixed time — bounds staleness.'] },
      { h: 'The hard problems', points: ['**Invalidation:** delete (don’t update) the cache entry after a DB write, to avoid races.', '**Stampede / thundering herd:** a hot key expires and 10,000 requests hit the DB at once → request coalescing (single-flight), locks, or refresh-ahead before expiry.', '**Hot keys:** replicate the key across nodes or add a local in-process cache.'] },
    ],
    quiz: [
      { q: 'In cache-aside, what happens on a cache miss?', options: ['Return an error', 'The app reads the DB and populates the cache', 'The cache reads the DB automatically', 'The write is queued'], answer: 1, why: 'The application owns loading and filling the cache.' },
      { q: 'What prevents a cache stampede when a hot key expires?', options: ['Bigger TTLs only', 'Request coalescing / a lock so only one request rebuilds the value', 'More database replicas', 'LFU eviction'], answer: 1, why: 'One request recomputes; the others wait for (or get a stale copy of) the result.' },
      { q: 'The main risk of write-back caching is…', options: ['Slow writes', 'Losing recent writes if the cache fails', 'Stale reads', 'High DB load'], answer: 1, why: 'Data is only in the cache until it is flushed.' },
    ],
  },
  {
    id: 'cdn',
    track: 'scaling',
    title: 'CDNs & edge',
    summary: 'Serve content from servers physically close to users.',
    diagram: {
      spec: {
        nodes: [
          { id: 'user', type: 'client', label: 'User in Tokyo', x: 0, y: 1 },
          { id: 'edge', type: 'cdn', label: 'Tokyo edge', x: 1.5, y: 1 },
          { id: 'shield', type: 'cdn', label: 'Origin shield', sub: 'regional', x: 3, y: 1 },
          { id: 'origin', type: 'storage', label: 'Origin', sub: 'us-east', x: 4.5, y: 1 },
        ],
        edges: [{ from: 'user', to: 'edge' }, { from: 'edge', to: 'shield' }, { from: 'shield', to: 'origin' }],
      },
      flows: [
        { id: 'miss', name: 'First request (miss)', color: '#22d3ee', steps: [
          { from: 'user', to: 'edge', text: 'DNS/anycast routes the user to the nearest edge — ~5 ms away instead of ~150 ms.' },
          { from: 'edge', to: 'shield', text: 'Edge miss → ask the regional shield, which collapses misses from many edges.' },
          { from: 'shield', to: 'origin', text: 'Shield miss → fetch from origin once.' },
          { from: 'origin', to: 'shield', text: 'Response cached at the shield (respecting `Cache-Control`).' },
          { from: 'shield', to: 'edge', text: '…and at the edge.' },
          { from: 'edge', to: 'user', text: 'Delivered. Every later user in Tokyo gets it straight from the edge.' },
        ] },
        { id: 'hit', name: 'Next request (hit)', color: '#34d399', steps: [
          { from: 'user', to: 'edge', text: 'Request reaches the edge.' },
          { from: 'edge', to: 'user', text: '**Hit** — served locally in milliseconds. The origin never sees it.' },
        ] },
      ],
    },
    sections: [
      { h: 'What to put on a CDN', points: ['Static assets (JS, CSS, images, fonts) with content-hashed filenames and long TTLs.', 'Video segments and downloads.', 'Cacheable API responses (with short TTLs), and increasingly edge compute (auth checks, A/B routing).'] },
      { h: 'Pull vs push', points: ['**Pull:** the edge fetches from origin on first request. Easy; the first user pays the latency.', '**Push:** you upload content to the CDN ahead of time. Good for big, predictable content (a new film release).'] },
      { h: 'Invalidation', points: ['Prefer versioned URLs (`app.3f9a.js`) over purging — a new version is a new URL, so nothing stale is ever served.', 'Purge APIs exist but take seconds to propagate globally.'] },
    ],
    quiz: [
      { q: 'Why use content-hashed filenames for static assets?', options: ['SEO', 'They can be cached forever; a new version gets a new URL', 'Smaller files', 'Security'], answer: 1, why: 'Immutable URLs remove the need to invalidate.' },
      { q: 'What is an origin shield?', options: ['A firewall', 'A middle cache layer that collapses misses from many edges', 'A DDoS scrubber only', 'A backup origin'], answer: 1, why: 'It means the origin sees one request instead of one per edge.' },
    ],
  },
  {
    id: 'consistent-hashing',
    track: 'scaling',
    title: 'Consistent hashing',
    summary: 'Spread keys across servers so that adding or removing one moves only ~1/N of the keys.',
    sim: 'hashing',
    sections: [
      { h: 'The problem with modulo', points: ['`server = hash(key) % N` works — until N changes. Going from 4 to 5 servers remaps **~80%** of keys, flushing caches and triggering massive data movement.'] },
      { h: 'The ring', points: ['Hash both servers and keys onto the same circle (0 … 2³²).', 'Each key belongs to the **first server clockwise** from it.', 'Adding a server only takes keys from its clockwise neighbour: ~1/N of the keys move.'] },
      { h: 'Virtual nodes', points: ['With few servers, arcs are uneven and some servers get far more keys.', 'Give each physical server 100–200 **virtual nodes** scattered around the ring → load evens out, and a dead server’s keys spread across many survivors instead of one.', 'Used by Cassandra, DynamoDB, Riak, many CDNs and cache clients.'] },
    ],
    quiz: [
      { q: 'Roughly what fraction of keys move when adding one server to N with consistent hashing?', options: ['All of them', '~1/N', '~50%', 'None'], answer: 1, why: 'Only the keys in the new server’s arc move.' },
      { q: 'Why use virtual nodes?', options: ['Security', 'To balance load and spread a failed node’s keys across many servers', 'To reduce memory', 'For ordering'], answer: 1, why: 'Many small arcs per server even out the distribution.' },
    ],
  },

  // ------------------------------------------------ Data
  {
    id: 'sql-nosql',
    track: 'data',
    title: 'SQL vs NoSQL',
    summary: 'Choose the data model that fits your access patterns — not the hype.',
    sections: [
      { h: 'Relational (SQL)', points: ['Tables, schemas, joins, **ACID transactions**.', 'Great for complex queries and strong consistency: orders, payments, inventory.', 'Scales reads with replicas; scaling writes needs sharding, which is painful.'] },
      { h: 'NoSQL families', points: ['**Key-value** (Redis, DynamoDB): get/put by key; blazing fast.', '**Document** (MongoDB): JSON documents; flexible schema; nested data.', '**Wide-column** (Cassandra, HBase): massive write throughput; data modelled around queries.', '**Graph** (Neo4j): relationships as first-class — social graphs, fraud rings.'] },
      { h: 'How to choose', points: ['Start relational unless you know you need otherwise.', 'Pick NoSQL when: write volume exceeds one primary, access patterns are simple and known, the schema varies, or you need multi-region writes.', 'Many systems use both (polyglot persistence): SQL for money, NoSQL for timelines and events.'] },
    ],
    tradeoffs: [{ choice: 'SQL', pros: 'Transactions, joins, constraints, mature tooling.', cons: 'Harder to scale writes horizontally.' }, { choice: 'NoSQL', pros: 'Horizontal scale, flexible schemas, high write throughput.', cons: 'Limited queries/joins; often weaker consistency; you design tables per query.' }],
    quiz: [
      { q: 'Which is the best fit for a bank ledger?', options: ['A document store', 'A relational database with ACID transactions', 'A cache', 'A graph database'], answer: 1, why: 'Money needs atomic, consistent, durable transactions and constraints.' },
      { q: 'Wide-column stores like Cassandra excel at…', options: ['Complex joins', 'Very high write throughput with known query patterns', 'Graph traversal', 'Full-text search'], answer: 1, why: 'LSM-tree storage and partitioning make writes cheap and horizontally scalable.' },
    ],
  },
  {
    id: 'indexing',
    track: 'data',
    title: 'Indexes & storage engines',
    summary: 'B-trees, LSM-trees and why every index speeds up reads but slows down writes.',
    sections: [
      { h: 'Indexes', points: ['An index is a sorted structure that finds rows without scanning the whole table: O(log n) instead of O(n).', 'Composite indexes follow the leftmost-prefix rule: an index on `(user_id, created_at)` serves "by user" and "by user, sorted by time", but not "by time" alone.', 'Every index must be updated on every write — don’t index everything.'] },
      { h: 'B-tree (most SQL databases)', points: ['Updates pages in place. Excellent reads and range scans; writes are random I/O.'] },
      { h: 'LSM-tree (Cassandra, RocksDB)', points: ['Writes go to an in-memory table plus an append-only log, then flush to sorted immutable files merged in the background (compaction).', 'Very fast sequential writes; reads may check several files (Bloom filters help).'] },
    ],
    quiz: [
      { q: 'An index on (user_id, created_at) can efficiently serve which query?', options: ['WHERE created_at > X', 'WHERE user_id = 5 ORDER BY created_at', 'WHERE title = "a"', 'None'], answer: 1, why: 'The leftmost prefix (user_id) is used, and the rows are already sorted by created_at within it.' },
      { q: 'Why are LSM-trees fast for writes?', options: ['They skip durability', 'Writes are sequential appends, merged later', 'They have no indexes', 'They use RAM only'], answer: 1, why: 'Sequential I/O is much faster than random in-place page updates.' },
    ],
  },
  {
    id: 'replication',
    track: 'data',
    title: 'Replication',
    summary: 'Keep copies of data on several machines for availability and read scale.',
    sim: 'replication',
    sections: [
      { h: 'Leader–follower', points: ['All writes go to the leader, which streams changes to followers. Reads can go to followers.', '**Synchronous** replication: the leader waits for followers → no data loss, but slower and blocked if a follower is down.', '**Asynchronous**: fast, but followers lag, and a failover can lose the last writes.', 'Most setups: one sync follower + the rest async (semi-synchronous).'] },
      { h: 'Replication lag problems', points: ['**Read-your-writes:** a user updates their profile, reads a lagging follower, and sees the old one → read your own data from the leader for a short window.', '**Monotonic reads:** don’t let a user bounce between replicas at different lag → pin each user to one replica.'] },
      { h: 'Multi-leader & leaderless', points: ['**Multi-leader:** a leader per region — local writes, but conflicts must be resolved (last-write-wins, CRDTs).', '**Leaderless (Dynamo-style):** write to W of N replicas, read from R. If **R + W > N**, reads overlap the latest write (quorum).'] },
    ],
    quiz: [
      { q: 'A user updates their bio but sees the old one on refresh. The likely cause?', options: ['Cache stampede', 'Reading from a lagging async follower', 'Sharding', 'Rate limiting'], answer: 1, why: 'Async replication lag breaks read-your-writes consistency.' },
      { q: 'With N=3 replicas, which quorum guarantees reading the latest write?', options: ['W=1, R=1', 'W=2, R=2', 'W=1, R=2', 'W=3, R=0'], answer: 1, why: 'R + W = 4 > 3, so the read set always overlaps the write set.' },
    ],
  },
  {
    id: 'sharding',
    track: 'data',
    title: 'Sharding (partitioning)',
    summary: 'Split data across machines so each holds only part of it.',
    sections: [
      { h: 'Strategies', points: ['**Range:** by key range (A–F, G–M…). Range scans are easy; hot spots are likely (everyone signs up today).', '**Hash:** hash(key) mod N or consistent hashing. Even spread, but range queries hit every shard.', '**Directory:** a lookup service maps key → shard. Flexible, but it’s another component to keep up.', '**Geo/tenant:** by region or customer — also isolates failures.'] },
      { h: 'Choosing a shard key', points: ['High cardinality and even distribution.', 'Matches the dominant query: `user_id` if most queries are "this user’s data".', 'Avoid monotonically increasing keys (timestamps) with range sharding — every write hits the last shard.'] },
      { h: 'The costs', points: ['Cross-shard queries and joins become scatter-gather.', 'Cross-shard transactions need 2PC or sagas.', 'Resharding is expensive — pre-split into many logical shards (e.g. 4,096) mapped onto fewer physical nodes.', 'Hot keys (a celebrity) still overload one shard → split that key or add a cache.'] },
    ],
    quiz: [
      { q: 'Why is a timestamp a poor shard key for range sharding?', options: ['It’s too long', 'All new writes land on the same (latest) shard', 'It can’t be hashed', 'It’s not unique'], answer: 1, why: 'Monotonic keys concentrate writes on one hot partition.' },
      { q: 'What makes resharding cheaper?', options: ['Fewer, bigger shards', 'Many pre-split logical shards mapped to physical nodes', 'Using SQL', 'Turning off replication'], answer: 1, why: 'Moving whole logical shards between nodes avoids re-hashing every key.' },
    ],
  },
  {
    id: 'cap',
    track: 'data',
    title: 'CAP & PACELC',
    summary: 'During a network partition you must choose: consistency or availability.',
    sim: 'replication',
    sections: [
      { h: 'CAP', points: ['**C**onsistency (linearizability): every read sees the latest write.', '**A**vailability: every request to a live node gets a response.', '**P**artition tolerance: the system keeps working when the network splits.', 'Partitions *will* happen, so the real choice during one is **CP** (refuse some requests to stay correct) or **AP** (answer everything, possibly stale, reconcile later).'] },
      { h: 'Examples', points: ['CP: ZooKeeper, etcd, HBase, a bank ledger — better to reject than to be wrong.', 'AP: Cassandra, DynamoDB (default), DNS, shopping carts — better stale than down.'] },
      { h: 'PACELC', points: ['CAP only talks about partitions. **PACELC**: if **P**artitioned, choose **A** or **C**; **E**lse (normally), choose **L**atency or **C**onsistency.', 'Even without failures, strong consistency costs latency (waiting for replicas).'] },
    ],
    quiz: [
      { q: 'During a network partition, a CP system will…', options: ['Answer all requests with possibly stale data', 'Reject or block some requests to avoid inconsistency', 'Lose data', 'Automatically merge'], answer: 1, why: 'It sacrifices availability on the minority side to stay consistent.' },
      { q: 'What does the "ELC" in PACELC add?', options: ['Error handling', 'Even without partitions, there is a latency vs consistency trade-off', 'Encryption', 'Elasticity'], answer: 1, why: 'Synchronous replication costs latency every day, not just during failures.' },
    ],
  },
  {
    id: 'consistency-models',
    track: 'data',
    title: 'Consistency models',
    summary: 'From "always the latest" to "eventually the same" — and useful stops in between.',
    sections: [
      { h: 'Strong → weak', points: ['**Linearizable:** behaves like a single copy; reads always see the latest completed write.', '**Sequential:** everyone sees operations in the same order, though not necessarily in real time.', '**Causal:** effects are seen after their causes (a reply after the comment it answers).', '**Eventual:** if writes stop, replicas converge — eventually.'] },
      { h: 'Session guarantees (the practical middle)', points: ['**Read-your-writes:** you always see your own updates.', '**Monotonic reads:** you never see time go backwards.', '**Consistent prefix:** you never see an answer before its question.'] },
      { h: 'Picking one', points: ['Money, inventory, uniqueness (usernames): strong.', 'Likes, view counts, feeds: eventual is fine.', 'Social interactions: causal + read-your-writes gives a great experience cheaply.'] },
    ],
    quiz: [
      { q: 'Seeing a reply before the comment it responds to violates which model?', options: ['Eventual', 'Causal consistency', 'Availability', 'Durability'], answer: 1, why: 'Causality requires causes to be visible before their effects.' },
      { q: 'Which is fine for a "likes" counter?', options: ['Linearizable only', 'Eventual consistency', 'Two-phase commit', 'Serializable transactions'], answer: 1, why: 'A count that is briefly off by a few is harmless.' },
    ],
  },

  // ------------------------------------------------ Communication
  {
    id: 'apis',
    track: 'communication',
    title: 'API design: REST, gRPC, GraphQL',
    summary: 'How clients and services talk — and how to keep APIs evolvable.',
    sections: [
      { h: 'Styles', points: ['**REST:** resources + HTTP verbs, JSON, cacheable GETs. The default for public APIs.', '**gRPC:** binary Protobuf over HTTP/2, strongly typed, streaming. Ideal between internal services.', '**GraphQL:** clients ask for exactly the fields they need in one round trip — great for varied frontends; harder to cache and rate-limit.'] },
      { h: 'Good practices', points: ['Version your API (`/v1/`) and only add fields — never change their meaning.', 'Cursor pagination for large lists.', '**Idempotency** for unsafe operations: `PUT`/`DELETE` naturally, `POST` via an `Idempotency-Key` header.', 'Consistent errors with codes; `429` with `Retry-After` for rate limits.'] },
    ],
    quiz: [
      { q: 'Which protocol is most common for high-performance internal service calls?', options: ['SOAP', 'gRPC', 'FTP', 'GraphQL'], answer: 1, why: 'Binary encoding, HTTP/2 multiplexing and generated clients make gRPC fast and typed.' },
      { q: 'How do you make a POST /payments safe to retry?', options: ['Use GET instead', 'An Idempotency-Key header', 'A longer timeout', 'Use HTTP/2'], answer: 1, why: 'The server stores the result per key and returns it for repeats.' },
    ],
  },
  {
    id: 'realtime',
    track: 'communication',
    title: 'Real-time: polling, SSE & WebSockets',
    summary: 'How servers push updates to clients.',
    sections: [
      { h: 'Options', points: ['**Short polling:** ask every N seconds. Simple; wasteful and laggy.', '**Long polling:** the server holds the request open until there’s data. Works everywhere; one request per message.', '**Server-Sent Events (SSE):** a one-way stream from server to client over HTTP. Perfect for feeds, notifications, live scores.', '**WebSockets:** full-duplex, low-overhead — chat, multiplayer games, collaborative editing.'] },
      { h: 'Scaling persistent connections', points: ['Connections are stateful: you need a registry of which server holds which user.', 'Use L4 load balancing and generous timeouts; plan for reconnect storms (jittered backoff).', 'Fan-out between servers via pub/sub (Redis, Kafka).'] },
    ],
    quiz: [
      { q: 'Which is best for a live sports score feed where only the server sends data?', options: ['WebSockets only', 'Server-Sent Events', 'Short polling every 100 ms', 'Email'], answer: 1, why: 'SSE is a simple one-way stream over plain HTTP with automatic reconnection.' },
      { q: 'What is the main scaling challenge of WebSockets?', options: ['They are slow', 'Servers hold long-lived state per connection', 'They need UDP', 'They can’t be encrypted'], answer: 1, why: 'You must track where each connection lives and route messages to it.' },
    ],
  },
  {
    id: 'queues',
    track: 'communication',
    title: 'Message queues & event streams',
    summary: 'Decouple producers from consumers; absorb spikes; retry safely.',
    sim: 'queue',
    sections: [
      { h: 'Queue vs log', points: ['**Queue (SQS, RabbitMQ):** each message is processed by one consumer, then deleted. Work distribution.', '**Log/stream (Kafka, Kinesis):** messages are retained; many consumer groups read independently and can replay. Event-driven architectures and analytics.'] },
      { h: 'Delivery semantics', points: ['**At-most-once:** may lose messages, never duplicates.', '**At-least-once:** never lose, may duplicate → consumers must be **idempotent**. The practical default.', '**Exactly-once:** only within a closed system (e.g. Kafka transactions); end-to-end it’s "at-least-once + idempotency".'] },
      { h: 'Operational must-haves', points: ['**Dead-letter queue** for poison messages.', '**Backpressure:** monitor queue depth and consumer lag; autoscale consumers on it.', '**Ordering:** only guaranteed per partition — partition by the entity that needs order (e.g. order_id).'] },
    ],
    quiz: [
      { q: 'With at-least-once delivery, consumers must be…', options: ['Stateless', 'Idempotent', 'Synchronous', 'Single-threaded'], answer: 1, why: 'Duplicates will happen; processing twice must have the same effect as once.' },
      { q: 'Kafka guarantees ordering…', options: ['Globally', 'Within a partition', 'Never', 'Per consumer group only'], answer: 1, why: 'Choose the partition key so related events share a partition.' },
    ],
  },
  {
    id: 'microservices',
    track: 'communication',
    title: 'Microservices & API gateways',
    summary: 'Split a system by business capability — and pay the distributed-systems tax.',
    diagram: {
      spec: {
        nodes: [
          { id: 'client', type: 'mobile', label: 'Client', x: 0, y: 1.5 },
          { id: 'gw', type: 'gateway', label: 'API gateway', sub: 'auth · limits', x: 1.5, y: 1.5 },
          { id: 'disc', type: 'coord', label: 'Service registry', x: 1.5, y: 0 },
          { id: 'users', type: 'service', label: 'Users', x: 3, y: 0.3 },
          { id: 'orders', type: 'service', label: 'Orders', x: 3, y: 1.5 },
          { id: 'inv', type: 'service', label: 'Inventory', x: 3, y: 2.7 },
          { id: 'odb', type: 'db', label: 'Orders DB', x: 4.5, y: 1.5 },
        ],
        edges: [
          { from: 'client', to: 'gw' }, { from: 'gw', to: 'disc', dashed: true }, { from: 'gw', to: 'users' }, { from: 'gw', to: 'orders' },
          { from: 'orders', to: 'inv' }, { from: 'orders', to: 'odb' },
        ],
      },
      flows: [
        { id: 'req', name: 'Place an order', color: '#60a5fa', steps: [
          { from: 'client', to: 'gw', text: 'One public entry point. The gateway verifies the JWT, applies rate limits and routes by path.' },
          { from: 'gw', to: 'disc', text: '**Service discovery:** where are the healthy Orders instances right now?' },
          { from: 'gw', to: 'orders', text: 'Forward to Orders.' },
          { from: 'orders', to: 'inv', text: 'Orders calls Inventory to reserve stock — a network call that can fail or be slow, so it has a timeout, retries and a circuit breaker.' },
          { from: 'orders', to: 'odb', text: 'Each service owns its **own database**. No other service reads it directly.' },
        ] },
      ],
    },
    sections: [
      { h: 'Why split', points: ['Independent deploys and scaling per service.', 'Teams own services end to end (Conway’s law).', 'Fault isolation — if recommendations die, checkout still works.'] },
      { h: 'The tax', points: ['Every call is a network call: latency, partial failure, retries.', 'Data consistency across services needs sagas and events.', 'You need service discovery, tracing, centralised logging and good CI/CD.', 'Start with a modular monolith; extract services when a real scaling or team boundary appears.'] },
      { h: 'API gateway & BFF', points: ['The gateway centralises cross-cutting concerns: auth, TLS, rate limiting, routing, request aggregation.', '**Backend-for-frontend:** a thin gateway per client type (web, iOS) shaping responses for its screens.'] },
    ],
    quiz: [
      { q: 'A core rule of microservices data ownership?', options: ['Share one database', 'Each service owns its data; others go through its API', 'Use NoSQL only', 'Replicate every table everywhere'], answer: 1, why: 'Shared databases couple services and defeat independent deployment.' },
      { q: 'What does service discovery provide?', options: ['Encryption', 'The current network locations of healthy service instances', 'Logging', 'A database'], answer: 1, why: 'Instances come and go; a registry (or DNS) tracks them.' },
    ],
  },

  // ------------------------------------------------ Reliability
  {
    id: 'rate-limiting',
    track: 'reliability',
    title: 'Rate limiting',
    summary: 'Protect services from abuse and overload by capping request rates.',
    sim: 'rate-limiter',
    sections: [
      { h: 'Algorithms', points: ['**Token bucket:** tokens refill at rate r up to capacity b; each request takes a token. Allows short bursts. (Used by AWS, Stripe.)', '**Leaky bucket:** requests queue and drain at a constant rate — smooths traffic.', '**Fixed window:** count per clock minute. Simple, but allows 2× bursts at window edges.', '**Sliding window log/counter:** accurate rolling window; the counter version approximates with two fixed windows.'] },
      { h: 'Distributed limiting', points: ['Store counters in Redis with atomic `INCR` + `EXPIRE` or a Lua script.', 'For extreme scale, limit locally per node with a share of the global limit, and sync periodically.', 'Return `429 Too Many Requests` with `Retry-After` and `X-RateLimit-Remaining` headers.'] },
      { h: 'Where', points: ['At the edge / API gateway per API key or IP.', 'Per user and per endpoint (logins are stricter).', 'Also on outbound calls, to respect third-party quotas.'] },
    ],
    quiz: [
      { q: 'Which algorithm naturally allows short bursts?', options: ['Leaky bucket', 'Token bucket', 'Fixed window', 'None'], answer: 1, why: 'Accumulated tokens can be spent at once, up to the bucket capacity.' },
      { q: 'The weakness of fixed-window counters?', options: ['Too much memory', 'Up to 2× the limit at window boundaries', 'Can’t be distributed', 'Too slow'], answer: 1, why: 'A burst at the end of one window plus the start of the next doubles the effective rate.' },
    ],
  },
  {
    id: 'resilience',
    track: 'reliability',
    title: 'Timeouts, retries & circuit breakers',
    summary: 'Patterns that stop one failure from cascading through the whole system.',
    sections: [
      { h: 'Timeouts', points: ['Every network call needs one. Without it, a slow dependency ties up threads until everything stalls.', 'Set per call from the dependency’s p99 plus margin, within an overall request deadline that’s propagated downstream.'] },
      { h: 'Retries — carefully', points: ['Only retry **idempotent** operations (or use idempotency keys).', '**Exponential backoff with jitter:** 100 ms, 200 ms, 400 ms… ± randomness, so clients don’t retry in lockstep.', 'Retry budgets: cap retries at ~10% of traffic, or retries amplify an outage (retry storms).'] },
      { h: 'Circuit breaker', points: ['**Closed:** calls flow normally while failures are counted.', '**Open:** after too many failures, fail fast immediately (or use a fallback) — the dependency gets room to recover.', '**Half-open:** after a cool-down, let a few test calls through; close again if they succeed.'] },
      { h: 'Bulkheads & graceful degradation', points: ['Separate thread/connection pools per dependency, so one slow service can’t exhaust them all.', 'Degrade features instead of failing: show cached recommendations, hide reviews, queue the email.'] },
    ],
    quiz: [
      { q: 'Why add jitter to retry backoff?', options: ['Security', 'To stop many clients retrying at the same instant', 'To make retries faster', 'To log better'], answer: 1, why: 'Synchronised retries create waves of load that re-break the service.' },
      { q: 'In the open state, a circuit breaker…', options: ['Sends all traffic', 'Fails fast without calling the dependency', 'Retries forever', 'Restarts the service'], answer: 1, why: 'It stops piling more requests onto a failing dependency.' },
    ],
  },
  {
    id: 'observability',
    track: 'reliability',
    title: 'Observability',
    summary: 'Logs, metrics and traces: knowing what your system is doing.',
    sections: [
      { h: 'Three pillars', points: ['**Metrics:** cheap numeric time series — rates, errors, latency percentiles, saturation. Power dashboards and alerts.', '**Logs:** detailed structured events (JSON) for debugging specific requests.', '**Traces:** follow one request across services with a trace ID — shows where the time went.'] },
      { h: 'What to watch', points: ['**RED** for services: Rate, Errors, Duration.', '**USE** for resources: Utilisation, Saturation, Errors.', 'The **four golden signals**: latency, traffic, errors, saturation.'] },
      { h: 'Alerting', points: ['Alert on symptoms users feel (SLO burn rate), not on every CPU spike.', 'Every alert should be actionable and link to a runbook.'] },
    ],
    quiz: [
      { q: 'What tells you which service made a request slow?', options: ['A metric', 'A distributed trace', 'A log level', 'A health check'], answer: 1, why: 'A trace shows the timing of each hop for one request.' },
      { q: 'Good alerts are based on…', options: ['Every CPU spike', 'User-facing symptoms such as SLO burn rate', 'Disk usage only', 'Log volume'], answer: 1, why: 'Alert on what hurts users; investigate causes with dashboards.' },
    ],
  },

  // ------------------------------------------------ Distributed
  {
    id: 'consensus',
    track: 'distributed',
    title: 'Consensus & leader election',
    summary: 'How a group of machines agrees on one value — even when some fail.',
    sections: [
      { h: 'Why it matters', points: ['Electing a single leader, distributed locks, configuration, and "exactly one owner" for a shard all need agreement.', 'Doing it by hand fails in subtle ways (split brain: two leaders both accepting writes).'] },
      { h: 'Raft in one minute', points: ['Nodes are followers, candidates or the leader. The leader sends heartbeats.', 'No heartbeat before a randomised timeout → a follower becomes a candidate and requests votes for a new **term**.', 'A **majority** (quorum) of votes wins. With 5 nodes, 2 can fail and the cluster still works.', 'The leader appends commands to its log and commits an entry once a majority has stored it.'] },
      { h: 'In practice', points: ['Don’t implement it yourself — use etcd, ZooKeeper or Consul.', 'Use an odd number of nodes (3 or 5). More nodes = more fault tolerance but slower writes.', '**Fencing tokens** stop a paused old leader from doing damage after a new one is elected.'] },
    ],
    quiz: [
      { q: 'How many node failures can a 5-node Raft cluster tolerate?', options: ['1', '2', '3', '4'], answer: 1, why: 'A majority (3) must remain for a quorum.' },
      { q: 'What is "split brain"?', options: ['A cache miss', 'Two nodes both believing they are leader', 'A network outage', 'A slow disk'], answer: 1, why: 'Without proper consensus, a partition can create two leaders accepting conflicting writes.' },
    ],
  },
  {
    id: 'distributed-transactions',
    track: 'distributed',
    title: 'Distributed transactions: 2PC, sagas & outbox',
    summary: 'Keeping data consistent when one business action spans several services.',
    diagram: {
      spec: {
        nodes: [
          { id: 'orch', type: 'service', label: 'Order saga', sub: 'orchestrator', x: 0, y: 1.5 },
          { id: 'inv', type: 'service', label: 'Inventory', x: 1.7, y: 0.3 },
          { id: 'pay', type: 'service', label: 'Payments', x: 1.7, y: 1.5 },
          { id: 'ship', type: 'service', label: 'Shipping', x: 1.7, y: 2.7 },
        ],
        edges: [{ from: 'orch', to: 'inv' }, { from: 'orch', to: 'pay' }, { from: 'orch', to: 'ship' }],
      },
      flows: [
        { id: 'ok', name: 'Happy path', color: '#34d399', steps: [
          { from: 'orch', to: 'inv', text: 'Step 1: reserve stock (a local transaction in Inventory).' },
          { from: 'orch', to: 'pay', text: 'Step 2: charge the card.' },
          { from: 'orch', to: 'ship', text: 'Step 3: create the shipment. Done — each step committed locally.' },
        ] },
        { id: 'fail', name: 'Failure → compensate', color: '#fb7185', steps: [
          { from: 'orch', to: 'inv', text: 'Reserve stock ✓' },
          { from: 'orch', to: 'pay', text: 'Charge card ✗ — card declined.' },
          { from: 'orch', to: 'inv', text: '**Compensating action:** release the reserved stock. A saga never rolls back; it applies undo steps in reverse order.' },
        ] },
      ],
    },
    sections: [
      { h: 'Two-phase commit (2PC)', points: ['A coordinator asks every participant to **prepare** (lock and vote), then tells all to **commit**.', 'Atomic, but blocking: if the coordinator dies after prepare, participants wait with locks held.', 'Fine inside one database cluster; avoid across services and third parties.'] },
      { h: 'Sagas', points: ['A sequence of local transactions, each with a **compensating** transaction.', '**Orchestration:** a central coordinator drives the steps (easier to follow).', '**Choreography:** services react to each other’s events (looser coupling, harder to trace).', 'Intermediate states are visible — design for them ("payment pending").'] },
      { h: 'Transactional outbox', points: ['Problem: update your DB *and* publish an event — if you crash between them, they diverge.', 'Solution: write the event to an `outbox` table in the same DB transaction; a relay (or CDC like Debezium) publishes it.'] },
    ],
    quiz: [
      { q: 'How does a saga undo a partially completed action?', options: ['Global rollback', 'Compensating transactions run in reverse order', 'It can’t', 'Two-phase commit'], answer: 1, why: 'Each completed step has a semantic "undo" (refund, release stock).' },
      { q: 'The main drawback of 2PC is…', options: ['It’s eventually consistent', 'It blocks with locks held if the coordinator fails', 'It needs Kafka', 'It’s too fast'], answer: 1, why: 'Participants that voted "yes" can’t decide alone and must wait.' },
    ],
  },
  {
    id: 'id-generation',
    track: 'distributed',
    title: 'Unique ID generation',
    summary: 'Generate unique, ideally sortable, IDs across many machines without coordination.',
    sections: [
      { h: 'Options', points: ['**Auto-increment:** simple, but a single database becomes the bottleneck and single point of failure.', '**UUID v4:** 128 random bits, no coordination — but large, unsortable, and poor as a B-tree key (random inserts).', '**UUID v7 / ULID:** time-ordered prefix + randomness — sortable and index-friendly.', '**Snowflake (64 bits):** 41-bit timestamp · 10-bit machine ID · 12-bit sequence → 4,096 IDs per ms per machine, roughly time-sorted.', '**Ticket server / range allocation:** a central service hands out blocks of IDs.'] },
      { h: 'Watch out for', points: ['Clock skew/backwards jumps with timestamp-based IDs → refuse to generate until the clock catches up.', 'Assigning machine IDs uniquely (from ZooKeeper/etcd or config).', 'Exposing sequential IDs publicly leaks volume (competitors can count your orders).'] },
    ],
    quiz: [
      { q: 'Why are random UUIDv4s a poor primary key for B-tree indexes?', options: ['Too short', 'Random inserts scatter across pages, hurting write performance', 'Not unique', 'Can’t be stored'], answer: 1, why: 'Time-ordered IDs append to the "right edge" of the index instead.' },
      { q: 'How many IDs per millisecond can one Snowflake worker produce with a 12-bit sequence?', options: ['256', '1,024', '4,096', '65,536'], answer: 2, why: '2¹² = 4,096.' },
    ],
  },
];

export const conceptById = (id) => CONCEPTS.find((c) => c.id === id);
export const trackById = (id) => TRACKS.find((t) => t.id === id);

import { CONCEPT_EXTRA } from './explain.js';
for (const c of CONCEPTS) {
  const x = CONCEPT_EXTRA[c.id];
  if (x) Object.assign(c, { ...x, quiz: [...c.quiz, ...x.quiz] });
}
