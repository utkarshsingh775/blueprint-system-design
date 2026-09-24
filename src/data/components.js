// The building blocks that appear in every diagram, with a short explanation of what each does.
export const COMPONENTS = {
  client: { name: 'Client', color: '#94a3b8', what: 'A browser or app making requests.', why: 'Where every flow starts. Clients should be treated as untrusted and unreliable (retries, flaky networks).' },
  mobile: { name: 'Mobile app', color: '#94a3b8', what: 'A native app on a phone.', why: 'Often offline, on slow networks, and slow to update — APIs must stay backward compatible.' },
  dns: { name: 'DNS', color: '#38bdf8', what: 'Resolves a hostname to an IP address.', why: 'Can route users to the nearest region (GeoDNS) and fail over between data centres.' },
  cdn: { name: 'CDN', color: '#22d3ee', what: 'A global network of edge caches.', why: 'Serves static and cacheable content from a location close to the user, cutting latency and origin load.' },
  lb: { name: 'Load balancer', color: '#5ee1ff', what: 'Spreads traffic across many servers.', why: 'Enables horizontal scaling and high availability; removes unhealthy servers using health checks.' },
  gateway: { name: 'API gateway', color: '#60a5fa', what: 'A single entry point in front of services.', why: 'Handles authentication, rate limiting, routing, TLS and request shaping in one place.' },
  service: { name: 'Service', color: '#a78bfa', what: 'A stateless application server.', why: 'Stateless services can be added or removed freely behind a load balancer.' },
  worker: { name: 'Worker', color: '#c084fc', what: 'A background job processor.', why: 'Moves slow or bursty work off the request path, usually by consuming from a queue.' },
  cache: { name: 'Cache', color: '#fbbf24', what: 'An in-memory key-value store (e.g. Redis, Memcached).', why: 'Serves hot data in under a millisecond and shields the database from repeated reads.' },
  db: { name: 'SQL database', color: '#34d399', what: 'A relational database (e.g. PostgreSQL, MySQL).', why: 'Strong consistency, transactions, joins — the default choice until scale forces otherwise.' },
  nosql: { name: 'NoSQL store', color: '#2dd4bf', what: 'A key-value, wide-column or document store (e.g. Cassandra, DynamoDB).', why: 'Scales writes horizontally with simple access patterns; usually trades away joins and some consistency.' },
  queue: { name: 'Message queue', color: '#fb923c', what: 'A buffer of messages between producers and consumers (e.g. SQS, RabbitMQ).', why: 'Decouples services, absorbs traffic spikes and enables retries.' },
  stream: { name: 'Event stream', color: '#f97316', what: 'A durable, replayable, partitioned log (e.g. Kafka).', why: 'Many consumers can read the same events independently, at their own pace, and replay history.' },
  storage: { name: 'Object storage', color: '#4ade80', what: 'Blob storage for files (e.g. S3, GCS).', why: 'Cheap, durable (11 nines) storage for images, videos and backups.' },
  search: { name: 'Search index', color: '#f472b6', what: 'An inverted index (e.g. Elasticsearch).', why: 'Full-text search, ranking and filtering that databases do poorly.' },
  ws: { name: 'WebSocket server', color: '#818cf8', what: 'Holds long-lived, two-way connections.', why: 'Pushes messages to clients in real time instead of clients polling.' },
  coord: { name: 'Coordinator', color: '#e879f9', what: 'A consensus-backed config/lock service (e.g. ZooKeeper, etcd).', why: 'Leader election, service discovery, distributed locks and configuration.' },
  analytics: { name: 'Analytics', color: '#f87171', what: 'A data warehouse or stream processor.', why: 'Aggregates events for dashboards, billing and machine learning.' },
  external: { name: 'External API', color: '#cbd5e1', what: 'A third-party service (payments, SMS, maps).', why: 'Out of your control — wrap it with timeouts, retries and circuit breakers.' },
};

export const PALETTE_ORDER = [
  'client', 'mobile', 'dns', 'cdn', 'lb', 'gateway', 'service', 'worker', 'ws',
  'cache', 'db', 'nosql', 'queue', 'stream', 'storage', 'search', 'coord', 'analytics', 'external',
];
