// Database detail for each HLD case study: which fields are keys, an example value per field,
// and the queries the design actually runs (the access patterns that justify the schema).
// freq: 'hot' = on the main request path, 'warm' = regular, 'cold' = background / rare.
export const CASE_DB = {
  'url-shortener': {
    tables: {
      urls: {
        keys: { code: ['PK', 'PARTITION'], expires_at: ['TTL'] },
        example: { code: 'aZ3kQ9x', long_url: 'https://example.com/blog/2026/…', user_id: '4812', created_at: '2026-09-25 10:02', expires_at: '2027-09-25 10:02' },
      },
      click_events: {
        keys: { code: ['PARTITION'], ts: ['SORT'] },
        example: { code: 'aZ3kQ9x', ts: '2026-09-25 10:05:11', country: 'IN', referrer: 't.co', user_agent: 'Mobile Safari' },
      },
    },
    queries: [
      { title: 'Redirect: find the long URL for a code', table: 'urls', flow: 'Redirect', freq: 'hot', rate: '~40K/s at peak', lang: 'CQL', query: "SELECT long_url, expires_at\nFROM urls\nWHERE code = 'aZ3kQ9x';", servedBy: 'Partition key `code`: a single-partition point lookup', why: 'One key, one row, no joins. It is also what the Redis cache stores, so ~99% never reach the database.' },
      { title: 'Create a short link', table: 'urls', flow: 'Create a short link', freq: 'warm', rate: '~400/s', lang: 'CQL', query: "INSERT INTO urls (code, long_url, user_id, created_at)\nVALUES ('aZ3kQ9x', 'https://…', 4812, toTimestamp(now()))\nIF NOT EXISTS\nUSING TTL 31536000;", servedBy: 'Partition key `code`; `IF NOT EXISTS` guards the rare collision', why: 'The TTL makes expiry automatic, so no cleanup job scans the table.' },
      { title: 'Record a click (async)', table: 'click_events', flow: 'Redirect', freq: 'hot', rate: '~40K/s', lang: 'Kafka', query: "produce(topic = 'clicks', key = 'aZ3kQ9x',\n        value = { ts, country, referrer, user_agent })", servedBy: 'Append to a log partitioned by `code`', why: 'Fire-and-forget: the redirect never waits for analytics.' },
      { title: 'Stats: clicks per country for a link', table: 'click_events', flow: 'Stats API', freq: 'cold', rate: 'on demand', lang: 'SQL', query: "SELECT country, COUNT(*) AS clicks\nFROM click_events\nWHERE code = 'aZ3kQ9x'\n  AND ts >= now() - INTERVAL '30 days'\nGROUP BY country\nORDER BY clicks DESC;", servedBy: 'Columnar warehouse, partitioned by day, clustered by `code`', why: 'Aggregations scan millions of rows, which is why they live in a warehouse and not the serving store.' },
    ],
  },

  'news-feed': {
    tables: {
      posts: {
        keys: { author_id: ['PARTITION'], post_id: ['SORT'] },
        example: { post_id: '1839204753012', author_id: '77', text: 'Shipping v2 today!', media_urls: '[img/…jpg]', created_at: '2026-09-25 09:30' },
      },
      follows: {
        keys: { follower_id: ['PK', 'PARTITION'], followee_id: ['PK', 'INDEX'] },
        example: { follower_id: '4812', followee_id: '77', created_at: '2025-01-10' },
      },
      'timeline:{userId}': {
        keys: { post_ids: ['KEY'] },
        example: { post_ids: '[1839204753012, 1839204701188, …]' },
      },
    },
    queries: [
      { title: 'Load my timeline (first page)', table: 'timeline:{userId}', flow: 'Load the timeline', freq: 'hot', rate: '~200K/s', lang: 'Redis', query: 'LRANGE timeline:4812 0 19', servedBy: 'A pre-built list per user', why: 'The expensive work happened at write time, so a read is one memory lookup of 20 IDs.' },
      { title: 'Hydrate the 20 posts', table: 'posts', flow: 'Load the timeline', freq: 'hot', rate: '~200K/s (batched)', lang: 'Redis / CQL', query: "MGET post:1839204753012 post:1839204701188 …\n-- cache miss:\nSELECT * FROM posts WHERE author_id = ? AND post_id = ?;", servedBy: 'Post cache, then `author_id` + `post_id` key', why: 'Timelines store IDs only; post bodies are cached once and shared by every follower.' },
      { title: 'Fan-out: who follows the author?', table: 'follows', flow: 'Publish a post', freq: 'warm', rate: 'per post', lang: 'SQL', query: 'SELECT follower_id\nFROM follows\nWHERE followee_id = 77;', servedBy: 'Index on `followee_id`', why: 'Needed to push the new post ID into each follower’s timeline. Celebrities skip this path (fan-out on read).' },
      { title: 'Push the post into a follower’s timeline', table: 'timeline:{userId}', flow: 'Publish a post', freq: 'hot', rate: 'posts × followers', lang: 'Redis', query: 'LPUSH timeline:4812 1839204753012\nLTRIM timeline:4812 0 799', servedBy: 'One list per user', why: 'LTRIM caps the list at 800 so memory stays bounded.' },
      { title: 'A celebrity’s recent posts (fan-out on read)', table: 'posts', flow: 'Load the timeline', freq: 'warm', rate: 'per timeline read', lang: 'CQL', query: 'SELECT post_id FROM posts\nWHERE author_id = 77\nORDER BY post_id DESC\nLIMIT 20;', servedBy: 'Partition `author_id`, clustered by time-sortable `post_id`', why: 'Merged into the timeline at read time instead of writing to 50M lists.' },
    ],
  },

  chat: {
    tables: {
      messages: {
        keys: { conversation_id: ['PARTITION'], message_id: ['SORT'] },
        example: { conversation_id: 'c_4812_77', message_id: '1839204753012', sender_id: '4812', body: '0x8f3a… (encrypted)', ts: '2026-09-25 10:15:02' },
      },
      sessions: {
        keys: { user_id: ['KEY'], last_heartbeat: ['TTL'] },
        example: { user_id: '77', gateway_id: 'gw-12', last_heartbeat: '10:15:00 (expires 10:16:00)' },
      },
      'inbox cursors': {
        keys: { 'user_id + device': ['KEY'] },
        example: { 'user_id + device': '77:phone', last_delivered_id: '1839204701188' },
      },
    },
    queries: [
      { title: 'Store a message', table: 'messages', flow: 'Send', freq: 'hot', rate: '~1M/s', lang: 'CQL', query: 'INSERT INTO messages (conversation_id, message_id, sender_id, body, ts)\nVALUES (?, ?, ?, ?, ?);', servedBy: 'Partition `conversation_id`, clustered by `message_id`', why: 'Writes append to the end of one partition; Cassandra is built for this write rate.' },
      { title: 'Which gateway holds Bob’s socket?', table: 'sessions', flow: 'Send (Bob online)', freq: 'hot', rate: 'per message', lang: 'Redis', query: 'GET session:77', servedBy: 'Key = user_id', why: 'Routes the message to the right server in one memory lookup; a missing key means Bob is offline.' },
      { title: 'Load older messages (scroll up)', table: 'messages', flow: 'History API', freq: 'warm', rate: 'on scroll', lang: 'CQL', query: 'SELECT * FROM messages\nWHERE conversation_id = ?\n  AND message_id < ?\nORDER BY message_id DESC\nLIMIT 50;', servedBy: 'Clustering order on `message_id`', why: 'A contiguous slice of one partition: fast, already sorted, no index needed.' },
      { title: 'Catch up after being offline', table: 'messages', flow: 'Send (Bob offline)', freq: 'warm', rate: 'per reconnect', lang: 'CQL', query: '-- after reading the cursor for 77:phone\nSELECT * FROM messages\nWHERE conversation_id = ?\n  AND message_id > 1839204701188;', servedBy: 'Cursor + clustering key', why: 'The cursor says exactly where delivery stopped, so nothing is missed or duplicated.' },
      { title: 'Heartbeat keeps the session alive', table: 'sessions', flow: 'Connect', freq: 'hot', rate: 'every 30 s per user', lang: 'Redis', query: 'SET session:77 gw-12 EX 60', servedBy: 'Key with a 60 s TTL', why: 'If the phone dies, the key simply expires, and no cleanup is needed.' },
    ],
  },

  'video-streaming': {
    tables: {
      videos: {
        keys: { video_id: ['PK'], owner_id: ['INDEX'] },
        example: { video_id: 'v_9f2c', owner_id: '4812', title: 'Intro to Raft', status: 'READY', duration: '612', renditions: '{"240p":…,"1080p":…}' },
      },
      blobs: {
        keys: { 'raw/{videoId}': ['KEY'], 'hls/{videoId}/{rendition}/seg_N': ['KEY'] },
        example: { 'raw/{videoId}': 'raw/v_9f2c (2.1 GB)', 'hls/{videoId}/{rendition}/seg_N': 'hls/v_9f2c/720p/seg_00042.m4s', 'hls/{videoId}/master.m3u8': 'hls/v_9f2c/master.m3u8' },
      },
    },
    queries: [
      { title: 'Watch page: video metadata', table: 'videos', flow: 'Watch', freq: 'hot', rate: '~100K/s (mostly cached)', lang: 'SQL', query: "SELECT title, duration, renditions\nFROM videos\nWHERE video_id = 'v_9f2c' AND status = 'READY';", servedBy: 'Primary key `video_id` (also the shard key)', why: 'Single-shard point read; cached aggressively because metadata rarely changes.' },
      { title: 'Stream a segment', table: 'blobs', flow: 'Watch', freq: 'hot', rate: 'millions/s (CDN)', lang: 'HTTP', query: 'GET https://cdn…/v_9f2c/720p/seg_00042.m4s', servedBy: 'Object key; served by the CDN edge', why: 'The origin is hit only on a CDN miss; segments are immutable, so they cache forever.' },
      { title: 'Transcoder marks a video ready', table: 'videos', flow: 'Upload & transcode', freq: 'cold', rate: 'per upload', lang: 'SQL', query: "UPDATE videos\nSET status = 'READY', renditions = ?\nWHERE video_id = 'v_9f2c' AND status = 'PROCESSING';", servedBy: 'Primary key', why: 'The status guard makes the update safe to retry if the transcoder runs twice.' },
      { title: 'My uploads (channel page)', table: 'videos', flow: 'Channel page', freq: 'warm', rate: 'per page view', lang: 'SQL', query: 'SELECT video_id, title, status\nFROM videos\nWHERE owner_id = 4812\nORDER BY video_id DESC\nLIMIT 30;', servedBy: 'Index on `owner_id` (per shard, or a separate owner → videos table)', why: 'Sharding is by video_id, so this query needs its own index or lookup table.' },
    ],
  },

  'ride-hailing': {
    tables: {
      trips: {
        keys: { trip_id: ['PK'], rider_id: ['INDEX'], driver_id: ['INDEX'] },
        example: { trip_id: 't_blr_88121', rider_id: '4812', driver_id: '9021', status: 'IN_TRIP', fare: '312.50', route: '_p~iF~ps|U…' },
      },
      driver_locations: {
        keys: { cell_id: ['KEY'], 'driver_id → (lat, lng, ts)': ['TTL'] },
        example: { cell_id: 'h3:8a2a1072b59ffff', 'driver_id → (lat, lng, ts)': '9021 → (12.97, 77.59, 10:15:04)' },
      },
    },
    queries: [
      { title: 'Driver location update', table: 'driver_locations', flow: 'Driver location updates', freq: 'hot', rate: '~250K/s (every 4 s)', lang: 'Redis', query: 'GEOADD drivers:blr 77.5946 12.9716 9021\nSET driver:9021:alive 1 EX 30', servedBy: 'Geo index per city', why: 'In memory because it is overwritten every few seconds; a database would drown in writes.' },
      { title: 'Nearby available drivers', table: 'driver_locations', flow: 'Request & match', freq: 'hot', rate: 'per ride request', lang: 'Redis', query: 'GEOSEARCH drivers:blr\n  FROMLONLAT 77.5946 12.9716\n  BYRADIUS 2 km ASC COUNT 10', servedBy: 'Geo index (geohash / H3 cells)', why: 'Only nearby cells are scanned, not every driver in the city.' },
      { title: 'Create a trip', table: 'trips', flow: 'Request & match', freq: 'warm', rate: '~1K/s', lang: 'SQL', query: "INSERT INTO trips (trip_id, rider_id, status)\nVALUES ('t_blr_88121', 4812, 'REQUESTED');", servedBy: 'Primary key; shard = city', why: 'Trips need transactions and strong consistency, so they live in SQL.' },
      { title: 'Driver accepts (only one can win)', table: 'trips', flow: 'Request & match', freq: 'warm', rate: 'per offer', lang: 'SQL', query: "UPDATE trips\nSET driver_id = 9021, status = 'ASSIGNED'\nWHERE trip_id = 't_blr_88121' AND status = 'REQUESTED';\n-- 1 row updated = you got it, 0 = someone else did", servedBy: 'Primary key + status condition', why: 'A conditional update is an atomic compare-and-set: two drivers can’t both accept.' },
      { title: 'Rider’s trip history', table: 'trips', flow: 'History screen', freq: 'cold', rate: 'on open', lang: 'SQL', query: 'SELECT trip_id, status, fare\nFROM trips\nWHERE rider_id = 4812\nORDER BY trip_id DESC\nLIMIT 20;', servedBy: 'Index on `rider_id`', why: 'A secondary access pattern, so it gets its own index.' },
    ],
  },

  notifications: {
    tables: {
      preferences: {
        keys: { user_id: ['PK'] },
        example: { user_id: '4812', opt_outs: '{marketing×sms}', quiet_hours: 'Asia/Kolkata 22:00–07:00', device_tokens: '[fcm:dK3…, apns:9a…]' },
      },
      delivery_log: {
        keys: { notification_id: ['PK'], user_id: ['INDEX'] },
        example: { notification_id: 'n_55120', user_id: '4812', channel: 'push', status: 'DELIVERED', attempts: '1' },
      },
    },
    queries: [
      { title: 'Check preferences before sending', table: 'preferences', flow: 'Send a notification', freq: 'hot', rate: 'per notification', lang: 'Redis / SQL', query: "GET prefs:4812\n-- cache miss:\nSELECT opt_outs, quiet_hours, device_tokens\nFROM preferences WHERE user_id = 4812;", servedBy: 'Primary key, cached', why: 'Read on every send but changed rarely, which is the ideal case for a cache.' },
      { title: 'Log a send attempt (idempotent)', table: 'delivery_log', flow: 'Send a notification', freq: 'hot', rate: 'per attempt', lang: 'CQL', query: "INSERT INTO delivery_log (notification_id, user_id, channel, status, attempts)\nVALUES ('n_55120', 4812, 'push', 'QUEUED', 0)\nIF NOT EXISTS;", servedBy: 'Primary key `notification_id`', why: 'IF NOT EXISTS means a retried event can’t create a second notification.' },
      { title: 'Record the provider result', table: 'delivery_log', flow: 'Provider failure & retries', freq: 'hot', rate: 'per attempt', lang: 'CQL', query: "UPDATE delivery_log\nSET status = 'FAILED', attempts = 2\nWHERE notification_id = 'n_55120';", servedBy: 'Primary key', why: 'The retry worker reads attempts to decide backoff or give up.' },
      { title: 'Support: what did we send this user?', table: 'delivery_log', flow: 'Support tool', freq: 'cold', rate: 'rare', lang: 'CQL', query: 'SELECT * FROM delivery_log_by_user\nWHERE user_id = 4812\nLIMIT 50;', servedBy: 'A second table partitioned by `user_id`', why: 'Cassandra models one table per query, so the per-user view is a denormalised copy.' },
    ],
  },

  typeahead: {
    tables: {
      'trie shard': {
        keys: { node: ['KEY'] },
        example: { node: '"sys" (prefix path)', children: "{ 't' → node, 'c' → node }", top_k: '["system design", "system of a down", …]' },
      },
      query_counts: {
        keys: { query: ['PK'] },
        example: { query: 'system design', count_window: '18,240 (decayed)' },
      },
    },
    queries: [
      { title: 'Suggest completions for a prefix', table: 'trie shard', flow: 'Serve suggestions', freq: 'hot', rate: '~100K/s', lang: 'In-memory', query: "node = trie.walk('sys')   // one step per character\nreturn node.top_k         // precomputed, no traversal below", servedBy: 'Trie path, with top-k stored on every node', why: 'O(length of prefix), independent of how many queries exist.' },
      { title: 'Count a searched query', table: 'query_counts', flow: 'Rebuild the trie', freq: 'hot', rate: 'per search (streamed)', lang: 'Kafka', query: "produce(topic = 'searches', key = 'system design')", servedBy: 'Stream, aggregated in windows', why: 'Counting happens offline, so serving never takes a write.' },
      { title: 'Top queries to build the next trie', table: 'query_counts', flow: 'Rebuild the trie', freq: 'cold', rate: 'hourly batch', lang: 'SQL', query: 'SELECT query, count_window\nFROM query_counts\nWHERE count_window > 5\nORDER BY count_window DESC\nLIMIT 10000000;', servedBy: 'Batch job over aggregates', why: 'The trie is rebuilt from scratch and swapped in; readers are never blocked.' },
    ],
  },

  'web-crawler': {
    tables: {
      frontier: {
        keys: { url: ['PK'], next_fetch_at: ['SORT'] },
        example: { url: 'https://example.com/about', priority: '0.82', next_fetch_at: '2026-09-25 10:20' },
      },
      pages: {
        keys: { url_hash: ['PK'] },
        example: { url_hash: 'sha1:9b71d2…', content: '(gzip, 38 KB)', fetched_at: '2026-09-25 10:12', simhash: '0x9f3a57c1…' },
      },
    },
    queries: [
      { title: 'Next URL for this host (politeness)', table: 'frontier', flow: 'Crawl loop', freq: 'hot', rate: '~10K/s total', lang: 'Queue op', query: "host = heap.pop_earliest_ready()      // next host whose delay has passed\nurl  = queues[host].dequeue()\nheap.push(host, now + crawl_delay)", servedBy: 'One queue per host + a heap ordered by `next_fetch_at`', why: 'Guarantees we never hammer one site, while keeping every worker busy.' },
      { title: 'Seen this URL before?', table: 'pages', flow: 'Crawl loop', freq: 'hot', rate: 'per discovered link', lang: 'Bloom filter', query: "if (!seen.mightContain(sha1(url))) {\n  seen.add(sha1(url)); frontier.enqueue(url, priority);\n}", servedBy: 'Bloom filter over `url_hash`', why: 'Billions of URLs fit in memory; a rare false positive only skips a page.' },
      { title: 'Store a fetched page', table: 'pages', flow: 'Crawl loop', freq: 'hot', rate: 'per fetch', lang: 'Bigtable', query: "put(row = 'sha1:9b71d2…',\n    content = gzip(html), fetched_at = now(), simhash = simhash(text))", servedBy: 'Row key `url_hash`', why: 'Hash keys spread writes evenly across tablets, avoiding hot spots.' },
      { title: 'Near-duplicate check', table: 'pages', flow: 'Crawl loop', freq: 'warm', rate: 'per fetch', lang: 'Index lookup', query: 'candidates = simhash_index.lookup(bands(simhash))\nduplicate  = any(hamming(simhash, c) <= 3 for c in candidates)', servedBy: 'Banded simhash index', why: 'Mirror sites and boilerplate pages are skipped instead of stored again.' },
    ],
  },

  payments: {
    tables: {
      payments: {
        keys: { payment_id: ['PK'], idempotency_key: ['UNIQUE'], status: ['INDEX'], created_at: ['INDEX'] },
        example: { payment_id: 'pay_71c9', idempotency_key: 'order-42-attempt-1', order_id: '42', amount: '150000 (₹1,500.00)', status: 'SUCCEEDED', created_at: '2026-09-25 10:30' },
      },
      ledger_entries: {
        keys: { entry_id: ['PK'], tx_id: ['INDEX'], account: ['INDEX'] },
        example: { entry_id: 'le_9001', tx_id: 'tx_71c9', account: 'merchant:88', direction: 'credit', amount: '147000' },
      },
      outbox: {
        keys: { event_id: ['PK'], published: ['INDEX'] },
        example: { event_id: 'ev_3310', payload: '{"type":"payment.succeeded",…}', published: 'false' },
      },
    },
    queries: [
      { title: 'Create a payment exactly once', table: 'payments', flow: 'Charge a card', freq: 'hot', rate: '~2K/s', lang: 'SQL', query: "INSERT INTO payments (payment_id, idempotency_key, order_id, amount, status)\nVALUES ('pay_71c9', 'order-42-attempt-1', 42, 150000, 'CREATED')\nON CONFLICT (idempotency_key) DO NOTHING\nRETURNING payment_id;", servedBy: 'UNIQUE index on `idempotency_key`', why: 'The database, not application code, guarantees a retry can’t create a second payment.' },
      { title: 'Record success + ledger + event atomically', table: 'ledger_entries', flow: 'Charge a card', freq: 'hot', rate: 'per payment', lang: 'SQL', query: "BEGIN;\nUPDATE payments SET status = 'SUCCEEDED'\n  WHERE payment_id = 'pay_71c9' AND status = 'PENDING';\nINSERT INTO ledger_entries VALUES\n  ('le_9000', 'tx_71c9', 'customer:4812', 'debit',  150000),\n  ('le_9001', 'tx_71c9', 'merchant:88',  'credit', 147000),\n  ('le_9002', 'tx_71c9', 'fees',         'credit',   3000);\nINSERT INTO outbox VALUES ('ev_3310', '{\"type\":\"payment.succeeded\"}', false);\nCOMMIT;", servedBy: 'One transaction across three tables', why: 'Either all of it happens or none: status, balanced ledger (debits = credits) and the event.' },
      { title: 'Merchant balance', table: 'ledger_entries', flow: 'Merchant dashboard', freq: 'warm', rate: 'per view', lang: 'SQL', query: "SELECT SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END) AS balance\nFROM ledger_entries\nWHERE account = 'merchant:88';", servedBy: 'Index on `account`', why: 'Balances are derived from the append-only ledger, never stored and edited.' },
      { title: 'Publish pending events', table: 'outbox', flow: 'Charge a card', freq: 'warm', rate: 'poll every 100 ms', lang: 'SQL', query: 'SELECT event_id, payload FROM outbox\nWHERE published = false\nORDER BY event_id\nLIMIT 100\nFOR UPDATE SKIP LOCKED;', servedBy: 'Partial index on `published = false`', why: 'SKIP LOCKED lets several publishers share the work without sending an event twice.' },
      { title: 'Reconciliation: payments stuck in PENDING', table: 'payments', flow: 'Reconciliation', freq: 'cold', rate: 'every few minutes', lang: 'SQL', query: "SELECT payment_id FROM payments\nWHERE status = 'PENDING'\n  AND created_at < now() - INTERVAL '15 minutes';", servedBy: 'Index on (`status`, `created_at`)', why: 'These are asked back to the provider for their final status.' },
    ],
  },
};
