import { DAY, YEAR, num, bytes, bits, qps } from '../format.js';

export const CASES = [
  // ---------------------------------------------------------------- URL shortener
  {
    id: 'url-shortener',
    title: 'URL Shortener',
    tagline: 'Turn long links into 7-character codes and redirect billions of clicks.',
    difficulty: 'Easy',
    icon: 'external',
    tags: ['ID generation', 'Caching', 'Read-heavy', 'Base62'],
    functional: [
      'Create a short link for a long URL (optionally a custom alias).',
      'Redirect a short link to the original URL.',
      'Links can expire; owners can see click analytics.',
    ],
    nonFunctional: [
      'Redirects are extremely latency-sensitive: p99 < 50 ms.',
      'Very read-heavy (≈100 reads per write).',
      'Highly available — a dead link is worse than a slow link.',
      'Short codes must be unique and not guessable in sequence.',
    ],
    estimate: {
      inputs: [
        { key: 'writes', label: 'New links per day', value: 100e6, min: 1e6, max: 1e9, step: 1e6, fmt: num },
        { key: 'ratio', label: 'Reads per write', value: 100, min: 10, max: 1000, step: 10, fmt: num },
        { key: 'size', label: 'Bytes per record', value: 500, min: 100, max: 2000, step: 50, fmt: bytes },
        { key: 'years', label: 'Retention (years)', value: 5, min: 1, max: 10, step: 1, fmt: (v) => `${v} yrs` },
      ],
      outputs: (v) => {
        const w = v.writes / DAY;
        const r = w * v.ratio;
        const total = v.writes * 365 * v.years;
        return [
          { label: 'Write QPS', value: qps(w), hint: `peak ≈ ${qps(w * 3)}` },
          { label: 'Read QPS', value: qps(r), hint: `peak ≈ ${qps(r * 3)}` },
          { label: 'Total links', value: num(total), hint: `62⁷ ≈ 3.5T codes → 7 chars is ${total < 3.5e12 ? 'enough' : 'NOT enough'}` },
          { label: 'Storage', value: bytes(total * v.size), hint: 'before replication (×3)' },
          { label: 'Cache (hot 20%)', value: bytes(v.writes * v.ratio * 0.2 * v.size), hint: '80/20 rule on daily reads' },
          { label: 'Read bandwidth', value: bits(r * v.size * 8), hint: 'redirect responses are tiny' },
        ];
      },
    },
    api: [
      { method: 'POST', path: '/api/v1/urls', body: '{ longUrl, customAlias?, expiresAt? }', returns: '201 { shortUrl, code }' },
      { method: 'GET', path: '/{code}', returns: '302 Location: longUrl', note: '302 rather than 301 so every click reaches us for analytics.' },
      { method: 'GET', path: '/api/v1/urls/{code}/stats', returns: '200 { clicks, byCountry, byReferrer }' },
      { method: 'DELETE', path: '/api/v1/urls/{code}', returns: '204' },
    ],
    data: [
      {
        name: 'urls',
        store: 'Key-value / wide-column (DynamoDB, Cassandra)',
        fields: [['code', 'string · partition key'], ['long_url', 'string'], ['user_id', 'bigint'], ['created_at', 'timestamp'], ['expires_at', 'timestamp · TTL']],
        note: 'Every access is a point lookup by code — no joins — so a key-value store scales perfectly.',
      },
      {
        name: 'click_events',
        store: 'Kafka → columnar warehouse',
        fields: [['code', 'string'], ['ts', 'timestamp'], ['country', 'string'], ['referrer', 'string'], ['user_agent', 'string']],
      },
    ],
    diagram: {
      nodes: [
        { id: 'client', type: 'client', label: 'Users', x: 0, y: 2 },
        { id: 'lb', type: 'lb', label: 'Load balancer', x: 1.3, y: 2 },
        { id: 'api', type: 'service', label: 'URL service', sub: 'stateless', x: 2.6, y: 2, stack: true, note: 'Handles both create and redirect. Stateless, so it autoscales on CPU.' },
        { id: 'idgen', type: 'coord', label: 'ID allocator', sub: 'hands out ranges', x: 2.6, y: 0.4, note: 'Leases blocks of 1,000 IDs to each instance, so ID generation rarely needs a network call.' },
        { id: 'cache', type: 'cache', label: 'Redis cache', sub: 'hot codes', x: 4.1, y: 0.8 },
        { id: 'db', type: 'nosql', label: 'URL store', sub: 'Cassandra', x: 4.1, y: 2.2 },
        { id: 'stream', type: 'stream', label: 'Click stream', sub: 'Kafka', x: 2.6, y: 3.7 },
        { id: 'analytics', type: 'analytics', label: 'Analytics', sub: 'aggregates', x: 4.1, y: 3.7 },
      ],
      edges: [
        { from: 'client', to: 'lb' },
        { from: 'lb', to: 'api' },
        { from: 'api', to: 'idgen' },
        { from: 'api', to: 'cache' },
        { from: 'api', to: 'db' },
        { from: 'api', to: 'stream', dashed: true, label: 'async' },
        { from: 'stream', to: 'analytics' },
      ],
    },
    flows: [
      {
        id: 'create',
        name: 'Create a short link',
        color: '#a78bfa',
        steps: [
          { from: 'client', to: 'lb', text: 'The client sends `POST /api/v1/urls` with the long URL.' },
          { from: 'lb', to: 'api', text: 'The load balancer forwards it to any healthy URL-service instance — they are all identical and stateless.' },
          { from: 'api', to: 'idgen', text: 'The instance needs a unique ID. It **leases a range** (say 1,000 IDs) from the allocator, so 999 of the next 1,000 creates need no network call at all.' },
          { at: 'api', text: 'It encodes the 64-bit ID in **base62** (`a–z A–Z 0–9`). Seven characters give 62⁷ ≈ 3.5 trillion codes. IDs are shuffled with a bijective permutation so codes aren’t sequential and guessable.' },
          { from: 'api', to: 'db', text: 'It writes `{code, longUrl, userId, expiresAt}`. The code is the partition key, so writes spread evenly across the cluster.' },
          { from: 'api', to: 'lb', text: 'Responds `201 Created` with the short URL…' },
          { from: 'lb', to: 'client', text: '…and the user gets `https://sho.rt/aZ3kQ9x`. The cache isn’t written yet — it fills on first read (cache-aside).' },
        ],
      },
      {
        id: 'redirect',
        name: 'Redirect (read path)',
        color: '#5ee1ff',
        steps: [
          { from: 'client', to: 'lb', text: 'A browser requests `GET /aZ3kQ9x`.' },
          { from: 'lb', to: 'api', text: 'Routed to any instance.' },
          { from: 'api', to: 'cache', text: 'Check Redis first. Link popularity follows a power law, so a cache holding the top 20% of codes serves **>95% of reads** in under a millisecond.' },
          { from: 'api', to: 'db', text: 'On a cache miss, read from the store and write the result into the cache with a TTL. Unknown codes are cached too (negative caching) to stop repeated lookups for garbage.' },
          { from: 'api', to: 'stream', text: 'Emit a click event **asynchronously** — analytics must never slow the redirect.' },
          { from: 'api', to: 'client', text: 'Return `302 Found` with a `Location` header. A **301** would let browsers cache the redirect forever — faster, but you lose analytics and can’t change the destination.' },
          { from: 'stream', to: 'analytics', text: 'Stream consumers aggregate clicks by link, country and referrer into a warehouse for the stats page.' },
        ],
      },
    ],
    deepDives: [
      {
        title: 'Generating unique short codes',
        points: [
          '**Hash + truncate** (MD5 → first 7 chars): simple, but collisions must be detected and retried, costing a read per write.',
          '**Counter + base62**: guaranteed unique. A single counter is a bottleneck, so hand out ranges from a coordinator (ZooKeeper/etcd) or use Snowflake-style IDs (timestamp + machine + sequence).',
          '**Pre-generated key service**: generate random codes offline, store them in a "unused" table, and hand them out. No collisions at request time, but more moving parts.',
          'Sequential codes are guessable (enumeration attacks): shuffle the ID space with a reversible permutation before encoding.',
        ],
      },
      {
        title: '301 vs 302 redirects',
        points: [
          '**301 Moved Permanently**: browsers and proxies cache it — less load, lower latency, but no click analytics and the target can never change.',
          '**302 Found / 307**: every click reaches your servers. Most commercial shorteners use 302 because analytics is the product.',
        ],
      },
      {
        title: 'Expiry and cleanup',
        points: [
          'Use the store’s native TTL (Cassandra/DynamoDB) or check `expires_at` lazily on read.',
          'A low-priority batch job sweeps expired rows so codes can be recycled.',
        ],
      },
      {
        title: 'Abuse & safety',
        points: [
          'Rate-limit link creation per user/IP.',
          'Scan targets against malware/phishing lists (e.g. Google Safe Browsing) before creating links.',
          'Custom aliases need a uniqueness check with a conditional write (`INSERT IF NOT EXISTS`).',
        ],
      },
    ],
    tradeoffs: [
      { choice: 'NoSQL key-value store', pros: 'Linear horizontal scaling; point lookups are all we need.', cons: 'No ad-hoc queries; analytics must live elsewhere.' },
      { choice: 'Cache-aside', pros: 'Cache only holds data that is actually read.', cons: 'First read of every link is a miss; brief staleness after updates.' },
      { choice: 'Async analytics', pros: 'Redirect latency unaffected.', cons: 'Stats are seconds to minutes behind; events can be lost if not durably queued.' },
    ],
    bottlenecks: ['Hot links (a viral link can get millions of hits/min) → replicate hot keys or add a CDN/edge cache for redirects.', 'ID allocator is a single point of failure → run it as a replicated consensus group, and let services keep a buffer of IDs.'],
    quiz: [
      { q: 'Why do most URL shorteners respond with 302 instead of 301?', options: ['302 is faster', 'Browsers cache 301s, so clicks stop reaching the server (no analytics)', '301 is deprecated', '302 uses less bandwidth'], answer: 1, why: 'A 301 is cached by browsers, so subsequent clicks never hit the service — great for load, fatal for analytics.' },
      { q: 'How many base62 characters are needed for ~1 trillion unique codes?', options: ['5', '6', '7', '10'], answer: 2, why: '62⁶ ≈ 57 billion (too few); 62⁷ ≈ 3.5 trillion (enough).' },
      { q: 'What removes the single-counter bottleneck when generating IDs?', options: ['A bigger database', 'Handing out ID ranges to each server', 'Using UUIDs in the URL', 'Caching the counter'], answer: 1, why: 'Each server leases a block of IDs and allocates locally, touching the coordinator only once per block.' },
    ],
  },

  // ---------------------------------------------------------------- News feed
  {
    id: 'news-feed',
    title: 'News Feed (Twitter / X)',
    tagline: 'Deliver a personalised timeline built from everyone a user follows.',
    difficulty: 'Medium',
    icon: 'stream',
    tags: ['Fan-out', 'Timelines', 'Hybrid push/pull', 'Ranking'],
    functional: ['Publish a post (text, images, video).', 'View a home timeline of posts from followed accounts.', 'Follow / unfollow users.'],
    nonFunctional: ['Timeline loads in < 200 ms.', 'Eventual consistency is fine — a post may take a few seconds to appear.', 'Must handle celebrities with 100M+ followers.', 'Read-heavy: timelines are viewed far more often than posts are written.'],
    estimate: {
      inputs: [
        { key: 'dau', label: 'Daily active users', value: 300e6, min: 1e6, max: 2e9, step: 1e6, fmt: num },
        { key: 'posts', label: 'Posts per user per day', value: 0.5, min: 0.1, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) },
        { key: 'views', label: 'Timeline loads per user per day', value: 10, min: 1, max: 50, step: 1, fmt: num },
        { key: 'followers', label: 'Average followers', value: 200, min: 10, max: 2000, step: 10, fmt: num },
      ],
      outputs: (v) => {
        const p = (v.dau * v.posts) / DAY;
        return [
          { label: 'Post QPS', value: qps(p), hint: `peak ≈ ${qps(p * 3)}` },
          { label: 'Timeline reads', value: qps((v.dau * v.views) / DAY), hint: 'served from precomputed cache' },
          { label: 'Fan-out writes', value: qps(p * v.followers), hint: 'timeline inserts per second (push model)' },
          { label: 'Post storage / year', value: bytes(v.dau * v.posts * 365 * 1000), hint: '~1 KB per post, media separate' },
          { label: 'Timeline cache', value: bytes(v.dau * 800 * 8), hint: '800 post IDs × 8 B per active user' },
        ];
      },
    },
    api: [
      { method: 'POST', path: '/api/v1/posts', body: '{ text, mediaIds[] }', returns: '201 { postId }' },
      { method: 'GET', path: '/api/v1/feed?cursor=…&limit=20', returns: '200 { posts[], nextCursor }', note: 'Cursor pagination is stable while new posts arrive; offsets are not.' },
      { method: 'POST', path: '/api/v1/users/{id}/follow', returns: '204' },
    ],
    data: [
      { name: 'posts', store: 'Wide-column (Cassandra), keyed by author', fields: [['post_id', 'Snowflake id (time-sortable)'], ['author_id', 'bigint'], ['text', 'string'], ['media_urls', 'list'], ['created_at', 'timestamp']] },
      { name: 'follows', store: 'Graph / sharded SQL', fields: [['follower_id', 'bigint'], ['followee_id', 'bigint'], ['created_at', 'timestamp']], note: 'Indexed both ways: "who do I follow" and "who follows me".' },
      { name: 'timeline:{userId}', store: 'Redis list', fields: [['post_ids', 'list<bigint>, capped at ~800']] },
    ],
    diagram: {
      nodes: [
        { id: 'client', type: 'mobile', label: 'App', x: 0, y: 2 },
        { id: 'cdn', type: 'cdn', label: 'CDN', sub: 'images & video', x: 1.3, y: 0.3 },
        { id: 'lb', type: 'lb', label: 'Load balancer', x: 1.3, y: 2 },
        { id: 'post', type: 'service', label: 'Post service', x: 2.7, y: 1.1, stack: true },
        { id: 'feed', type: 'service', label: 'Feed service', x: 2.7, y: 3, stack: true },
        { id: 'posts', type: 'nosql', label: 'Posts store', sub: 'Cassandra', x: 4.2, y: 0.2 },
        { id: 'graph', type: 'db', label: 'Follow graph', x: 4.2, y: 1.3 },
        { id: 'fanq', type: 'stream', label: 'Fan-out queue', sub: 'Kafka', x: 4.2, y: 2.3 },
        { id: 'workers', type: 'worker', label: 'Fan-out workers', x: 5.6, y: 2.3, stack: true },
        { id: 'tl', type: 'cache', label: 'Timeline cache', sub: 'Redis lists', x: 4.2, y: 3.6 },
      ],
      edges: [
        { from: 'client', to: 'cdn' },
        { from: 'client', to: 'lb' },
        { from: 'lb', to: 'post' },
        { from: 'lb', to: 'feed' },
        { from: 'post', to: 'posts' },
        { from: 'post', to: 'fanq' },
        { from: 'fanq', to: 'workers' },
        { from: 'workers', to: 'graph', bend: 0.15 },
        { from: 'workers', to: 'tl', bend: -0.15 },
        { from: 'feed', to: 'tl' },
        { from: 'feed', to: 'posts', bend: -0.12 },
      ],
    },
    flows: [
      {
        id: 'publish',
        name: 'Publish a post (fan-out on write)',
        color: '#a78bfa',
        steps: [
          { from: 'client', to: 'lb', text: 'User publishes: `POST /posts`. Media was uploaded earlier straight to object storage, so only IDs travel now.' },
          { from: 'lb', to: 'post', text: 'Routed to the post service.' },
          { from: 'post', to: 'posts', text: 'Persist the post with a **Snowflake ID** — time-sortable, so "newest first" is just ID order.' },
          { from: 'post', to: 'fanq', text: 'Publish a `PostCreated` event and return `201` immediately. The author doesn’t wait for delivery to followers.' },
          { from: 'fanq', to: 'workers', text: 'Fan-out workers consume the event.' },
          { from: 'workers', to: 'graph', text: 'Fetch the author’s follower IDs, in pages.' },
          { from: 'workers', to: 'tl', text: 'Push the post ID onto every follower’s timeline list (`LPUSH` + `LTRIM 800`). One post from someone with 200 followers = 200 cheap cache writes. This is **fan-out on write**.' },
          { at: 'workers', text: '**Celebrity?** (> ~1M followers) Skip fan-out: one post would trigger millions of writes. Their posts are pulled in at read time instead — the **hybrid** model.' },
        ],
      },
      {
        id: 'read',
        name: 'Load the timeline',
        color: '#5ee1ff',
        steps: [
          { from: 'client', to: 'lb', text: '`GET /feed?cursor=…`' },
          { from: 'lb', to: 'feed', text: 'Routed to the feed service.' },
          { from: 'feed', to: 'tl', text: 'Read the precomputed list of post IDs — one O(1) cache read, no joins.' },
          { from: 'feed', to: 'posts', text: 'Merge in recent posts from followed celebrities (**fan-out on read**), then hydrate all IDs into full posts with a batched multi-get (itself cached).' },
          { at: 'feed', text: 'Rank (recency, engagement, affinity), then filter deleted posts, blocked users and muted words.' },
          { from: 'feed', to: 'lb', text: 'Return a page of 20 plus an opaque cursor.' },
          { from: 'lb', to: 'client', text: 'The timeline renders…' },
          { from: 'client', to: 'cdn', text: '…and images and video stream from the nearest CDN edge, never touching our servers.' },
        ],
      },
    ],
    deepDives: [
      {
        title: 'Push vs pull vs hybrid',
        points: [
          '**Push (fan-out on write)**: timelines precomputed → blazing-fast reads, but writes explode for users with many followers and are wasted on inactive users.',
          '**Pull (fan-out on read)**: build the timeline on demand from followees’ posts → cheap writes, but slow reads that hit many shards.',
          '**Hybrid**: push for normal users, pull for celebrities, and don’t precompute for users inactive for 30+ days. This is what Twitter did at scale.',
        ],
      },
      {
        title: 'Ranking',
        points: ['Stage 1: candidate generation (followed + recommended posts).', 'Stage 2: a lightweight model scores hundreds of candidates on engagement probability.', 'Stage 3: business rules — diversity, no repeats, freshness boosts.'],
      },
      {
        title: 'Pagination',
        points: ['Offset pagination breaks when new posts arrive (duplicates/skips).', 'Use a cursor: "posts with id < last_seen_id". Snowflake IDs make this trivial.'],
      },
    ],
    tradeoffs: [
      { choice: 'Precomputed timelines', pros: 'Reads are a single cache hit.', cons: 'Huge write amplification; lots of memory.' },
      { choice: 'Eventual consistency', pros: 'Fan-out can be async and retryable.', cons: 'Followers see posts seconds late; ordering can briefly differ between users.' },
    ],
    bottlenecks: ['Celebrity fan-out → hybrid model.', 'Hot posts (viral) → cache hydrated posts with replication across cache nodes.', 'Fan-out lag during spikes → autoscale workers on queue depth.'],
    quiz: [
      { q: 'Why not fan out a celebrity’s post to all their followers?', options: ['It violates privacy', 'One post would cause millions of timeline writes', 'Celebrities post too rarely', 'Caches can’t store their posts'], answer: 1, why: 'Write amplification: 100M followers = 100M inserts for a single post. Pull celebrity posts at read time instead.' },
      { q: 'What is the main benefit of fan-out on write?', options: ['Cheap writes', 'Fast timeline reads', 'Strong consistency', 'Less memory'], answer: 1, why: 'The timeline is precomputed, so a read is a single cache lookup.' },
      { q: 'Why use cursor-based pagination for feeds?', options: ['It’s more secure', 'Offsets shift as new posts arrive, causing duplicates or gaps', 'Cursors compress better', 'SQL doesn’t support OFFSET'], answer: 1, why: 'New items shift offsets; a cursor anchored on the last seen ID stays stable.' },
    ],
  },

  // ---------------------------------------------------------------- Chat
  {
    id: 'chat',
    title: 'Chat System (WhatsApp)',
    tagline: 'Real-time 1:1 and group messaging with delivery receipts, for billions.',
    difficulty: 'Medium',
    icon: 'ws',
    tags: ['WebSockets', 'Presence', 'Ordering', 'Offline delivery'],
    functional: ['1:1 and group messages (up to ~1,000 members).', 'Sent / delivered / read receipts.', 'Online presence and last-seen.', 'Messages delivered when the recipient comes back online; multi-device sync.'],
    nonFunctional: ['Real-time: < 200 ms delivery when both users are online.', 'No message loss; per-conversation ordering.', 'Hundreds of millions of concurrent connections.'],
    estimate: {
      inputs: [
        { key: 'dau', label: 'Daily active users', value: 500e6, min: 1e6, max: 2e9, step: 1e6, fmt: num },
        { key: 'msgs', label: 'Messages per user per day', value: 40, min: 1, max: 200, step: 1, fmt: num },
        { key: 'size', label: 'Bytes per message', value: 100, min: 50, max: 1000, step: 10, fmt: bytes },
        { key: 'conn', label: 'Connections per gateway', value: 100000, min: 10000, max: 1000000, step: 10000, fmt: num },
      ],
      outputs: (v) => {
        const m = (v.dau * v.msgs) / DAY;
        const concurrent = v.dau * 0.3;
        return [
          { label: 'Messages / sec', value: qps(m), hint: `peak ≈ ${qps(m * 3)}` },
          { label: 'Concurrent sockets', value: num(concurrent), hint: '~30% of DAU online at once' },
          { label: 'Gateway servers', value: num(Math.ceil(concurrent / v.conn)), hint: `at ${num(v.conn)} connections each` },
          { label: 'Storage / day', value: bytes(v.dau * v.msgs * v.size), hint: 'text only; media in object storage' },
          { label: 'Storage / year', value: bytes(v.dau * v.msgs * v.size * 365), hint: 'before replication' },
        ];
      },
    },
    api: [
      { method: 'WS', path: 'wss://chat.example.com/connect', returns: 'long-lived bidirectional socket', note: 'Frames: send, ack, delivered, read, typing, presence.' },
      { method: 'SEND', path: '{ type: "msg", convId, clientMsgId, body }', returns: '{ type: "ack", clientMsgId, serverMsgId, ts }' },
      { method: 'GET', path: '/api/v1/conversations/{id}/messages?after=…', returns: '200 { messages[] }', note: 'Used to sync after reconnecting.' },
    ],
    data: [
      { name: 'messages', store: 'Wide-column (Cassandra / HBase)', fields: [['conversation_id', 'partition key'], ['message_id', 'clustering key, time-ordered'], ['sender_id', 'bigint'], ['body', 'bytes (encrypted)'], ['ts', 'timestamp']], note: 'All messages of a conversation live together on one partition, sorted — "latest 50" is a single sequential read.' },
      { name: 'sessions', store: 'Redis', fields: [['user_id', 'key'], ['gateway_id', 'which server holds the socket'], ['last_heartbeat', 'timestamp · TTL']] },
      { name: 'inbox cursors', store: 'Key-value', fields: [['user_id + device', 'key'], ['last_delivered_id', 'bigint']] },
    ],
    diagram: {
      nodes: [
        { id: 'alice', type: 'mobile', label: 'Alice', x: 0, y: 0.5 },
        { id: 'bob', type: 'mobile', label: 'Bob', x: 0, y: 3.5 },
        { id: 'lb', type: 'lb', label: 'L4 load balancer', x: 1.2, y: 2 },
        { id: 'gw1', type: 'ws', label: 'Gateway 1', sub: "Alice's socket", x: 2.5, y: 0.5 },
        { id: 'gw2', type: 'ws', label: 'Gateway 2', sub: "Bob's socket", x: 2.5, y: 3.5 },
        { id: 'chat', type: 'service', label: 'Message service', x: 3.9, y: 2, stack: true },
        { id: 'sessions', type: 'cache', label: 'Session registry', sub: 'user → gateway', x: 3.9, y: 0.5 },
        { id: 'store', type: 'nosql', label: 'Message store', sub: 'Cassandra', x: 5.3, y: 2 },
        { id: 'push', type: 'worker', label: 'Push service', x: 3.9, y: 3.5 },
        { id: 'apns', type: 'external', label: 'APNs / FCM', x: 5.3, y: 3.5 },
      ],
      edges: [
        { from: 'alice', to: 'lb' },
        { from: 'bob', to: 'lb' },
        { from: 'lb', to: 'gw1' },
        { from: 'lb', to: 'gw2' },
        { from: 'alice', to: 'gw1', dashed: true, label: 'socket' },
        { from: 'bob', to: 'gw2', dashed: true, label: 'socket' },
        { from: 'gw1', to: 'chat' },
        { from: 'gw2', to: 'chat' },
        { from: 'gw1', to: 'sessions' },
        { from: 'chat', to: 'sessions' },
        { from: 'chat', to: 'store' },
        { from: 'chat', to: 'push' },
        { from: 'push', to: 'apns' },
      ],
    },
    flows: [
      {
        id: 'connect',
        name: 'Connect',
        color: '#818cf8',
        steps: [
          { from: 'alice', to: 'lb', text: 'Alice opens the app, which opens a **WebSocket** (`wss://`). HTTP polling would waste battery and add latency.' },
          { from: 'lb', to: 'gw1', text: 'A layer-4 load balancer pins the TCP connection to one gateway. Gateways are optimised to hold ~100K idle sockets each.' },
          { from: 'gw1', to: 'sessions', text: 'The gateway records `alice → gateway-1` in the session registry, with a TTL refreshed by heartbeats every ~30 s. No heartbeat → the entry expires → Alice is offline.' },
        ],
      },
      {
        id: 'online',
        name: 'Send (Bob online)',
        color: '#5ee1ff',
        steps: [
          { from: 'alice', to: 'gw1', text: 'Alice sends `{convId, clientMsgId, body}` over her open socket. The **client-generated ID** makes retries idempotent — resending never creates duplicates.' },
          { from: 'gw1', to: 'chat', text: 'The gateway forwards it to the message service.' },
          { from: 'chat', to: 'store', text: '**Persist first.** Write to the conversation’s partition with a time-ordered message ID. Only once it’s durable do we acknowledge.' },
          { from: 'chat', to: 'gw1', text: 'Ack back to Alice’s gateway…' },
          { from: 'gw1', to: 'alice', text: '…Alice sees a single tick ✓ (sent).' },
          { from: 'chat', to: 'sessions', text: 'Where is Bob? The registry says **gateway-2**.' },
          { from: 'chat', to: 'gw2', text: 'Route the message to gateway-2 (direct RPC or via a pub/sub channel per gateway).' },
          { from: 'gw2', to: 'bob', text: 'Pushed down Bob’s socket. His app acks, and the ack flows back to Alice: ✓✓ delivered.' },
        ],
      },
      {
        id: 'offline',
        name: 'Send (Bob offline)',
        color: '#fb923c',
        steps: [
          { from: 'alice', to: 'gw1', text: 'Alice sends a message.' },
          { from: 'gw1', to: 'chat', text: 'Forwarded as before.' },
          { from: 'chat', to: 'store', text: 'Persisted — the message is safe even though Bob is away.' },
          { from: 'chat', to: 'sessions', text: 'No live session for Bob (heartbeat TTL expired).' },
          { from: 'chat', to: 'push', text: 'Hand off to the push service.' },
          { from: 'push', to: 'apns', text: 'Send a push notification via Apple/Google. Content is often omitted or encrypted — the providers are untrusted.' },
          { from: 'apns', to: 'bob', text: 'Bob’s phone wakes. The app reconnects and **syncs**: "give me every message after my last delivered ID", then acks.' },
        ],
      },
    ],
    deepDives: [
      {
        title: 'Ordering messages',
        points: ['Global ordering is impossible and unnecessary — you only need order **within a conversation**.', 'Use a per-conversation sequence number or a time-sortable ID assigned by the message service.', 'Clients sort by server ID and show a local "pending" state until the ack arrives.'],
      },
      {
        title: 'Group chats',
        points: ['Small groups (≤ a few hundred): fan out a copy to each member’s inbox on write — simple and fast to read.', 'Very large groups/channels: store once and let members pull, like the celebrity problem in feeds.'],
      },
      {
        title: 'Presence at scale',
        points: ['Don’t broadcast every status change to every contact — that’s O(contacts) per event.', 'Publish presence lazily: only to users currently viewing the chat, and batch/throttle updates.'],
      },
      { title: 'End-to-end encryption', points: ['The Signal protocol encrypts on the device; servers only store ciphertext.', 'Each device has its own keys, so multi-device means encrypting once per recipient device.'] },
    ],
    tradeoffs: [
      { choice: 'WebSockets', pros: 'Real-time, bidirectional, low overhead per message.', cons: 'Stateful servers are harder to deploy and balance; reconnect storms after an outage.' },
      { choice: 'Persist before delivering', pros: 'No message loss even if a gateway crashes mid-delivery.', cons: 'Adds a database write to the delivery latency.' },
    ],
    bottlenecks: ['Reconnect storm after a gateway dies → jittered exponential backoff on clients.', 'Hot conversation partitions (huge groups) → bucket partitions by time window.'],
    quiz: [
      { q: 'Why include a client-generated message ID?', options: ['For encryption', 'To make retries idempotent (no duplicate messages)', 'To sort messages globally', 'To route to the right gateway'], answer: 1, why: 'If the ack is lost and the client resends, the server recognises the ID and doesn’t store it twice.' },
      { q: 'How does the system know which server holds Bob’s connection?', options: ['It broadcasts to all gateways', 'A session registry maps user → gateway', 'DNS lookup', 'The load balancer remembers'], answer: 1, why: 'Gateways register each connection in a fast registry (e.g. Redis) with a heartbeat TTL.' },
      { q: 'What ordering guarantee is typically provided?', options: ['Global total order', 'Per-conversation order', 'No ordering', 'Per-user order across all chats'], answer: 1, why: 'Ordering within a conversation is what users perceive; global order would need a global sequencer.' },
    ],
  },

  // ---------------------------------------------------------------- Video streaming
  {
    id: 'video-streaming',
    title: 'Video Streaming (YouTube / Netflix)',
    tagline: 'Upload, transcode and stream video to hundreds of millions of screens.',
    difficulty: 'Hard',
    icon: 'cdn',
    tags: ['Transcoding', 'CDN', 'Adaptive bitrate', 'Object storage'],
    functional: ['Upload videos (up to several GB).', 'Watch videos smoothly on any device and network.', 'Search, recommendations, likes and comments (out of scope here).'],
    nonFunctional: ['Playback starts in < 2 s; minimal rebuffering.', 'Uploads are resumable and processed within minutes.', 'Egress bandwidth dominates cost — optimise delivery above all else.'],
    estimate: {
      inputs: [
        { key: 'dau', label: 'Daily active viewers', value: 100e6, min: 1e6, max: 2e9, step: 1e6, fmt: num },
        { key: 'watch', label: 'Minutes watched per viewer per day', value: 40, min: 5, max: 180, step: 5, fmt: (v) => `${v} min` },
        { key: 'bitrate', label: 'Average bitrate (Mbps)', value: 3, min: 0.5, max: 15, step: 0.5, fmt: (v) => `${v} Mbps` },
        { key: 'uploads', label: 'Uploads per day', value: 500000, min: 10000, max: 5e6, step: 10000, fmt: num },
        { key: 'raw', label: 'Average upload size (MB)', value: 300, min: 50, max: 4000, step: 50, fmt: (v) => `${v} MB` },
      ],
      outputs: (v) => {
        const egressBits = (v.dau * v.watch * 60 * v.bitrate * 1e6) / DAY;
        const rawDay = v.uploads * v.raw * 1e6;
        return [
          { label: 'Average egress', value: bits(egressBits), hint: `peak ≈ ${bits(egressBits * 3)} — why CDNs exist` },
          { label: 'Data served / day', value: bytes((egressBits / 8) * DAY), hint: 'mostly from CDN edges' },
          { label: 'Upload ingest / day', value: bytes(rawDay), hint: `${qps(v.uploads / DAY)} uploads` },
          { label: 'Storage / year', value: bytes(rawDay * 3 * 365), hint: '×3 for all renditions' },
        ];
      },
    },
    api: [
      { method: 'POST', path: '/api/v1/uploads', body: '{ filename, size, contentType }', returns: '200 { uploadId, presignedUrls[] }', note: 'The client uploads chunks straight to object storage.' },
      { method: 'POST', path: '/api/v1/uploads/{id}/complete', returns: '202 { videoId, status: "PROCESSING" }' },
      { method: 'GET', path: '/api/v1/videos/{id}', returns: '200 { title, manifestUrl, thumbnails }' },
      { method: 'GET', path: 'https://cdn…/{id}/720p/seg_00042.m4s', returns: 'a 4-second video segment' },
    ],
    data: [
      { name: 'videos', store: 'SQL (sharded by video_id)', fields: [['video_id', 'PK'], ['owner_id', 'bigint'], ['title', 'string'], ['status', 'UPLOADING | PROCESSING | READY'], ['duration', 'int'], ['renditions', 'json']] },
      { name: 'blobs', store: 'Object storage', fields: [['raw/{videoId}', 'original upload'], ['hls/{videoId}/{rendition}/seg_N', 'encoded segments'], ['hls/{videoId}/master.m3u8', 'manifest']] },
    ],
    diagram: {
      nodes: [
        { id: 'creator', type: 'client', label: 'Creator', x: 0, y: 0.6 },
        { id: 'viewer', type: 'client', label: 'Viewer', x: 0, y: 3.4 },
        { id: 'upload', type: 'service', label: 'Upload service', x: 1.5, y: 0.6 },
        { id: 'raw', type: 'storage', label: 'Raw uploads', sub: 'S3', x: 3, y: 0.6 },
        { id: 'tq', type: 'queue', label: 'Transcode jobs', x: 3, y: 1.9 },
        { id: 'trans', type: 'worker', label: 'Transcoders', sub: 'per-segment', x: 4.5, y: 1.9, stack: true },
        { id: 'enc', type: 'storage', label: 'Encoded segments', sub: 'HLS / DASH', x: 4.5, y: 0.6 },
        { id: 'api', type: 'service', label: 'Video API', x: 1.5, y: 2.6 },
        { id: 'meta', type: 'db', label: 'Metadata DB', x: 3, y: 3.4 },
        { id: 'cdn', type: 'cdn', label: 'CDN edge', sub: 'near viewer', x: 4.5, y: 3.4 },
      ],
      edges: [
        { from: 'creator', to: 'upload' },
        { from: 'upload', to: 'tq', bend: 0.1 },
        { from: 'upload', to: 'meta', bend: -0.25, dashed: true },
        { from: 'creator', to: 'raw', bend: 0.18 },
        { from: 'tq', to: 'trans' },
        { from: 'trans', to: 'raw' },
        { from: 'trans', to: 'enc' },
        { from: 'trans', to: 'meta' },
        { from: 'viewer', to: 'api' },
        { from: 'api', to: 'meta' },
        { from: 'viewer', to: 'cdn', bend: 0.14 },
        { from: 'cdn', to: 'enc', bend: -0.25 },
      ],
    },
    flows: [
      {
        id: 'upload',
        name: 'Upload & transcode',
        color: '#a78bfa',
        steps: [
          { from: 'creator', to: 'upload', text: 'The creator asks to upload. The service returns **pre-signed URLs** — temporary permission to write straight into object storage.' },
          { from: 'creator', to: 'raw', text: 'The client uploads the file in 5–10 MB chunks directly to S3. Uploads are **resumable** (failed chunks are retried) and our servers never touch the bytes.' },
          { from: 'upload', to: 'meta', text: 'A video row is created with status `PROCESSING`.' },
          { from: 'upload', to: 'tq', text: 'A transcode job is enqueued.' },
          { from: 'tq', to: 'trans', text: 'Workers pick up the job. The video is split into ~4-second segments, transcoded **in parallel** across many machines (a DAG of tasks).' },
          { from: 'trans', to: 'raw', text: 'Read the source.' },
          { at: 'trans', text: 'Encode each segment into a **bitrate ladder** — 240p up to 4K — in several codecs (H.264 for compatibility, VP9/AV1 for ~30–50% smaller files). Also: thumbnails, captions, content-ID checks.' },
          { from: 'trans', to: 'enc', text: 'Write segments plus HLS/DASH **manifests** (playlists listing every rendition and segment).' },
          { from: 'trans', to: 'meta', text: 'Mark the video `READY`. Subscribers can now be notified.' },
        ],
      },
      {
        id: 'watch',
        name: 'Watch',
        color: '#5ee1ff',
        steps: [
          { from: 'viewer', to: 'api', text: 'The player requests video metadata: `GET /videos/{id}`.' },
          { from: 'api', to: 'meta', text: 'Look up the title, status and manifest URL (heavily cached).' },
          { from: 'api', to: 'viewer', text: 'Return the manifest URL, pointing at the CDN.' },
          { from: 'viewer', to: 'cdn', text: 'The player downloads the manifest and then segments from the **nearest CDN edge** — often inside the viewer’s ISP (Netflix Open Connect).' },
          { from: 'cdn', to: 'enc', text: 'On an edge miss: edge → regional shield → origin storage. Popular titles are **pre-positioned** at edges overnight, so misses are rare.' },
          { at: 'viewer', text: '**Adaptive bitrate (ABR):** the player measures throughput and buffer level and picks the rendition for each next segment — it drops to 480p on a train, then climbs back to 1080p on Wi-Fi without stopping.' },
        ],
      },
    ],
    deepDives: [
      { title: 'Why segment-based streaming?', points: ['Segments are plain HTTP files → cacheable by any CDN, no special streaming servers.', 'Quality can switch at every segment boundary (ABR).', 'Parallel transcoding: a 2-hour film becomes 1,800 independent 4-second jobs.'] },
      { title: 'CDN strategy', points: ['Egress is the #1 cost — push content as close to users as possible.', 'Long-tail videos are served from regional caches; the head (popular) from edges.', 'Origin shield: a middle cache layer that collapses many edge misses into one origin read.'] },
      { title: 'Saving storage', points: ['Per-title encoding: animation needs a lower bitrate than sports for the same quality.', 'Rarely watched videos keep fewer renditions and move to cold storage tiers.'] },
    ],
    tradeoffs: [
      { choice: 'Direct-to-storage uploads', pros: 'App servers stay light; uploads are resumable.', cons: 'Need a completion callback / event to know when an upload is done.' },
      { choice: 'More renditions & codecs', pros: 'Better quality on every device, less bandwidth.', cons: 'More compute at upload time and more storage.' },
    ],
    bottlenecks: ['Transcoding backlog after a spike → autoscale workers on queue depth; prioritise popular creators.', 'Viral video at a cold edge → origin shield and request coalescing.'],
    quiz: [
      { q: 'Why do uploads go directly to object storage via pre-signed URLs?', options: ['It’s more secure', 'It keeps large file bytes off app servers and enables resumable uploads', 'Object storage is faster to query', 'It avoids transcoding'], answer: 1, why: 'App servers would be tied up streaming gigabytes; direct uploads scale with the storage service.' },
      { q: 'What does adaptive bitrate streaming do?', options: ['Compresses video on the fly', 'Switches quality per segment based on network conditions', 'Caches video on the device', 'Reduces CDN cost by 90%'], answer: 1, why: 'The player picks a rendition for each segment based on measured bandwidth and buffer.' },
      { q: 'What dominates the cost of a video platform?', options: ['Database writes', 'Transcoding CPU', 'Egress bandwidth', 'Metadata storage'], answer: 2, why: 'Serving petabytes a day costs far more than anything else — hence aggressive CDN use.' },
    ],
  },

  // ---------------------------------------------------------------- Ride hailing
  {
    id: 'ride-hailing',
    title: 'Ride Hailing (Uber)',
    tagline: 'Match riders with nearby drivers in real time.',
    difficulty: 'Hard',
    icon: 'dns',
    tags: ['Geospatial index', 'Real-time location', 'Matching', 'State machines'],
    functional: ['Riders request a ride and see a price estimate.', 'Nearby drivers get the offer; one accepts.', 'Both see each other’s live location during the trip.', 'Payment when the trip ends.'],
    nonFunctional: ['Match within seconds.', 'Location updates are huge in volume but individually disposable.', 'Never assign one driver to two riders.', 'Highly available per city — a region outage must not stop rides elsewhere.'],
    estimate: {
      inputs: [
        { key: 'drivers', label: 'Drivers online at peak', value: 1e6, min: 10000, max: 10e6, step: 10000, fmt: num },
        { key: 'interval', label: 'Location update interval (s)', value: 4, min: 1, max: 30, step: 1, fmt: (v) => `${v} s` },
        { key: 'trips', label: 'Trips per day', value: 20e6, min: 100000, max: 100e6, step: 100000, fmt: num },
        { key: 'point', label: 'Bytes per location update', value: 100, min: 50, max: 500, step: 10, fmt: bytes },
      ],
      outputs: (v) => [
        { label: 'Location writes', value: qps(v.drivers / v.interval), hint: 'overwrite in memory; history to a stream' },
        { label: 'Ride requests', value: qps(v.trips / DAY), hint: `peak ≈ ${qps((v.trips / DAY) * 4)}` },
        { label: 'Location ingest', value: bits((v.drivers / v.interval) * v.point * 8), hint: 'inbound bandwidth' },
        { label: 'Live geo index', value: bytes(v.drivers * 200), hint: 'fits in RAM on a handful of nodes' },
        { label: 'Location history / day', value: bytes((v.drivers / v.interval) * v.point * DAY), hint: 'for ETA models & disputes' },
      ],
    },
    api: [
      { method: 'POST', path: '/api/v1/drivers/location', body: '{ lat, lng, heading, ts }', returns: '204', note: 'Usually over a persistent connection, not individual HTTP calls.' },
      { method: 'POST', path: '/api/v1/trips', body: '{ pickup, dropoff, productType }', returns: '201 { tripId, status: "MATCHING", fareEstimate }' },
      { method: 'POST', path: '/api/v1/trips/{id}/accept', returns: '200 | 409 already taken' },
    ],
    data: [
      { name: 'trips', store: 'SQL (sharded by city)', fields: [['trip_id', 'PK'], ['rider_id', 'bigint'], ['driver_id', 'bigint'], ['status', 'REQUESTED → ASSIGNED → ARRIVED → IN_TRIP → COMPLETED'], ['fare', 'decimal'], ['route', 'polyline']] },
      { name: 'driver_locations', store: 'In-memory geo index (Redis GEO / H3 cells)', fields: [['cell_id', 'key'], ['driver_id → (lat, lng, ts)', 'set, TTL 30 s']] },
    ],
    diagram: {
      nodes: [
        { id: 'rider', type: 'mobile', label: 'Rider', x: 0, y: 0.6 },
        { id: 'driver', type: 'mobile', label: 'Driver', x: 0, y: 3.4 },
        { id: 'gw', type: 'gateway', label: 'API gateway', x: 1.3, y: 2 },
        { id: 'trip', type: 'service', label: 'Trip service', x: 2.7, y: 0.6, stack: true },
        { id: 'loc', type: 'service', label: 'Location service', x: 2.7, y: 3.4, stack: true },
        { id: 'match', type: 'service', label: 'Matching', x: 4.2, y: 2 },
        { id: 'geo', type: 'cache', label: 'Geo index', sub: 'H3 cells in RAM', x: 4.2, y: 3.4 },
        { id: 'tripdb', type: 'db', label: 'Trips DB', x: 4.2, y: 0.6 },
        { id: 'price', type: 'service', label: 'Pricing & ETA', sub: 'surge', x: 5.6, y: 0.6 },
        { id: 'notify', type: 'ws', label: 'Push gateway', x: 5.6, y: 3.4 },
      ],
      edges: [
        { from: 'rider', to: 'gw' },
        { from: 'driver', to: 'gw' },
        { from: 'gw', to: 'trip' },
        { from: 'gw', to: 'loc' },
        { from: 'loc', to: 'geo' },
        { from: 'trip', to: 'tripdb' },
        { from: 'trip', to: 'match' },
        { from: 'match', to: 'geo' },
        { from: 'trip', to: 'price', bend: -0.18 },
        { from: 'match', to: 'notify' },
        { from: 'notify', to: 'driver', bend: -0.22, dashed: true },
      ],
    },
    flows: [
      {
        id: 'location',
        name: 'Driver location updates',
        color: '#34d399',
        steps: [
          { from: 'driver', to: 'gw', text: 'Every ~4 s the driver app sends `{lat, lng, heading}`. A million online drivers ≈ **250K writes/s**.' },
          { from: 'gw', to: 'loc', text: 'Routed to the location service, partitioned by city/region.' },
          { from: 'loc', to: 'geo', text: 'Update the driver’s position in an **in-memory geo index**: the map is divided into hexagonal cells (Uber’s H3) or geohashes. Old entries simply expire — a location is useless after 30 s, so no durable database write.' },
          { at: 'loc', text: 'A copy also goes to an event stream for trip tracking, ETA model training and fraud detection.' },
        ],
      },
      {
        id: 'request',
        name: 'Request & match a ride',
        color: '#5ee1ff',
        steps: [
          { from: 'rider', to: 'gw', text: 'The rider taps "Request": `POST /trips {pickup, dropoff}`.' },
          { from: 'gw', to: 'trip', text: 'The trip service owns the trip lifecycle.' },
          { from: 'trip', to: 'price', text: 'Get the fare estimate and **surge multiplier** for the pickup cell (demand ÷ supply).' },
          { from: 'trip', to: 'tripdb', text: 'Create the trip in `REQUESTED` state. Every transition in the state machine is persisted.' },
          { from: 'trip', to: 'match', text: 'Ask matching for a driver.' },
          { from: 'match', to: 'geo', text: 'Query the pickup cell plus its neighbouring rings for available drivers, then rank them by **real road ETA**, not straight-line distance.' },
          { from: 'match', to: 'notify', text: 'Offer to the best driver with a 10-second timeout. The driver is **atomically locked** (a compare-and-set) so two riders can never get the same driver.' },
          { from: 'notify', to: 'driver', text: 'The offer appears on the driver’s phone.' },
          { from: 'driver', to: 'gw', text: 'The driver accepts. (On timeout or decline, matching moves to the next candidate.)' },
          { from: 'gw', to: 'trip', text: 'Trip → `ASSIGNED`. The rider now receives the driver’s live location stream.' },
          { from: 'trip', to: 'rider', text: '"Your driver is 3 minutes away."' },
        ],
      },
    ],
    deepDives: [
      { title: 'Geospatial indexing', points: ['**Geohash**: encode lat/lng into a string; shared prefix ≈ nearby. Simple, but cells are rectangles of uneven size.', '**Quadtree**: split dense areas recursively — adapts to density, harder to update in real time.', '**H3 hexagons** (Uber): every neighbour is equidistant, which makes "k rings around me" searches clean.'] },
      { title: 'Consistency where it matters', points: ['Location data: eventually consistent, lossy is fine.', 'Driver assignment: must be strongly consistent — use conditional writes / distributed locks on the driver record.', 'Trips: a durable state machine; every transition is idempotent.'] },
      { title: 'Regional isolation', points: ['Shard everything by city/region; a failure in one region doesn’t affect others.', 'Trips crossing regions are rare and handled by handoff.'] },
    ],
    tradeoffs: [
      { choice: 'Locations in memory only', pros: 'Massive write throughput, no disk I/O.', cons: 'A crashed node loses positions for ~4 s until the next update — acceptable.' },
      { choice: 'Greedy nearest-driver matching', pros: 'Simple and fast.', cons: 'Globally suboptimal; batch matching every few seconds gives better overall ETAs.' },
    ],
    bottlenecks: ['Hot cells (stadium after a game) → split cells finer and batch matching.', 'Location write volume → partition by region, drop redundant updates when a driver is stationary.'],
    quiz: [
      { q: 'Why are driver locations kept in memory instead of a database?', options: ['Databases can’t store coordinates', 'Updates are extremely frequent and lose value within seconds', 'For privacy', 'Memory is cheaper than disk'], answer: 1, why: '250K updates/s of data that is stale in 30 s — durability buys nothing.' },
      { q: 'How do you prevent two riders being matched to the same driver?', options: ['Hope it doesn’t happen', 'An atomic compare-and-set / lock on the driver’s state', 'Assign drivers randomly', 'Use a CDN'], answer: 1, why: 'Driver assignment is the one place that needs strong consistency.' },
      { q: 'What is an advantage of hexagonal cells (H3) over squares?', options: ['Smaller storage', 'All neighbours are equidistant', 'They’re faster to compute', 'They work offline'], answer: 1, why: 'Every hexagon neighbour shares an edge at the same distance — "nearby" searches are uniform.' },
    ],
  },

  // ---------------------------------------------------------------- Notifications
  {
    id: 'notifications',
    title: 'Notification System',
    tagline: 'Send push, SMS and email reliably — exactly when users want them.',
    difficulty: 'Medium',
    icon: 'queue',
    tags: ['Queues', 'Retries', 'Idempotency', 'Third-party providers'],
    functional: ['Other services trigger notifications via an API.', 'Channels: mobile push, SMS, email.', 'Respect user preferences, opt-outs and quiet hours.', 'Track delivery status.'],
    nonFunctional: ['At-least-once delivery, with de-duplication so users never see doubles.', 'Priorities: an OTP must never wait behind a marketing blast.', 'Survive provider outages.'],
    estimate: {
      inputs: [
        { key: 'push', label: 'Push notifications per day', value: 1e9, min: 1e6, max: 20e9, step: 1e6, fmt: num },
        { key: 'sms', label: 'SMS per day', value: 10e6, min: 100000, max: 1e9, step: 100000, fmt: num },
        { key: 'email', label: 'Emails per day', value: 50e6, min: 100000, max: 5e9, step: 100000, fmt: num },
        { key: 'burst', label: 'Campaign burst factor', value: 10, min: 1, max: 50, step: 1, fmt: (v) => `${v}×` },
      ],
      outputs: (v) => {
        const total = (v.push + v.sms + v.email) / DAY;
        return [
          { label: 'Average send rate', value: qps(total) },
          { label: 'Burst rate', value: qps(total * v.burst), hint: 'queues absorb this' },
          { label: 'Delivery log / day', value: bytes((v.push + v.sms + v.email) * 200), hint: '~200 B per status record' },
          { label: 'SMS cost / day', value: `$${num(v.sms * 0.0075)}`, hint: 'at ~$0.0075 per SMS — why SMS is reserved for critical messages' },
        ];
      },
    },
    api: [
      { method: 'POST', path: '/api/v1/notifications', body: '{ userId, template, data, channels?, priority, idempotencyKey }', returns: '202 { notificationId }' },
      { method: 'PUT', path: '/api/v1/users/{id}/preferences', body: '{ channels, quietHours, topics }', returns: '200' },
    ],
    data: [
      { name: 'preferences', store: 'SQL + cache', fields: [['user_id', 'PK'], ['opt_outs', 'set<topic×channel>'], ['quiet_hours', 'tz + range'], ['device_tokens', 'list']] },
      { name: 'delivery_log', store: 'Wide-column (Cassandra)', fields: [['notification_id', 'PK'], ['user_id', 'bigint'], ['channel', 'push | sms | email'], ['status', 'QUEUED → SENT → DELIVERED | FAILED'], ['attempts', 'int']] },
    ],
    diagram: {
      nodes: [
        { id: 'producers', type: 'service', label: 'Other services', sub: 'orders, auth…', x: 0, y: 2, stack: true },
        { id: 'api', type: 'service', label: 'Notification API', x: 1.4, y: 2 },
        { id: 'prefs', type: 'db', label: 'Preferences', sub: 'opt-outs, tokens', x: 1.4, y: 0.5 },
        { id: 'dedupe', type: 'cache', label: 'Dedupe & limits', sub: 'Redis', x: 2.8, y: 0.5 },
        { id: 'queues', type: 'queue', label: 'Channel queues', sub: 'by priority', x: 2.8, y: 2 },
        { id: 'workers', type: 'worker', label: 'Channel workers', x: 4.2, y: 2, stack: true },
        { id: 'apns', type: 'external', label: 'APNs / FCM', x: 5.6, y: 0.8 },
        { id: 'sms', type: 'external', label: 'SMS provider', x: 5.6, y: 2 },
        { id: 'email', type: 'external', label: 'Email provider', x: 5.6, y: 3.2 },
        { id: 'retry', type: 'queue', label: 'Retry + DLQ', x: 4.2, y: 0.5 },
        { id: 'log', type: 'nosql', label: 'Delivery log', x: 4.2, y: 3.5 },
      ],
      edges: [
        { from: 'producers', to: 'api' },
        { from: 'api', to: 'prefs' },
        { from: 'api', to: 'dedupe' },
        { from: 'api', to: 'queues' },
        { from: 'queues', to: 'workers' },
        { from: 'workers', to: 'apns' },
        { from: 'workers', to: 'sms' },
        { from: 'workers', to: 'email' },
        { from: 'workers', to: 'retry' },
        { from: 'workers', to: 'log' },
      ],
    },
    flows: [
      {
        id: 'send',
        name: 'Send a notification',
        color: '#5ee1ff',
        steps: [
          { from: 'producers', to: 'api', text: 'The order service calls `POST /notifications {userId, template: "order_shipped", idempotencyKey}`.' },
          { from: 'api', to: 'prefs', text: 'Check preferences: has the user opted out of this topic or channel? Is it quiet hours in their timezone? Which device tokens and email address to use?' },
          { from: 'api', to: 'dedupe', text: 'Seen this **idempotency key** before? Drop the duplicate. Also enforce per-user frequency caps — nobody wants 12 pushes an hour.' },
          { from: 'api', to: 'queues', text: 'Enqueue one message per channel into **priority queues**: OTPs and security alerts jump ahead of marketing. Respond `202 Accepted`.' },
          { from: 'queues', to: 'workers', text: 'Channel workers consume at a controlled rate (respecting provider rate limits) and render templates with localisation.' },
          { from: 'workers', to: ['apns', 'sms', 'email'], text: 'Deliver through each third-party provider in parallel.' },
          { from: 'workers', to: 'log', text: 'Record the status for tracking, analytics and support ("did the user get the reset email?").' },
        ],
      },
      {
        id: 'failure',
        name: 'Provider failure & retries',
        color: '#fb7185',
        steps: [
          { from: 'workers', to: 'sms', text: 'The SMS provider times out or returns `503`.' },
          { from: 'workers', to: 'retry', text: 'Re-enqueue with **exponential backoff + jitter** (1 s, 2 s, 4 s…). After N attempts, move it to a **dead-letter queue** for inspection.' },
          { at: 'workers', text: 'A **circuit breaker** trips after repeated failures and fails over to a secondary SMS provider — no hammering a sick service.' },
          { from: 'retry', to: 'workers', text: 'Retries flow back in. Because sends carry the idempotency key, a retry after an ambiguous timeout never double-sends.' },
        ],
      },
    ],
    deepDives: [
      { title: 'Exactly-once is a myth — aim for effectively-once', points: ['Networks lose acks, so any retrying system delivers **at least once**.', 'Pair it with idempotency keys and a dedupe store → the user sees it exactly once.'] },
      { title: 'Priorities and fairness', points: ['Separate queues per priority, and per channel, so a slow email provider never blocks push.', 'A 50M-user marketing campaign is throttled and spread over time.'] },
      { title: 'Templates & localisation', points: ['Services send a template ID + data, never raw text — copy can change without deploys.', 'Render per user locale; A/B test copy.'] },
    ],
    tradeoffs: [
      { choice: 'Asynchronous via queues', pros: 'Absorbs bursts, isolates provider failures, enables retries.', cons: 'No synchronous "delivered" answer for the caller.' },
      { choice: 'At-least-once + dedupe', pros: 'No lost notifications.', cons: 'Needs a dedupe store with a TTL window.' },
    ],
    bottlenecks: ['Provider rate limits → token-bucket throttling per provider.', 'Stale device tokens → prune tokens the providers report as invalid.'],
    quiz: [
      { q: 'Why use separate queues by priority?', options: ['Cheaper storage', 'So critical messages (OTP) never wait behind bulk marketing', 'Required by APNs', 'To guarantee ordering'], answer: 1, why: 'A single FIFO queue would put a 2FA code behind millions of promo pushes.' },
      { q: 'How do you avoid sending a notification twice when retrying?', options: ['Never retry', 'Idempotency keys checked against a dedupe store', 'Use UDP', 'Send via two providers'], answer: 1, why: 'The key identifies the logical notification; repeats are dropped.' },
      { q: 'What does a circuit breaker do here?', options: ['Encrypts messages', 'Stops calling a failing provider and fails over/fast', 'Balances load across workers', 'Compresses payloads'], answer: 1, why: 'After repeated failures it opens, protecting both sides and enabling failover.' },
    ],
  },

  // ---------------------------------------------------------------- Typeahead
  {
    id: 'typeahead',
    title: 'Search Autocomplete',
    tagline: 'Suggest the top completions for every keystroke in under 100 ms.',
    difficulty: 'Medium',
    icon: 'search',
    tags: ['Trie', 'Precomputation', 'Edge caching', 'Batch pipelines'],
    functional: ['Return the top 5–10 suggestions for a prefix.', 'Rank by popularity (with some recency).', 'Filter offensive or unsafe suggestions.'],
    nonFunctional: ['p99 < 100 ms — it must feel instant.', 'Suggestions can lag real trends by minutes or hours.', 'Enormous read QPS: every keystroke is a request.'],
    estimate: {
      inputs: [
        { key: 'searches', label: 'Searches per day', value: 5e9, min: 1e7, max: 20e9, step: 1e7, fmt: num },
        { key: 'chars', label: 'Keystrokes per search', value: 10, min: 3, max: 30, step: 1, fmt: num },
        { key: 'debounce', label: 'Share of keystrokes sent (after debounce)', value: 0.5, min: 0.1, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
        { key: 'unique', label: 'Unique queries kept', value: 100e6, min: 1e6, max: 1e9, step: 1e6, fmt: num },
      ],
      outputs: (v) => {
        const rps = (v.searches * v.chars * v.debounce) / DAY;
        return [
          { label: 'Suggest QPS', value: qps(rps), hint: `peak ≈ ${qps(rps * 2)}` },
          { label: 'Trie size', value: bytes(v.unique * 30 * 3), hint: '~30 B/query × overhead for top-k at each node' },
          { label: 'Edge cache win', value: '~40–60%', hint: 'short prefixes repeat constantly' },
        ];
      },
    },
    api: [{ method: 'GET', path: '/api/v1/suggest?q=sys&lang=en', returns: '200 { suggestions: ["system design", "systemctl", …] }', note: 'Cacheable: Cache-Control: max-age=60.' }],
    data: [
      { name: 'trie shard', store: 'In-memory (serialised snapshots in object storage)', fields: [['node', 'character'], ['children', 'map<char, node>'], ['top_k', 'precomputed best 10 completions under this node']] },
      { name: 'query_counts', store: 'Batch / stream aggregates', fields: [['query', 'string'], ['count_window', 'decayed frequency']] },
    ],
    diagram: {
      nodes: [
        { id: 'client', type: 'client', label: 'Search box', x: 0, y: 1.5 },
        { id: 'edge', type: 'cdn', label: 'Edge cache', sub: 'popular prefixes', x: 1.4, y: 1.5 },
        { id: 'svc', type: 'service', label: 'Suggest service', x: 2.8, y: 1.5, stack: true },
        { id: 'trie', type: 'cache', label: 'Trie shards', sub: 'prefix → top-10', x: 4.2, y: 0.4 },
        { id: 'logs', type: 'stream', label: 'Query logs', sub: 'Kafka', x: 2.8, y: 3 },
        { id: 'agg', type: 'analytics', label: 'Aggregator', sub: 'Flink / Spark', x: 4.2, y: 3 },
        { id: 'builder', type: 'worker', label: 'Trie builder', x: 5.6, y: 1.7 },
        { id: 'snap', type: 'storage', label: 'Trie snapshots', x: 5.6, y: 3 },
      ],
      edges: [
        { from: 'client', to: 'edge' },
        { from: 'edge', to: 'svc' },
        { from: 'svc', to: 'trie' },
        { from: 'svc', to: 'logs', dashed: true },
        { from: 'logs', to: 'agg' },
        { from: 'agg', to: 'builder' },
        { from: 'builder', to: 'snap' },
        { from: 'builder', to: 'trie' },
      ],
    },
    flows: [
      {
        id: 'query',
        name: 'Serve suggestions',
        color: '#5ee1ff',
        steps: [
          { at: 'client', text: 'The user types "sys". The client **debounces** (~100 ms) so fast typists don’t fire a request per key, and caches responses locally.' },
          { from: 'client', to: 'edge', text: '`GET /suggest?q=sys`. Short prefixes are shared by millions of users, so an edge cache with a 1-minute TTL answers a large share of requests.' },
          { from: 'edge', to: 'svc', text: 'Cache miss → the suggest service (sharded by prefix range).' },
          { from: 'svc', to: 'trie', text: 'Walk the trie to the node for "s → y → s": O(prefix length). Each node **already stores its top-10 completions**, so there’s no subtree search at request time.' },
          { from: 'svc', to: 'client', text: 'Return the suggestions — typically in 10–20 ms.' },
        ],
      },
      {
        id: 'build',
        name: 'Rebuild the trie',
        color: '#a78bfa',
        steps: [
          { from: 'svc', to: 'logs', text: 'Completed searches are logged asynchronously (sampled at huge scale).' },
          { from: 'logs', to: 'agg', text: 'The aggregator counts query frequency over time windows, with **exponential decay** so this week’s trend beats last year’s.' },
          { from: 'agg', to: 'builder', text: 'Periodically (hourly/daily) the builder constructs new tries and precomputes top-k per node, filtering banned terms.' },
          { from: 'builder', to: 'snap', text: 'Serialised snapshots go to object storage — new servers boot from them in seconds.' },
          { from: 'builder', to: 'trie', text: '**Blue/green swap**: servers load the new trie alongside the old, then switch atomically. No downtime, easy rollback.' },
        ],
      },
    ],
    deepDives: [
      { title: 'Why precompute top-k per node?', points: ['Without it, "s" would require scanning millions of descendants per request.', 'The cost moves to build time: memory grows, but reads become O(prefix).'] },
      { title: 'Sharding the trie', points: ['Shard by prefix range ("a–c", "d–f"…), but first letters are skewed — split by observed traffic, not the alphabet.', 'Replicate every shard for read throughput.'] },
      { title: 'Freshness', points: ['Breaking news needs faster updates: a small real-time trie for trending queries merged with the big batch trie.'] },
    ],
    tradeoffs: [
      { choice: 'Precomputed top-k', pros: 'Very fast reads.', cons: 'Stale until the next rebuild; more memory.' },
      { choice: 'Client debouncing', pros: 'Halves or better the request volume.', cons: 'Adds a few ms of perceived delay.' },
    ],
    bottlenecks: ['Single-letter prefixes are the hottest keys → cache them on the client and at the edge.', 'Rebuild time grows with data → incremental updates and sharded builders.'],
    quiz: [
      { q: 'What makes trie lookups fast enough for every keystroke?', options: ['Using SQL LIKE queries', 'Precomputing the top-k completions at each node', 'Sorting on every request', 'GPU acceleration'], answer: 1, why: 'Reads become a walk of length |prefix| plus reading a stored list.' },
      { q: 'Why debounce on the client?', options: ['Security', 'To avoid a request for every single keystroke', 'To improve ranking', 'Browsers require it'], answer: 1, why: 'Waiting ~100 ms for typing to pause cuts requests dramatically.' },
      { q: 'How are new tries deployed without downtime?', options: ['Restart all servers', 'Blue/green: load the new trie beside the old one and switch', 'Edit in place', 'Clear the cache'], answer: 1, why: 'Atomic switch-over with instant rollback.' },
    ],
  },

  // ---------------------------------------------------------------- Web crawler
  {
    id: 'web-crawler',
    title: 'Web Crawler',
    tagline: 'Politely download billions of web pages for a search index.',
    difficulty: 'Hard',
    icon: 'worker',
    tags: ['URL frontier', 'Politeness', 'Bloom filters', 'Deduplication'],
    functional: ['Start from seed URLs and discover pages via links.', 'Store page content for indexing.', 'Re-crawl pages based on how often they change.'],
    nonFunctional: ['Scale: billions of pages per month.', 'Politeness: never overload a website; obey robots.txt.', 'Robust against spider traps, huge pages and malformed HTML.'],
    estimate: {
      inputs: [
        { key: 'pages', label: 'Pages per month', value: 1e9, min: 1e7, max: 50e9, step: 1e7, fmt: num },
        { key: 'size', label: 'Average page size (KB)', value: 500, min: 50, max: 2000, step: 50, fmt: (v) => `${v} KB` },
        { key: 'months', label: 'Months retained', value: 12, min: 1, max: 60, step: 1, fmt: (v) => `${v} mo` },
      ],
      outputs: (v) => {
        const pps = v.pages / (30 * DAY);
        return [
          { label: 'Fetch rate', value: qps(pps), hint: `peak ≈ ${qps(pps * 2)}` },
          { label: 'Download bandwidth', value: bits(pps * v.size * 1000 * 8) },
          { label: 'Storage / month', value: bytes(v.pages * v.size * 1000), hint: 'compressed ~5× smaller' },
          { label: 'Total retained', value: bytes(v.pages * v.size * 1000 * v.months) },
        ];
      },
    },
    api: [{ method: 'INTERNAL', path: 'frontier.enqueue(url, priority)', returns: 'void' }, { method: 'INTERNAL', path: 'frontier.next(workerId) → url', returns: 'url respecting per-host delay' }],
    data: [
      { name: 'frontier', store: 'Disk-backed queues (per host) + priority front queues', fields: [['url', 'string'], ['priority', 'float'], ['next_fetch_at', 'timestamp']] },
      { name: 'pages', store: 'Object storage / Bigtable', fields: [['url_hash', 'key'], ['content', 'compressed HTML'], ['fetched_at', 'timestamp'], ['simhash', 'content fingerprint']] },
    ],
    diagram: {
      nodes: [
        { id: 'seeds', type: 'service', label: 'Seed URLs', x: 0, y: 2 },
        { id: 'frontier', type: 'queue', label: 'URL frontier', sub: 'priority + per-host', x: 1.4, y: 2 },
        { id: 'fetch', type: 'worker', label: 'Fetchers', stack: true, x: 2.8, y: 2 },
        { id: 'dns', type: 'dns', label: 'DNS cache', x: 2.8, y: 0.5 },
        { id: 'web', type: 'external', label: 'Websites', sub: 'robots.txt', x: 4.2, y: 0.5 },
        { id: 'parse', type: 'worker', label: 'Parser', sub: 'links & content', x: 4.2, y: 2 },
        { id: 'store', type: 'storage', label: 'Page store', x: 5.6, y: 2 },
        { id: 'seen', type: 'cache', label: 'URL seen?', sub: 'Bloom filter', x: 4.2, y: 3.5 },
      ],
      edges: [
        { from: 'seeds', to: 'frontier' },
        { from: 'frontier', to: 'fetch' },
        { from: 'fetch', to: 'dns' },
        { from: 'fetch', to: 'web' },
        { from: 'fetch', to: 'parse' },
        { from: 'parse', to: 'store' },
        { from: 'parse', to: 'seen' },
        { from: 'seen', to: 'frontier', bend: -0.25 },
      ],
    },
    flows: [
      {
        id: 'crawl',
        name: 'Crawl loop',
        color: '#5ee1ff',
        steps: [
          { from: 'seeds', to: 'frontier', text: 'Seed URLs (popular domains, sitemaps) enter the frontier.' },
          { from: 'frontier', to: 'fetch', text: 'The frontier has **front queues** (by priority: PageRank, change frequency) and **back queues** (one per host). A fetcher only gets a URL for a host whose politeness delay has passed.' },
          { from: 'fetch', to: 'dns', text: 'DNS resolution is a surprising bottleneck — keep a local resolver cache.' },
          { from: 'fetch', to: 'web', text: 'Check the host’s `robots.txt` (cached), then fetch the page with timeouts and a size cap.' },
          { from: 'fetch', to: 'parse', text: 'Hand the HTML to the parser.' },
          { from: 'parse', to: 'store', text: 'Compute a **SimHash** fingerprint to skip near-duplicate content (mirrors, printer-friendly copies), then store the compressed page.' },
          { from: 'parse', to: 'seen', text: 'Extract and normalise links (resolve relative paths, strip tracking params). Check each against a **Bloom filter**: tiny memory, no false negatives, rare false positives (a few pages skipped).' },
          { from: 'seen', to: 'frontier', text: 'New URLs go back into the frontier with a priority — and the loop continues forever.' },
        ],
      },
    ],
    deepDives: [
      { title: 'Politeness & priority', points: ['Two-level frontier: priority front queues → per-host back queues → a heap of hosts keyed by next allowed fetch time.', 'Honour `Crawl-delay` and back off on 429/5xx.'] },
      { title: 'Spider traps', points: ['Infinite calendars, session IDs in URLs: cap URL length and depth per host, and detect repeating path patterns.'] },
      { title: 'Freshness', points: ['Estimate how often each page changes; news homepages hourly, archives yearly.', 'Use conditional GETs (`If-Modified-Since`, ETags) to skip unchanged pages.'] },
    ],
    tradeoffs: [
      { choice: 'Bloom filter for seen URLs', pros: 'Billions of URLs in a few GB of RAM.', cons: 'False positives mean a small fraction of new pages are never crawled.' },
      { choice: 'Per-host queues', pros: 'Guaranteed politeness, no bans.', cons: 'Throughput limited by slow hosts; needs many hosts in parallel.' },
    ],
    bottlenecks: ['DNS lookups → caching and async resolvers.', 'Frontier size → disk-backed queues with in-memory buffers.'],
    quiz: [
      { q: 'Why use a Bloom filter for "have we seen this URL?"', options: ['It’s exact', 'Very little memory for billions of items, with no false negatives', 'It stores page content', 'It sorts URLs'], answer: 1, why: 'A Bloom filter may say "seen" wrongly (rarely) but never misses a URL it has seen.' },
      { q: 'What ensures the crawler doesn’t overload a single website?', options: ['A CDN', 'Per-host back queues with delays between requests', 'A faster network', 'SimHash'], answer: 1, why: 'Each host gets its own queue and a minimum delay between fetches.' },
      { q: 'What is SimHash used for?', options: ['Password hashing', 'Detecting near-duplicate page content', 'DNS resolution', 'Load balancing'], answer: 1, why: 'Similar documents produce similar fingerprints, so near-duplicates can be skipped.' },
    ],
  },

  // ---------------------------------------------------------------- Payments
  {
    id: 'payments',
    title: 'Payment System',
    tagline: 'Move money correctly — every cent accounted for, even when things fail.',
    difficulty: 'Hard',
    icon: 'gateway',
    tags: ['Idempotency', 'Double-entry ledger', 'Outbox pattern', 'Reconciliation'],
    functional: ['Charge a customer’s card for an order.', 'Record every movement of money in a ledger.', 'Refunds; merchant payouts.'],
    nonFunctional: ['Correctness over latency: never double-charge, never lose a payment.', 'Auditable: every balance can be explained from history.', 'Security: PCI-DSS — card numbers never touch our servers.'],
    estimate: {
      inputs: [
        { key: 'tx', label: 'Payments per day', value: 10e6, min: 10000, max: 1e9, step: 10000, fmt: num },
        { key: 'avg', label: 'Average amount ($)', value: 40, min: 1, max: 1000, step: 1, fmt: (v) => `$${v}` },
        { key: 'entries', label: 'Ledger entries per payment', value: 4, min: 2, max: 10, step: 1, fmt: num },
      ],
      outputs: (v) => [
        { label: 'Payment QPS', value: qps(v.tx / DAY), hint: `peak ≈ ${qps((v.tx / DAY) * 10)} (Black Friday)` },
        { label: 'Volume / day', value: `$${num(v.tx * v.avg)}` },
        { label: 'Ledger writes / sec', value: qps((v.tx * v.entries) / DAY) },
        { label: 'Ledger growth / year', value: bytes(v.tx * v.entries * 200 * 365), hint: 'append-only, never deleted' },
      ],
    },
    api: [
      { method: 'POST', path: '/api/v1/payments', body: '{ orderId, amount, currency, paymentMethodToken }', returns: '201 { paymentId, status }', note: 'Header: Idempotency-Key: <uuid>. Retrying with the same key returns the original result.' },
      { method: 'POST', path: '/webhooks/psp', body: '{ eventId, paymentId, status }', returns: '200', note: 'Must be idempotent too — PSPs retry webhooks.' },
      { method: 'POST', path: '/api/v1/payments/{id}/refunds', body: '{ amount }', returns: '201' },
    ],
    data: [
      { name: 'payments', store: 'SQL (strong consistency)', fields: [['payment_id', 'PK'], ['idempotency_key', 'unique'], ['order_id', 'bigint'], ['amount', 'integer minor units (cents!)'], ['status', 'CREATED → PENDING → SUCCEEDED | FAILED']] },
      { name: 'ledger_entries', store: 'SQL, append-only', fields: [['entry_id', 'PK'], ['tx_id', 'groups a balanced set'], ['account', 'customer / merchant / fees'], ['direction', 'debit | credit'], ['amount', 'integer']], note: 'For every transaction, debits = credits. Never update or delete — corrections are new entries.' },
      { name: 'outbox', store: 'Same SQL database', fields: [['event_id', 'PK'], ['payload', 'json'], ['published', 'bool']] },
    ],
    diagram: {
      nodes: [
        { id: 'client', type: 'client', label: 'Checkout', x: 0, y: 2 },
        { id: 'gw', type: 'gateway', label: 'API gateway', x: 1.3, y: 2 },
        { id: 'pay', type: 'service', label: 'Payment service', x: 2.7, y: 2, stack: true },
        { id: 'idem', type: 'cache', label: 'Idempotency keys', x: 2.7, y: 0.5 },
        { id: 'paydb', type: 'db', label: 'Payments DB', sub: '+ outbox table', x: 4.1, y: 0.5 },
        { id: 'psp', type: 'external', label: 'PSP', sub: 'Stripe / Adyen', x: 5.5, y: 2 },
        { id: 'ledger', type: 'db', label: 'Ledger', sub: 'double-entry', x: 4.1, y: 3.5 },
        { id: 'events', type: 'stream', label: 'Payment events', x: 2.7, y: 3.5 },
        { id: 'recon', type: 'worker', label: 'Reconciliation', sub: 'nightly', x: 5.5, y: 3.5 },
      ],
      edges: [
        { from: 'client', to: 'gw' },
        { from: 'gw', to: 'pay' },
        { from: 'pay', to: 'idem' },
        { from: 'pay', to: 'paydb' },
        { from: 'pay', to: 'psp' },
        { from: 'pay', to: 'ledger' },
        { from: 'paydb', to: 'events', bend: 0.3, dashed: true, label: 'outbox relay' },
        { from: 'recon', to: 'psp' },
        { from: 'recon', to: 'ledger' },
      ],
    },
    flows: [
      {
        id: 'charge',
        name: 'Charge a card',
        color: '#34d399',
        steps: [
          { at: 'client', text: 'The card form is an iframe from the PSP. The card number goes **straight to the PSP**, which returns a token — our servers never see it (huge reduction in PCI scope).' },
          { from: 'client', to: 'gw', text: '`POST /payments` with the token and an `Idempotency-Key` header.' },
          { from: 'gw', to: 'pay', text: 'Authenticated and routed.' },
          { from: 'pay', to: 'idem', text: 'Seen this key? Return the **stored result** — a user double-clicking "Pay", or a client retrying after a timeout, will never be charged twice.' },
          { from: 'pay', to: 'paydb', text: 'Insert the payment as `PENDING` *before* calling out, so there’s always a record of intent.' },
          { from: 'pay', to: 'psp', text: 'Charge through the PSP, passing our payment ID as the PSP’s idempotency key too.' },
          { from: 'psp', to: 'pay', text: 'Result arrives (synchronously, or later via webhook). A **timeout is not a failure** — the status is unknown, so query the PSP before deciding anything.' },
          { from: 'pay', to: 'ledger', text: 'Write balanced **double-entry** records: debit customer $40, credit merchant $38.80, credit fees $1.20. The sum is always zero.' },
          { from: 'pay', to: 'paydb', text: 'Mark `SUCCEEDED` **and** insert an event into the outbox table — in the same database transaction.' },
          { from: 'paydb', to: 'events', text: 'A relay publishes outbox rows to the event stream (**transactional outbox**): the order service learns of the payment, with no chance of "DB updated but event lost".' },
        ],
      },
      {
        id: 'recon',
        name: 'Reconciliation',
        color: '#fbbf24',
        steps: [
          { from: 'recon', to: 'psp', text: 'Every night, download the PSP’s settlement report — the source of truth for money that actually moved.' },
          { from: 'recon', to: 'ledger', text: 'Compare it line by line with our ledger.' },
          { at: 'recon', text: 'Mismatches (missed webhooks, partial refunds, currency rounding) are flagged, auto-fixed with correcting entries, or escalated to finance. Distributed systems **will** drift; reconciliation is how you catch it.' },
        ],
      },
    ],
    deepDives: [
      { title: 'Idempotency everywhere', points: ['Client → us: Idempotency-Key header, stored with the response.', 'Us → PSP: pass our payment ID as their idempotency key.', 'PSP → us (webhooks): dedupe on event ID.'] },
      { title: 'Why double-entry?', points: ['Every transaction debits one account and credits another by the same amount.', 'Balances are derived from the history of entries, so they’re always auditable.', 'Bugs show up as ledgers that don’t balance — detected immediately.'] },
      { title: 'Money as integers', points: ['Never use floats: 0.1 + 0.2 ≠ 0.3.', 'Store minor units (cents) as integers, with an explicit currency.'] },
      { title: 'Distributed transactions', points: ['You can’t 2PC with a PSP. Use a **saga**: a sequence of steps, each with a compensating action (charge → refund).', 'Plus the outbox pattern to keep DB state and events in sync.'] },
    ],
    tradeoffs: [
      { choice: 'SQL with strong consistency', pros: 'ACID transactions, constraints, easy audits.', cons: 'Harder to scale writes — shard by merchant/account when needed.' },
      { choice: 'Synchronous PSP call', pros: 'Instant answer at checkout.', cons: 'Checkout is tied to the PSP’s latency; must handle unknown outcomes carefully.' },
    ],
    bottlenecks: ['Hot merchant accounts in the ledger → sub-accounts or batching entries.', 'PSP outage → route to a secondary PSP; queue payments that can wait.'],
    quiz: [
      { q: 'A PSP call times out. What should you do?', options: ['Mark the payment failed', 'Retry immediately with a new key', 'Treat the status as unknown and query the PSP (or retry with the same key)', 'Refund the customer'], answer: 2, why: 'The charge may have succeeded. Resolve the unknown state before deciding.' },
      { q: 'What problem does the transactional outbox solve?', options: ['Slow queries', 'Updating the DB and publishing an event atomically', 'Card security', 'Currency conversion'], answer: 1, why: 'The event is written in the same DB transaction and published afterwards, so neither can be lost.' },
      { q: 'Why store money as integer cents?', options: ['Saves space', 'Floating-point arithmetic introduces rounding errors', 'Databases don’t support decimals', 'For speed'], answer: 1, why: '0.1 + 0.2 = 0.30000000000000004 in floating point.' },
    ],
  },
];

export const caseById = (id) => CASES.find((c) => c.id === id);

import { CASE_EXTRA } from './explain.js';
for (const c of CASES) {
  const x = CASE_EXTRA[c.id];
  if (x) Object.assign(c, { ...x, apiDoes: x.api, dataWhy: x.data, api: c.api, data: c.data, quiz: [...c.quiz, ...x.quiz] });
}
