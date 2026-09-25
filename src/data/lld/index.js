// LLD case registry: light metadata here, full case content lazy-loaded per page.
const LOADERS = {
  payment: () => import('./payment.js'),
  'parking-lot': () => import('./parking-lot.js'),
};

export const LLD_CASES = [
  {
    id: 'payment',
    title: 'Payment System',
    prompt: 'Design a payment system.',
    difficulty: 'Medium',
    icon: 'db',
    teaches: ['State transitions in the entity', 'Repository', 'Provider interface', 'Idempotency'],
    quiz: [
      { q: 'Where should the rule “only PROCESSING can become SUCCESS” live?', options: ['PaymentService', 'Payment', 'PaymentRepository', 'The controller'], answer: 1, why: 'The entity owns its invariants, so no caller can bypass the rule.' },
      { q: 'Why does PaymentService depend on a PaymentRepository interface instead of a HashMap?', options: ['HashMaps are slow', 'So persistence can change without changing the workflow', 'Interfaces are required in Java', 'To support refunds'], answer: 1, why: 'The service orchestrates; where payments are stored is a separate, swappable concern.' },
      { q: 'The provider call times out. What status should the payment have?', options: ['FAILED', 'SUCCESS', 'Stay PROCESSING until the real outcome is known', 'CREATED'], answer: 2, why: 'The provider may have charged the card; marking FAILED could lead to a double charge on retry.' },
      { q: 'Refunds were not in the prompt. What should you do with them?', options: ['Design them in from the start', 'Ignore them silently', 'Name them as an extension after finishing the core scope', 'Ask the interviewer to drop the question'], answer: 2, why: 'Finish the requested scope first, then show how the design extends.' },
    ],
  },
  {
    id: 'parking-lot',
    title: 'Parking Lot',
    prompt: 'Design a parking lot.',
    difficulty: 'Easy',
    icon: 'lb',
    teaches: ['Strategy for spot allocation', 'Rules inside entities', 'Atomic assignment', 'Enum over subclasses'],
    quiz: [
      { q: 'Why is spot allocation a Strategy but pricing is not, in the core scope?', options: ['Pricing is harder', 'Only the allocation rule is expected to vary independently right now', 'Strategy only works once per design', 'Pricing needs a database'], answer: 1, why: 'Use a pattern when it solves a real problem; a rate lookup is enough until pricing rules vary.' },
      { q: 'Two cars arrive at once and both see spot C1 free. What prevents a double assignment?', options: ['The strategy', 'Making find-and-occupy atomic (synchronized park), plus the spot re-checking canFit()', 'The Ticket class', 'Garbage collection'], answer: 1, why: 'The race is between finding and occupying; the fix is to make them one step.' },
      { q: 'Why no Car, Bike and Truck subclasses?', options: ['Java forbids it', 'They don’t behave differently in this scope; an enum captures the difference', 'Records can’t be subclassed, so it’s impossible', 'Subclasses are slower'], answer: 1, why: 'Subclass when behaviour differs, not just data.' },
    ],
  },
  ...[
    ['elevator', 'Elevator System', 'Design an elevator system.', 'Medium'],
    ['vending-machine', 'Vending Machine', 'Design a vending machine.', 'Easy'],
    ['atm', 'ATM', 'Design an ATM.', 'Medium'],
    ['splitwise', 'Splitwise', 'Design an expense-sharing app.', 'Medium'],
    ['movie-booking', 'Movie Ticket Booking', 'Design a movie ticket booking system.', 'Hard'],
    ['lru-cache', 'LRU Cache', 'Design an LRU cache.', 'Easy'],
    ['rate-limiter', 'Rate Limiter', 'Design a rate limiter.', 'Medium'],
    ['logger', 'Logging Framework', 'Design a logging framework.', 'Easy'],
    ['pub-sub', 'Pub-Sub Queue', 'Design a publish-subscribe message queue.', 'Hard'],
    ['library', 'Library Management', 'Design a library management system.', 'Easy'],
    ['hotel', 'Hotel Booking', 'Design a hotel booking system.', 'Medium'],
    ['food-delivery', 'Food Delivery Order', 'Design the order flow for a food delivery app.', 'Medium'],
    ['tic-tac-toe', 'Tic-Tac-Toe → Chess', 'Design a Tic-Tac-Toe game.', 'Easy'],
  ].map(([id, title, prompt, difficulty]) => ({ id, title, prompt, difficulty, upcoming: true })),
];

export const READY_LLD = LLD_CASES.filter((c) => !c.upcoming);
export const lldById = (id) => LLD_CASES.find((c) => c.id === id);
export const loadLldCase = (id) => (LOADERS[id] ? LOADERS[id]().then((m) => m.default) : Promise.resolve(null));
