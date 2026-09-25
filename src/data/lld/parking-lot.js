// LLD case: Parking Lot. Blocks concatenate, in order, into one runnable Main.java.
export default {
  id: 'parking-lot',
  prompt: 'Design a parking lot.',
  vague: 'Everyone has seen a parking lot, so it is tempting to add floors, EV chargers, cameras and apps. The interviewer is watching whether you agree a small scope first.',

  requirements: {
    ask: 'What are your functional requirements?',
    dialogue: [
      {
        interviewer: 'Design a parking lot.',
        you: 'Let me scope it. A vehicle arrives, we find a free spot that fits it, and issue a ticket. On exit, the ticket gives us the duration and we charge an hourly rate by vehicle type. I’ll support bikes, cars and trucks. Multiple floors, EV charging and reservations I’d keep as extensions. Does that work?',
        why: 'You define the hero flow (enter → ticket → exit → pay) and park the tempting features out loud.',
      },
      {
        interviewer: 'Can a bike park in a car spot?',
        you: 'For now each vehicle type needs its own spot type. I’ll keep the fitting rule in one place so we can relax it later.',
        why: 'Asking or answering this early shapes where the rule lives (the spot decides what fits).',
      },
      {
        interviewer: 'What if two cars arrive at the same time?',
        you: 'They must never get the same spot. I’ll make spot assignment atomic.',
        why: 'The one concurrency concern that matters for this problem, named up front.',
      },
    ],
    functional: [
      'Park a vehicle (bike, car or truck) in a free spot of its type and issue a ticket',
      'Reject the vehicle if no suitable spot is free',
      'Unpark with a ticket: free the spot and return the fee',
      'Fee = hours parked, rounded up (minimum 1), × hourly rate for the vehicle type',
    ],
    constraints: [
      'Single entry/exit, single floor (spots listed nearest to the gate first)',
      'One vehicle per spot; spot type must match vehicle type',
      'Payment itself is out of scope; we only compute the fee',
    ],
    hero: 'A car enters, gets the nearest free car spot and a ticket, leaves later and pays for the hours used; the spot becomes free again.',
    nfrs: [
      ['Correctness', 'No two vehicles in one spot; a ticket can be used only once.'],
      ['Concurrency', 'Simultaneous arrivals must not race for the same spot.'],
    ],
    parked: ['Multiple floors and display boards', 'EV charging spots', 'Reservations', 'Monthly passes / dynamic pricing', 'Actual payment processing'],
  },

  entities: {
    ask: 'What are your core entities?',
    nouns: [
      ['Parking lot', 'Service', 'The entry point that coordinates spots and tickets. It orchestrates rather than holding rules about a single spot.'],
      ['Spot', 'Entity', 'Has identity and state (free or occupied) and a rule about what fits.'],
      ['Vehicle', 'Value (record)', 'A plate and a type; it never changes while parked, so an immutable record is enough.'],
      ['Vehicle type', 'Enum', 'BIKE, CAR, TRUCK: a fixed set that drives both fitting and pricing.'],
      ['Ticket', 'Entity', 'Has identity and a lifecycle (open → closed) and owns the duration rule.'],
      ['Gate', 'Not a class', 'Single entry and exit, no behaviour of its own. Calling ParkingLot.park() is the gate.'],
      ['Floor', 'Not a class (yet)', 'Out of scope. It becomes a class when we add floors as an extension.'],
    ],
    verbs: [
      ['park', 'ParkingLot.park()'],
      ['find a spot', 'SpotAllocationStrategy.findSpot()'],
      ['occupy / free a spot', 'ParkingSpot.park(), ParkingSpot.release()'],
      ['close ticket, compute hours', 'Ticket.close()'],
      ['unpark and charge', 'ParkingLot.unpark()'],
    ],
    rules: [
      ['A spot fits only a free vehicle of its type', 'ParkingSpot.canFit()'],
      ['A ticket closes once', 'Ticket.close()'],
      ['Hours round up, minimum 1', 'Ticket.close()'],
      ['Which free spot to pick', 'SpotAllocationStrategy'],
    ],
    list: [
      { name: 'ParkingSpot', kind: 'Entity', attrs: 'id, type, parked vehicle', does: 'Decides whether a vehicle fits; occupies and frees itself.' },
      { name: 'Ticket', kind: 'Entity', attrs: 'id, vehicle, spot, entryTime, exitTime', does: 'Closes once and computes billable hours.' },
      { name: 'Vehicle', kind: 'Value (record)', attrs: 'plate, type', does: 'Describes what is parking.' },
      { name: 'VehicleType', kind: 'Enum', attrs: 'BIKE, CAR, TRUCK', does: 'Drives fitting and the hourly rate.' },
      { name: 'SpotAllocationStrategy', kind: 'Interface', attrs: '—', does: 'Chooses which free spot to use.' },
      { name: 'ParkingLot', kind: 'Service', attrs: 'spots, strategy, rates, active tickets', does: 'Orchestrates park and unpark.' },
    ],
    diagram: `ParkingLot (service)
 |
 | 1:N owns
 v
ParkingSpot ----0..1----> Vehicle --> VehicleType
 ^
 | refers to
 |
Ticket ------------------> Vehicle
 ^
 | 1:N active tickets
 |
ParkingLot ----uses----> SpotAllocationStrategy`,
    say: 'The nouns give me lot, spot, vehicle and ticket. Gate and floor are nouns too, but with one gate and one floor they have no behaviour, so they are not classes yet.',
  },

  relations: {
    ask: 'Who owns what? Walk me through the main flow.',
    rows: [
      { from: 'ParkingLot', to: 'ParkingSpot', card: '1:N', kind: 'Owns (composition)', why: 'Spots are created with the lot and don’t exist outside it.' },
      { from: 'ParkingSpot', to: 'Vehicle', card: '1:0..1', kind: 'Holds', why: 'A spot has at most one vehicle; the vehicle exists independently.' },
      { from: 'Ticket', to: 'ParkingSpot', card: 'N:1', kind: 'Refers to', why: 'Over time many tickets use the same spot; the ticket needs it to free it on exit.' },
      { from: 'ParkingLot', to: 'Ticket', card: '1:N', kind: 'Tracks active', why: 'The lot looks tickets up on exit and removes them once used.' },
      { from: 'ParkingLot', to: 'SpotAllocationStrategy', card: '1:1', kind: 'Depends on (interface)', why: 'The rule for picking a spot can change without touching the lot.' },
    ],
    ownership: 'ParkingLot orchestrates park and unpark; each ParkingSpot owns whether it is free and what fits; each Ticket owns its duration rule.',
    heroFlow: `Car arrives
 |  park(vehicle, now)
 v
ParkingLot  (synchronized)
 |  1. strategy.findSpot(spots, vehicle)  --none--> reject "No spot"
 |  2. spot.park(vehicle)                 [spot occupied]
 |  3. new Ticket(vehicle, spot, now)     [ticket open]
 |  4. activeTickets.put(ticket)
 v
return ticket
 ...
unpark(ticketId, now)
 |  1. activeTickets.remove(id)  --missing--> reject "Unknown or used ticket"
 |  2. ticket.close(now) -> hours          [ticket closed]
 |  3. spot.release()                      [spot free]
 v
fee = hours x rate[vehicle type]`,
    notes: [
      ['Internal calls', 'Lot → strategy, lot → spot, lot → ticket. No external systems in this scope.'],
      ['State transitions', 'Spot: free → occupied → free. Ticket: open → closed.'],
      ['Business decisions', 'Removing the ticket from active tickets on exit is what makes a ticket single-use.'],
      ['Concurrency point', 'Find spot + occupy spot must happen together, or two cars get the same spot.'],
    ],
  },

  patterns: {
    ask: 'Which patterns are you using, and why?',
    rows: [
      { name: 'Strategy', problem: 'The rule for choosing a spot varies (nearest to gate, nearest to lift, spread wear, VIP) and should change independently of park/unpark.', where: 'SpotAllocationStrategy + NearestFirstStrategy', say: 'I’m using Strategy for spot allocation because the selection rule can change independently from the parking flow.' },
      { name: 'Rules inside entities', problem: 'Fitting and ticket rules must not be scattered through the service.', where: 'ParkingSpot.canFit / park / release, Ticket.close', say: 'The spot decides what fits and the ticket decides how long it was used, so the lot just coordinates.' },
    ],
    rejected: [
      ['Factory for vehicles', 'A Vehicle is a record with a type; there is no varying creation logic.'],
      ['Subclasses Car / Bike / Truck', 'They would differ only by type, which the enum already captures. Subclass when behaviour differs.'],
      ['Singleton ParkingLot', 'Makes testing harder and adds nothing; create one lot and pass it around.'],
      ['Strategy for pricing', 'Hourly rate by type is a lookup today. It becomes a Strategy when pricing rules vary (weekend, dynamic).'],
    ],
    layers: `ParkingLot                  (orchestration)
  |
  +----> ParkingSpot, Ticket  (domain: rules + state)
  |
  +----> SpotAllocationStrategy (swappable rule) <-- NearestFirstStrategy
  |
  +----> activeTickets map    (in-memory store for the interview)`,
    roles: [
      ['Service', 'ParkingLot', 'Runs park and unpark, keeps them atomic.'],
      ['Domain entities', 'ParkingSpot, Ticket', 'Own occupancy, fitting and duration rules.'],
      ['Strategy', 'SpotAllocationStrategy', 'Picks a spot; no state changes.'],
      ['Repository', '(a map inside ParkingLot)', 'Kept as a map to stay small; extract a TicketRepository if persistence is asked for.'],
    ],
    plan: ['VehicleType enum + Vehicle record', 'ParkingSpot', 'Ticket', 'SpotAllocationStrategy + NearestFirstStrategy', 'ParkingLot', 'main() test'],
    transition: 'I have the entities, who owns what, and the one strategy. I’ll code the domain first (vehicle, spot, ticket), then the allocation strategy, then the ParkingLot service, and run the hero flow in main().',
  },

  blocks: [
    {
      title: 'Imports, vehicle type and vehicle',
      slot: '15–17',
      phase: 'Domain',
      say: 'VehicleType is an enum because the set is fixed and it drives both fitting and pricing. A Vehicle never changes while parked, so it’s an immutable record.',
      code: `import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

enum VehicleType { BIKE, CAR, TRUCK }

record Vehicle(String plate, VehicleType type) {}`,
      explain: 'A record gives equals, hashCode and accessors for free. No Car/Bike/Truck subclasses: they wouldn’t behave differently, so the enum is enough.',
      principle: 'Prefer simple values over inheritance when behaviour doesn’t differ',
    },
    {
      title: 'ParkingSpot: occupancy and fitting rule',
      slot: '17–22',
      phase: 'Domain',
      say: 'The spot owns the rule about what fits and guards its own occupancy, so no caller can double-park it.',
      code: `
class ParkingSpot {
    private final String id;
    private final VehicleType type;
    private Vehicle parked;

    ParkingSpot(String id, VehicleType type) {
        this.id = id;
        this.type = type;
    }

    boolean canFit(Vehicle vehicle) { return parked == null && vehicle.type() == type; }

    void park(Vehicle vehicle) {
        if (!canFit(vehicle)) throw new IllegalStateException("Spot " + id + " cannot take " + vehicle.plate());
        parked = vehicle;
    }

    void release() {
        if (parked == null) throw new IllegalStateException("Spot " + id + " is already free");
        parked = null;
    }

    String getId() { return id; }
}`,
      explain: 'canFit() is the single place the fitting rule lives; relaxing it later (a bike in a car spot) is a one-line change. park() re-checks canFit() so even a buggy caller can’t put two vehicles in one spot.',
      principle: 'Encapsulation: the spot protects its own state',
    },
    {
      title: 'Ticket: single use and billable hours',
      slot: '22–30',
      phase: 'Business logic',
      say: 'The ticket owns the time rules: it can close only once, and hours round up with a minimum of one.',
      code: `
class Ticket {
    private final String id;
    private final Vehicle vehicle;
    private final ParkingSpot spot;
    private final LocalDateTime entryTime;
    private LocalDateTime exitTime;

    Ticket(String id, Vehicle vehicle, ParkingSpot spot, LocalDateTime entryTime) {
        this.id = id;
        this.vehicle = vehicle;
        this.spot = spot;
        this.entryTime = entryTime;
    }

    long close(LocalDateTime exit) {
        if (exitTime != null) throw new IllegalStateException("Ticket " + id + " already closed");
        exitTime = exit;
        long minutes = Duration.between(entryTime, exit).toMinutes();
        return Math.max(1, (minutes + 59) / 60);
    }

    String getId() { return id; }
    Vehicle getVehicle() { return vehicle; }
    ParkingSpot getSpot() { return spot; }
}`,
      explain: 'Time is passed in rather than read from the clock, which makes the fee testable. (minutes + 59) / 60 is integer rounding up, so 2h30m bills 3 hours. Returning hours, not rupees, keeps pricing out of the ticket.',
      principle: 'Single responsibility: the ticket knows time, not prices',
    },
    {
      title: 'Spot allocation strategy',
      slot: '30–35',
      phase: 'Interfaces',
      say: 'Choosing a spot is the rule most likely to change, so it sits behind an interface. The first implementation picks the nearest free spot, since spots are listed nearest to the gate first.',
      code: `
interface SpotAllocationStrategy {
    Optional<ParkingSpot> findSpot(List<ParkingSpot> spots, Vehicle vehicle);
}

class NearestFirstStrategy implements SpotAllocationStrategy {
    public Optional<ParkingSpot> findSpot(List<ParkingSpot> spots, Vehicle vehicle) {
        return spots.stream().filter(s -> s.canFit(vehicle)).findFirst();
    }
}`,
      explain: 'The strategy only chooses; it never changes a spot’s state. It returns Optional so “lot full” is an explicit case the service must handle, not a null.',
      principle: 'Open/closed: add a new allocation rule without editing ParkingLot',
    },
    {
      title: 'ParkingLot: park and unpark',
      slot: '35–45',
      phase: 'Service',
      say: 'ParkingLot orchestrates. park() finds a spot, occupies it and issues a ticket; unpark() consumes the ticket, frees the spot and returns the fee. Both are synchronized so two cars can’t take the same spot.',
      code: `
class ParkingLot {
    private final List<ParkingSpot> spots;
    private final SpotAllocationStrategy strategy;
    private final Map<VehicleType, Long> hourlyRates;
    private final Map<String, Ticket> activeTickets = new HashMap<>();
    private int nextTicket = 1;

    ParkingLot(List<ParkingSpot> spots, SpotAllocationStrategy strategy, Map<VehicleType, Long> hourlyRates) {
        this.spots = spots;
        this.strategy = strategy;
        this.hourlyRates = hourlyRates;
    }

    synchronized Ticket park(Vehicle vehicle, LocalDateTime now) {
        ParkingSpot spot = strategy.findSpot(spots, vehicle)
                .orElseThrow(() -> new IllegalStateException("No spot for " + vehicle.type()));
        spot.park(vehicle);
        Ticket ticket = new Ticket("T" + nextTicket++, vehicle, spot, now);
        activeTickets.put(ticket.getId(), ticket);
        return ticket;
    }

    synchronized long unpark(String ticketId, LocalDateTime now) {
        Ticket ticket = activeTickets.remove(ticketId);
        if (ticket == null) throw new IllegalArgumentException("Unknown or used ticket " + ticketId);
        long hours = ticket.close(now);
        ticket.getSpot().release();
        return hours * hourlyRates.get(ticket.getVehicle().type());
    }
}`,
      explain: 'synchronized makes “find a free spot, then occupy it” one atomic step; without it two threads can both see C1 free. activeTickets.remove() is what makes a ticket single-use. The service has no fitting or rounding logic, only the order of steps.',
      principle: 'Single responsibility: orchestration only',
    },
    {
      title: 'main(): hero flow, lot full, reused ticket',
      slot: '45–50',
      phase: 'Test',
      say: 'Let me run it: two cars fill the car spots, a third is rejected, the first leaves after 2h30m and pays for 3 hours, the third car gets the freed spot, and the used ticket is refused.',
      code: `
public class Main {
    public static void main(String[] args) {
        List<ParkingSpot> spots = List.of(
                new ParkingSpot("B1", VehicleType.BIKE),
                new ParkingSpot("C1", VehicleType.CAR),
                new ParkingSpot("C2", VehicleType.CAR),
                new ParkingSpot("T1", VehicleType.TRUCK));
        Map<VehicleType, Long> rates = Map.of(VehicleType.BIKE, 20L, VehicleType.CAR, 50L, VehicleType.TRUCK, 100L);
        ParkingLot lot = new ParkingLot(spots, new NearestFirstStrategy(), rates);
        LocalDateTime nine = LocalDateTime.of(2026, 9, 25, 9, 0);

        Ticket a = lot.park(new Vehicle("KA-01", VehicleType.CAR), nine);
        Ticket b = lot.park(new Vehicle("KA-02", VehicleType.CAR), nine);
        System.out.println(a.getId() + " -> " + a.getSpot().getId() + ", " + b.getId() + " -> " + b.getSpot().getId());

        try {
            lot.park(new Vehicle("KA-03", VehicleType.CAR), nine);
        } catch (IllegalStateException e) {
            System.out.println("Rejected: " + e.getMessage());
        }

        System.out.println("KA-01 pays Rs " + lot.unpark(a.getId(), nine.plusMinutes(150)) + " for 2h30m");
        Ticket c = lot.park(new Vehicle("KA-03", VehicleType.CAR), nine.plusHours(3));
        System.out.println("KA-03 gets freed spot " + c.getSpot().getId());

        try {
            lot.unpark(a.getId(), nine.plusHours(4));
        } catch (IllegalArgumentException e) {
            System.out.println("Rejected: " + e.getMessage());
        }
    }
}`,
      explain: 'The run covers the hero flow, the full-lot rejection, rounding up (150 minutes bills 3 hours at Rs 50), spot reuse and single-use tickets.',
      principle: 'Test the behaviour you promised in the requirements',
    },
  ],

  test: {
    output: `T1 -> C1, T2 -> C2
Rejected: No spot for CAR
KA-01 pays Rs 150 for 2h30m
KA-03 gets freed spot C1
Rejected: Unknown or used ticket T1`,
    say: 'Nearest-first put the cars in C1 and C2, the full lot rejected the third car, the fee rounded up to 3 hours, the freed spot was reused, and the old ticket could not be used twice.',
  },

  edgeCases: [
    { problem: 'Two cars get the same spot', why: 'Both threads run findSpot() before either calls park().', how: 'park() is synchronized, so find + occupy is atomic. ParkingSpot.park() also re-checks canFit() as a second guard.', hld: 'With many gates on separate servers, one lock is a bottleneck: partition spots by zone, each owned by one process, or use a conditional update in the database.' },
    { problem: 'Lot is full', why: 'No spot of that type is free.', how: 'The strategy returns an empty Optional and park() rejects with a clear message.' },
    { problem: 'Ticket used twice or forged', why: 'A photocopied or replayed ticket.', how: 'unpark() removes the ticket from active tickets; an unknown or used ID is rejected.' },
    { problem: 'Same vehicle parked twice', why: 'A plate is entered twice at the gate.', how: 'Keep a plate → ticket map and reject a plate that already has an active ticket (a two-line addition).' },
    { problem: 'Exit time before entry time', why: 'Clock skew or bad input.', how: 'Math.max(1, …) never charges less than one hour; validate exit ≥ entry if the interviewer pushes.' },
  ],

  extensions: [
    { ask: 'How would you add multiple floors?', current: 'One list of spots.', next: 'Floors with their own spots', change: 'A Floor class owns its spots (composition); the lot owns floors; the strategy searches floors in order.' },
    { ask: 'What about EV charging spots?', current: 'Spot type must equal vehicle type.', next: 'EV spots that also accept normal cars', change: 'Move the fitting rule into canFit() per spot kind (or a SpotType with a fits() rule); the strategy can prefer non-EV spots for non-EV cars.' },
    { ask: 'Weekend and peak pricing?', current: 'Fixed hourly rate per type.', next: 'Pricing that varies by time', change: 'Strategy: a PricingStrategy(ticket) → fee, because pricing now changes independently of parking.' },
    { ask: 'Show free spots on a display board at the entrance?', current: 'No displays.', next: 'Live availability boards', change: 'Observer: the lot publishes spot-taken / spot-freed events to registered boards.' },
    { ask: 'Many entry gates on different machines?', current: 'One synchronized ParkingLot.', next: 'Concurrent gates', change: 'Lock per spot or per zone, or optimistic updates on the spot row; at HLD level, a spot-allocation service.' },
  ],

  wrongTurns: [
    { phase: 'entities', ask: 'Do Car, Bike and Truck behave differently anywhere in our scope?', wrong: 'abstract class Vehicle with Car, Bike, Truck subclasses', answer: 'No, they only differ by type and rate. Subclasses add classes without adding behaviour; an enum plus a record is simpler. Subclass when behaviour genuinely differs.' },
    { phase: 'patterns', ask: 'If the fee calculation lives inside ParkingLot.unpark() as a big if/else on vehicle type, what happens when pricing changes?', wrong: 'if (type == CAR) fee = ... else if (type == BIKE) ...', answer: 'Every pricing change edits the service. A rate lookup keeps it small today; when rules really vary, extract a PricingStrategy.' },
  ],

  summary: {
    problem: 'Park vehicles into matching spots, issue tickets, and charge by the hour on exit.',
    requirements: 'Park, reject when full, unpark with a ticket, fee = rounded-up hours × rate. NFRs: correctness, concurrency.',
    entities: 'ParkingSpot and Ticket (entities), Vehicle (record), VehicleType (enum), SpotAllocationStrategy, ParkingLot (service).',
    relationships: 'Lot owns spots; spot holds 0..1 vehicle; ticket refers to spot; lot tracks active tickets.',
    heroFlow: 'find spot → occupy → ticket → … → remove ticket → close → release spot → fee.',
    patterns: 'Strategy for spot allocation; rules inside spot and ticket.',
    codeOrder: 'enum + record → ParkingSpot → Ticket → strategy → ParkingLot → main.',
    edgeCases: 'Race for a spot, full lot, reused ticket, duplicate plate, bad times.',
    final: 'Small scope, rules in the spot and ticket, one strategy where the rule really varies, atomic assignment.',
  },
  answer30s: 'I scoped it to one floor with bike, car and truck spots: park a vehicle into a free matching spot, issue a ticket, and on exit charge rounded-up hours times a per-type rate. ParkingSpot owns occupancy and the fitting rule, Ticket owns single use and billable hours, and ParkingLot just orchestrates. Spot selection sits behind a Strategy because that rule changes independently. park and unpark are synchronized so two cars can never get the same spot, and used tickets are rejected. Floors, EV spots, dynamic pricing and display boards extend it through composition, a pricing Strategy and Observer.',
  checklist: [
    'I can scope the parking lot in under a minute and park the extras out loud',
    'I can explain why Gate and Floor are not classes in this scope',
    'I can explain why there are no Car/Bike/Truck subclasses',
    'I can say why spot allocation is a Strategy but pricing is not (yet)',
    'I can write ParkingSpot and Ticket from memory',
    'I can explain the race between two arriving cars and how synchronized fixes it',
    'I can give the 30-second summary without notes',
  ],
};
