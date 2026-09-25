# Blueprint

Learn system design by watching it run. Blueprint is an interactive site for interview prep: high-level design (HLD) with animated architectures, simulators and case studies, and low-level design (LLD) rehearsed the way a 60-minute interview actually runs.

## What's inside

### High-level design
- **Learn:** 24 concepts in 6 tracks (foundations, scaling, data, communication, reliability, distributed systems). Each starts with a plain-English analogy and "What / Why / How" cards, then goes deeper, with trade-offs and a quiz.
- **Case studies:** 9 systems designed end to end: URL shortener, news feed, chat, video streaming, ride hailing, notifications, typeahead, web crawler and payments. Each has requirements, a live capacity estimator, API tables, animated request flows, deep dives and trade-offs.
- **Data models with queries:** every table shows its keys (primary, partition, sort, unique, index, TTL) and an example value per field, followed by the queries the design runs (SQL, CQL, Redis, Kafka), how often they run, and which key or index serves them.
- **Lab:** 6 simulators you can break: load balancer, consistent hashing, cache eviction, rate limiter, replication and queues.
- **Sandbox, Practice, Cheat sheet, References:** draw your own architecture, take mixed quizzes, and look up latency numbers and reading material.

### Low-level design (`#/lld`)
Each case follows the interview timeline instead of a textbook layout:

| Minutes | Phase |
|---|---|
| 0–15 | Requirements, entities, relationships and hero flow, patterns and class design |
| 15–50 | Coding with live explanation: domain classes, business logic, interfaces, service, `main()` test |
| 50–60 | Edge cases and concurrency, extensions, final summary |

- **Scoped requirements:** what the interviewer says, what you say, and why; the hero use case; only the NFRs that matter; features deliberately parked as extensions.
- **Derived entities:** nouns become classes (or not, with the reason), verbs become methods, rules find the class they live in. Text diagrams you can redraw in the interview.
- **Say, code, explain:** the Java solution comes in small ordered blocks. Each block pairs what to say, the exact code and why it exists. Together the blocks form one runnable `Main.java` of 80–150 lines.
- **Coach and Interview modes:** Coach mode shows everything. Interview mode asks the interviewer's question first; you write your answer (saved in the browser), then reveal the ideal one.
- **Practice timer, "Correct me" prompts, edge cases, extensions, a cheat sheet with a 30-second answer, a checklist and a quiz.**

Ready now: **Payment System** and **Parking Lot**. Thirteen more (Elevator, Vending Machine, ATM, Splitwise, Movie Booking, LRU Cache, Rate Limiter, Logger, Pub-Sub, Library, Hotel Booking, Food Delivery, Tic-Tac-Toe to Chess) are listed as coming next.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build on port 4174
```

### Checking the LLD Java

```bash
npm run check:lld            # all cases
npm run check:lld payment    # one case
```

The script joins each case's code blocks into one `Main.java`, compiles and runs it with `javac` and `java`, and fails if the output differs from what the page shows or the solution falls outside 80–150 lines. It needs a JDK installed.

## Project layout

```text
src/
  App.jsx               navigation, hash routes, progress ring
  pages/                Home, Learn, Cases, CaseStudy, Lld, Lab, Practice, Sandbox, Cheatsheet, References
  components/           FlowDiagram (animated SVG), Estimator, Content (quiz, trade-offs), Lld (code blocks, dialogues, reveal)
  sims/                 the six simulators
  data/
    concepts.js         HLD concepts and tracks
    cases.js            HLD case studies
    db.js               HLD keys, example rows and queries
    lld/                one file per LLD case, plus index.js (list and lazy loading)
  progress.js           progress, quiz scores, checklists and Interview-mode answers in localStorage
scripts/check-lld.mjs   compiles and runs every LLD case's Java
public/sw.js            service worker for offline use
```

React 18 and Vite, no other runtime dependencies. All content lives in `src/data`, so adding a case is adding a data file.
