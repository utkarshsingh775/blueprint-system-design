import { lazy } from 'react';

export const SIMS = [
  { id: 'load-balancer', title: 'Load balancer', blurb: 'Round robin vs least connections vs hashing — with slow and dead servers.', concept: 'load-balancing', icon: 'lb', Component: lazy(() => import('./LoadBalancerSim.jsx')) },
  { id: 'hashing', title: 'Consistent hashing', blurb: 'Add a server and count how many keys move. Then add virtual nodes.', concept: 'consistent-hashing', icon: 'coord', Component: lazy(() => import('./HashingSim.jsx')) },
  { id: 'cache', title: 'Cache & eviction', blurb: 'LRU, LFU and FIFO under skewed and uniform traffic.', concept: 'caching', icon: 'cache', Component: lazy(() => import('./CacheSim.jsx')) },
  { id: 'rate-limiter', title: 'Rate limiter', blurb: 'Token bucket, fixed and sliding windows — find the burst loophole.', concept: 'rate-limiting', icon: 'gateway', Component: lazy(() => import('./RateLimiterSim.jsx')) },
  { id: 'replication', title: 'Replication & CAP', blurb: 'Stale reads, network partitions, CP vs AP and conflict resolution.', concept: 'cap', icon: 'db', Component: lazy(() => import('./ReplicationSim.jsx')) },
  { id: 'queue', title: 'Queues & backpressure', blurb: 'Absorb a traffic spike, then watch lag grow when consumers fall behind.', concept: 'queues', icon: 'queue', Component: lazy(() => import('./QueueSim.jsx')) },
];

export const simById = (id) => SIMS.find((s) => s.id === id);
