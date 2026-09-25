// LLD case: Payment System. Blocks concatenate, in order, into one runnable Main.java
// (checked by scripts/check-lld.mjs).
export default {
  id: 'payment',
  prompt: 'Design a payment system.',
  vague: 'The prompt is deliberately open. The interviewer wants to see whether you scope it before you draw anything.',

  requirements: {
    ask: 'What are your functional requirements?',
    dialogue: [
      {
        interviewer: 'Design a payment system.',
        you: 'Before I design, let me scope it. I’ll assume a user pays a merchant a fixed amount through one external payment provider, and we track that payment until it succeeds or fails. Refunds, multiple providers and settlement I’d treat as extensions. Does that match what you have in mind?',
        why: 'You show you scope before designing, and you name what you are leaving out instead of silently ignoring it.',
      },
      {
        interviewer: 'Sounds good. What happens if the client retries?',
        you: 'Then the same request must not charge twice. I’ll take an idempotency key with every payment request and return the existing payment if I’ve seen that key.',
        why: 'Idempotency is the one NFR that changes the class design in a payment problem, so it belongs in scope.',
      },
      {
        interviewer: 'Do we need to scale this across regions?',
        you: 'For the LLD I’ll keep it in one process and design clean interfaces. If you want, we can discuss the distributed version at the end.',
        why: 'Keeps an LLD question from turning into HLD, while showing you know the difference.',
      },
    ],
    functional: [
      'Create a payment for a user with an amount and an idempotency key',
      'Charge it through a payment provider',
      'Track status: CREATED → PROCESSING → SUCCESS or FAILED',
      'Fetch a payment’s status by ID',
    ],
    constraints: [
      'One payment provider for now',
      'Amounts are whole numbers in paise (no floating point for money)',
      'A retried request carries the same idempotency key',
    ],
    hero: 'A user pays; the provider approves or declines; the payment ends in SUCCESS or FAILED exactly once, and a retry never charges twice.',
    nfrs: [
      ['Correctness', 'A payment must never move backwards, e.g. SUCCESS → PROCESSING.'],
      ['Idempotency', 'Retries are normal on flaky networks; double charging is the worst bug.'],
      ['Auditability', 'We keep the failure reason so support can explain what happened.'],
    ],
    parked: ['Refunds', 'Multiple providers / routing', 'Fraud checks', 'Settlement and reconciliation', 'Notifications', 'Distributed storage'],
  },

  entities: {
    ask: 'What are your core entities?',
    nouns: [
      ['User', 'Field (userId)', 'We only need to know who paid. No user behaviour is in scope, so a full User class would be empty.'],
      ['Payment', 'Entity', 'Has identity, a lifecycle and rules about that lifecycle. This is the heart of the problem.'],
      ['Status', 'Enum', 'A fixed set of lifecycle states. An enum makes invalid values impossible.'],
      ['Amount', 'Field', 'A number on Payment with no behaviour of its own (a Money class is an extension).'],
      ['Payment provider', 'Interface', 'An external system. We depend on an interface so we can swap or fake it.'],
      ['Idempotency key', 'Field', 'A value used for lookup, not an object with behaviour.'],
    ],
    verbs: [
      ['pay', 'PaymentService.pay()'],
      ['charge', 'PaymentProvider.charge()'],
      ['start / succeed / fail', 'Payment.startProcessing(), markSuccess(), markFailed()'],
      ['look up status', 'PaymentService.getStatus()'],
    ],
    rules: [
      ['Amount must be positive', 'Payment constructor'],
      ['Only CREATED can start processing', 'Payment.startProcessing()'],
      ['Only PROCESSING can succeed or fail', 'Payment.markSuccess() / markFailed()'],
      ['Same idempotency key returns the same payment', 'PaymentService.pay()'],
    ],
    list: [
      { name: 'Payment', kind: 'Entity', attrs: 'id, idempotencyKey, userId, amountInPaise, status, failureReason', does: 'Owns its state transitions and guards them.' },
      { name: 'PaymentStatus', kind: 'Enum', attrs: 'CREATED, PROCESSING, SUCCESS, FAILED', does: 'Names the lifecycle explicitly.' },
      { name: 'PaymentProvider', kind: 'Interface', attrs: '—', does: 'Charges money at the external gateway.' },
      { name: 'PaymentRepository', kind: 'Interface', attrs: '—', does: 'Stores and finds payments (by ID and by idempotency key).' },
      { name: 'PaymentService', kind: 'Service', attrs: 'repository, provider', does: 'Orchestrates the pay workflow; holds no payment rules itself.' },
    ],
    diagram: `User (userId only)
 |
 | 1:N
 v
Payment ------------> PaymentStatus (enum)
 ^
 | creates, updates
 |
PaymentService
 |            \\
 v             v
PaymentRepository   PaymentProvider
 (stores)            (external)`,
    say: 'The nouns give me Payment, a status, the provider and a store. I’m not making User a class because nothing about the user has behaviour in this scope, so a userId is enough.',
  },

  relations: {
    ask: 'Who owns what? Walk me through the main flow.',
    rows: [
      { from: 'PaymentService', to: 'Payment', card: '1:N', kind: 'Creates and uses', why: 'The service runs the workflow; each Payment owns its own state.' },
      { from: 'Payment', to: 'PaymentStatus', card: '1:1', kind: 'Has', why: 'Every payment is in exactly one state at a time.' },
      { from: 'PaymentService', to: 'PaymentRepository', card: '1:1', kind: 'Depends on (interface)', why: 'Persistence can change (HashMap today, SQL later) without touching the service.' },
      { from: 'PaymentService', to: 'PaymentProvider', card: '1:1', kind: 'Depends on (interface)', why: 'The external gateway can be faked in tests or swapped later.' },
      { from: 'PaymentRepository', to: 'Payment', card: '1:N', kind: 'Stores', why: 'The repository keeps payments but never changes their state.' },
    ],
    ownership: 'PaymentService orchestrates the workflow, while Payment owns payment-specific state and invariants.',
    heroFlow: `User
 |  pay(userId, amount, key)
 v
PaymentService
 |  1. seen this idempotency key?  --yes--> return existing payment
 |  2. new Payment(...)                    [CREATED]
 |  3. payment.startProcessing()           [PROCESSING]
 |  4. repository.save(payment)
 v
PaymentProvider.charge()                   <- external call
 |
 +-- approved --> payment.markSuccess()    [SUCCESS]
 +-- declined --> payment.markFailed(why)  [FAILED]
 |
 v
repository.save(payment) --> return payment`,
    notes: [
      ['Internal calls', 'Service → Payment state methods, Service → Repository.'],
      ['External call', 'Service → PaymentProvider.charge(). This is the only call that can be slow or fail.'],
      ['State transitions', 'CREATED → PROCESSING before the external call, then PROCESSING → SUCCESS / FAILED after it.'],
      ['Business decision', 'We save the payment as PROCESSING before calling the provider, so a crash mid-call leaves a record we can check later.'],
    ],
  },

  patterns: {
    ask: 'Which patterns are you using, and why?',
    rows: [
      { name: 'Repository', problem: 'The service shouldn’t know whether payments live in a HashMap or a SQL table.', where: 'PaymentRepository + InMemoryPaymentRepository', say: 'I’m using a Repository because persistence will change, and I don’t want the payment workflow to change with it.' },
      { name: 'Interface for the external system (Adapter-ready)', problem: 'The provider is a third party we don’t control and can’t call in tests.', where: 'PaymentProvider + FakeProvider', say: 'I’m putting the provider behind an interface because it’s an external system. A real gateway becomes an adapter behind the same interface.' },
      { name: 'State transitions inside the entity', problem: 'Callers must not be able to set any status they like.', where: 'Payment.startProcessing / markSuccess / markFailed', say: 'I’m keeping transitions inside Payment so no caller can move a completed payment back to processing.' },
    ],
    rejected: [
      ['Strategy for payment methods', 'Only one way to pay is in scope. It becomes useful when UPI, card and wallet behave differently.'],
      ['Factory', 'Creating a Payment is one constructor call; a factory would add a class with no benefit.'],
      ['Observer for notifications', 'Notifications are out of scope. Mention it as an extension.'],
    ],
    layers: `PaymentService            (orchestration / workflow)
  |
  +----> Payment           (domain: rules + invariants)
  |
  +----> PaymentRepository (persistence)  <-- InMemoryPaymentRepository
  |
  +----> PaymentProvider   (external)     <-- FakeProvider`,
    roles: [
      ['Service', 'PaymentService', 'Runs the steps in order: check key, create, charge, update, save.'],
      ['Domain entity', 'Payment', 'Knows which transitions are legal and refuses the rest.'],
      ['Repository', 'PaymentRepository', 'Saves and finds payments. No business rules.'],
      ['Adapter', 'PaymentProvider', 'Talks to the outside world. No business rules.'],
    ],
    plan: ['PaymentStatus enum', 'Payment fields + constructor', 'Payment state transitions', 'ChargeResult, PaymentProvider, PaymentRepository', 'InMemoryPaymentRepository, FakeProvider', 'PaymentService', 'main() test'],
    transition: 'I have the core abstractions and relationships in place. I’ll implement the domain model first, then the state rules, then the provider and repository interfaces, then the service that ties them together, and finish with a main() that runs the hero flow.',
  },

  blocks: [
    {
      title: 'Imports and the status enum',
      slot: '15–17',
      phase: 'Domain',
      say: 'I’ll represent the payment lifecycle explicitly as an enum, because state transitions are the main business rules here.',
      code: `import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

enum PaymentStatus { CREATED, PROCESSING, SUCCESS, FAILED }`,
      explain: 'An enum makes illegal states unrepresentable: there is no way to set status to "DONE" or a typo. The four values mirror the hero flow exactly.',
      principle: 'Encapsulation of valid values',
    },
    {
      title: 'Payment: fields and constructor',
      slot: '17–20',
      phase: 'Domain',
      say: 'Payment is the core entity. Most fields are final because an amount or key should never change after creation. I store money as paise in a long to avoid floating-point errors.',
      code: `class Payment {
    private final String id;
    private final String idempotencyKey;
    private final String userId;
    private final long amountInPaise;
    private PaymentStatus status = PaymentStatus.CREATED;
    private String failureReason;

    Payment(String id, String idempotencyKey, String userId, long amountInPaise) {
        if (amountInPaise <= 0) throw new IllegalArgumentException("Amount must be positive");
        this.id = id;
        this.idempotencyKey = idempotencyKey;
        this.userId = userId;
        this.amountInPaise = amountInPaise;
    }
`,
      explain: 'The constructor enforces the first rule (positive amount), so an invalid Payment can never exist. Only status and failureReason are mutable, and only the methods in the next block can change them.',
      principle: 'Encapsulation and invariants in the constructor',
    },
    {
      title: 'Payment: state transitions',
      slot: '20–30',
      phase: 'Business logic',
      inside: 'Payment',
      say: 'I’ll keep payment state transitions inside the Payment entity so that callers cannot arbitrarily modify its lifecycle. Each method checks the current state first.',
      code: `    void startProcessing() {
        requireStatus(PaymentStatus.CREATED);
        status = PaymentStatus.PROCESSING;
    }

    void markSuccess() {
        requireStatus(PaymentStatus.PROCESSING);
        status = PaymentStatus.SUCCESS;
    }

    void markFailed(String reason) {
        requireStatus(PaymentStatus.PROCESSING);
        status = PaymentStatus.FAILED;
        failureReason = reason;
    }

    private void requireStatus(PaymentStatus expected) {
        if (status != expected) {
            throw new IllegalStateException("Payment " + id + " is " + status + ", expected " + expected);
        }
    }

    String getId() { return id; }
    String getIdempotencyKey() { return idempotencyKey; }
    PaymentStatus getStatus() { return status; }
    String getFailureReason() { return failureReason; }
}`,
      explain: 'There is no setStatus(). The only way to change state is through named transitions that refuse illegal moves, so a late "failed" callback can’t overwrite a SUCCESS. The one shared guard, requireStatus(), keeps each transition to two lines.',
      principle: 'Encapsulation: behaviour lives with the data it protects',
    },
    {
      title: 'Interfaces: provider and repository',
      slot: '30–34',
      phase: 'Interfaces',
      say: 'The provider is an external system and storage will change, so the service will depend on these two interfaces, not on concrete classes.',
      code: `
record ChargeResult(boolean success, String reason) {}

interface PaymentProvider {
    ChargeResult charge(String paymentId, long amountInPaise);
}

interface PaymentRepository {
    void save(Payment payment);
    Optional<Payment> findById(String id);
    Optional<Payment> findByIdempotencyKey(String key);
}`,
      explain: 'ChargeResult is a record: a tiny immutable value that carries the provider’s answer. findByIdempotencyKey exists because the hero flow needs it; I only add repository methods the flow actually uses.',
      principle: 'Dependency inversion: depend on abstractions',
    },
    {
      title: 'In-memory repository and fake provider',
      slot: '34–38',
      phase: 'Interfaces',
      say: 'For the interview I’ll use an in-memory repository, while keeping the service dependent on the interface so persistence can later be replaced with a database. The fake provider declines anything above a limit so I can test both outcomes.',
      code: `
class InMemoryPaymentRepository implements PaymentRepository {
    private final Map<String, Payment> byId = new ConcurrentHashMap<>();
    private final Map<String, Payment> byKey = new ConcurrentHashMap<>();

    public void save(Payment payment) {
        byId.put(payment.getId(), payment);
        byKey.put(payment.getIdempotencyKey(), payment);
    }

    public Optional<Payment> findById(String id) { return Optional.ofNullable(byId.get(id)); }

    public Optional<Payment> findByIdempotencyKey(String key) { return Optional.ofNullable(byKey.get(key)); }
}

class FakeProvider implements PaymentProvider {
    private final long limitInPaise;

    FakeProvider(long limitInPaise) { this.limitInPaise = limitInPaise; }

    public ChargeResult charge(String paymentId, long amountInPaise) {
        if (amountInPaise > limitInPaise) return new ChargeResult(false, "LIMIT_EXCEEDED");
        return new ChargeResult(true, null);
    }
}`,
      explain: 'Two maps give O(1) lookup by ID and by idempotency key. ConcurrentHashMap keeps individual reads and writes thread-safe. The fake provider is the whole point of the interface: the service can be tested without a real gateway.',
      principle: 'Liskov substitution: any implementation can stand in',
    },
    {
      title: 'PaymentService: the workflow',
      slot: '38–45',
      phase: 'Service',
      say: 'The service orchestrates: check the idempotency key, create the payment, mark it processing and save it before the external call, then record the provider’s answer. It contains no state rules of its own; those stay in Payment.',
      code: `
class PaymentService {
    private final PaymentRepository repository;
    private final PaymentProvider provider;
    private int nextId = 1;

    PaymentService(PaymentRepository repository, PaymentProvider provider) {
        this.repository = repository;
        this.provider = provider;
    }

    synchronized Payment pay(String userId, long amountInPaise, String idempotencyKey) {
        Optional<Payment> existing = repository.findByIdempotencyKey(idempotencyKey);
        if (existing.isPresent()) return existing.get();

        Payment payment = new Payment("P" + nextId++, idempotencyKey, userId, amountInPaise);
        payment.startProcessing();
        repository.save(payment);

        ChargeResult result = provider.charge(payment.getId(), amountInPaise);
        if (result.success()) payment.markSuccess();
        else payment.markFailed(result.reason());
        repository.save(payment);
        return payment;
    }

    PaymentStatus getStatus(String paymentId) {
        return repository.findById(paymentId)
                .map(Payment::getStatus)
                .orElseThrow(() -> new NoSuchElementException("Unknown payment " + paymentId));
    }
}`,
      explain: 'Constructor injection means the service never creates its own dependencies, so tests pass in fakes. synchronized makes "check key, then create" atomic: two identical retries arriving together can’t both create a payment. Saving as PROCESSING before the external call means a crash mid-call still leaves a record to reconcile.',
      principle: 'Single responsibility: the service orchestrates, the entity decides',
    },
    {
      title: 'main(): run the hero flow and one edge case',
      slot: '45–50',
      phase: 'Test',
      say: 'Let me run the hero flow: a successful payment, a retry with the same key, a declined payment, and an illegal transition to prove the entity protects itself.',
      code: `
public class Main {
    public static void main(String[] args) {
        PaymentService service = new PaymentService(new InMemoryPaymentRepository(), new FakeProvider(50_000_00));

        Payment p1 = service.pay("user-1", 1_500_00, "order-42");
        System.out.println(p1.getId() + " -> " + p1.getStatus());

        Payment retry = service.pay("user-1", 1_500_00, "order-42");
        System.out.println("Retry of order-42 returns " + retry.getId() + " (same payment: " + (retry == p1) + ")");

        Payment big = service.pay("user-2", 90_000_00, "order-43");
        System.out.println(big.getId() + " -> " + big.getStatus() + " (" + big.getFailureReason() + ")");

        try {
            p1.markFailed("late callback");
        } catch (IllegalStateException e) {
            System.out.println("Blocked: " + e.getMessage());
        }
        System.out.println("Status of P1: " + service.getStatus("P1"));
    }
}`,
      explain: 'Four lines of output cover the hero flow (SUCCESS), idempotency (same object back), the failure path (FAILED with a reason) and the invariant (a late callback cannot flip SUCCESS).',
      principle: 'Test the behaviour you promised in the requirements',
    },
  ],

  test: {
    output: `P1 -> SUCCESS
Retry of order-42 returns P1 (same payment: true)
P2 -> FAILED (LIMIT_EXCEEDED)
Blocked: Payment P1 is SUCCESS, expected PROCESSING
Status of P1: SUCCESS`,
    say: 'The retry returned the same payment instead of charging again, the decline recorded a reason, and the entity refused to move a successful payment to FAILED.',
  },

  edgeCases: [
    { problem: 'Duplicate payment', why: 'The client times out and retries the same request.', how: 'Idempotency key lookup before creating. The same key returns the existing payment.' },
    { problem: 'Two identical retries at the same moment', why: 'Both threads check the key, both see nothing, both create.', how: 'pay() is synchronized, so check-then-create is atomic. At LLD level that’s enough; at scale I’d lock per key or use a unique constraint on the key in the database.', hld: 'A global lock becomes a bottleneck; partition by idempotency key and rely on a unique index.' },
    { problem: 'Same key, different amount', why: 'A client bug reuses a key for a new order.', how: 'Compare the stored amount with the request and reject the mismatch instead of returning the old payment.' },
    { problem: 'Provider times out or throws', why: 'The network fails after the gateway may already have charged the card.', how: 'The payment stays PROCESSING on purpose; we don’t know whether money moved. A status check against the provider later resolves it (extension: reconciliation).' },
    { problem: 'Late or duplicate provider callback', why: 'Gateways resend webhooks.', how: 'Payment.markSuccess / markFailed only accept PROCESSING, so a second callback is rejected by the entity.' },
  ],

  extensions: [
    { ask: 'How would you add refunds?', current: 'Payment ends at SUCCESS or FAILED.', next: 'Full and partial refunds', change: 'Add REFUNDED / PARTIALLY_REFUNDED states and a Refund entity linked to Payment; refund() guarded to SUCCESS only.' },
    { ask: 'What if we support UPI, card and wallet?', current: 'One way to pay.', next: 'Several payment methods', change: 'Strategy: a PaymentMethod interface chosen per request, because each method validates and charges differently.' },
    { ask: 'What if we add a second gateway?', current: 'Single provider behind an interface.', next: 'Multiple providers with fallback', change: 'Adapter per gateway behind PaymentProvider, plus a routing policy that picks one.' },
    { ask: 'How do you resolve payments stuck in PROCESSING?', current: 'They stay PROCESSING.', next: 'Retries and reconciliation', change: 'A retry policy with backoff and a reconciliation job that asks the provider for the final status.' },
    { ask: 'The idempotency map is lost on restart. Is that okay?', current: 'In-memory idempotency.', next: 'Durable idempotency', change: 'Store keys in the database with a unique constraint; the Repository interface doesn’t change.' },
  ],

  wrongTurns: [
    { phase: 'patterns', ask: 'Should the Payment object really know which database we’re using?', wrong: 'Payment.saveToDatabase()', answer: 'No. Payment owns business rules; persistence is a separate responsibility. That’s why saving goes through PaymentRepository, so swapping HashMap for SQL touches one class.' },
    { phase: 'entities', ask: 'If PaymentService has a setStatus() call, what stops a bug from marking a failed payment successful?', wrong: 'service calls payment.setStatus(SUCCESS)', answer: 'Nothing. Put the rule where the data is: named transitions on Payment that check the current state.' },
  ],

  summary: {
    problem: 'Charge a user through one provider and track the payment to a final state, safely under retries.',
    requirements: 'Create, charge, track status, fetch status. NFRs: correctness, idempotency, auditability.',
    entities: 'Payment (entity), PaymentStatus (enum), PaymentProvider and PaymentRepository (interfaces), PaymentService.',
    relationships: 'Service orchestrates; Payment owns state; Repository stores; Provider is external.',
    heroFlow: 'key check → create → PROCESSING → save → charge → SUCCESS/FAILED → save.',
    patterns: 'Repository, interface for the external provider, state transitions inside the entity.',
    codeOrder: 'enum → Payment → transitions → interfaces → in-memory + fake → service → main.',
    edgeCases: 'Duplicate and concurrent retries, key reuse, provider timeout, late callbacks.',
    final: 'Scope first, rules in the entity, workflow in the service, the outside world behind interfaces.',
  },
  answer30s: 'I scoped the system to creating a payment, charging it through one provider, and tracking it to SUCCESS or FAILED, with idempotency so retries never double charge. Payment is the core entity and owns its state transitions, so illegal moves are impossible. PaymentService orchestrates the flow and depends on two interfaces: a repository for persistence and a provider for the external gateway, which keeps both swappable. Concurrency is handled by making the check-then-create step atomic, and a provider timeout leaves the payment in PROCESSING for reconciliation. Refunds, multiple payment methods and multiple gateways extend cleanly through new states, Strategy and adapters.',
  checklist: [
    'I can scope the prompt in under a minute and name what I’m parking',
    'I can explain why User is a field and not a class here',
    'I can say why state transitions live in Payment, not PaymentService',
    'I can explain what the Repository interface buys us',
    'I can write the Payment entity from memory',
    'I can explain what happens when two identical retries arrive together',
    'I can explain why a timeout leaves the payment in PROCESSING',
    'I can give the 30-second summary without notes',
  ],
};
