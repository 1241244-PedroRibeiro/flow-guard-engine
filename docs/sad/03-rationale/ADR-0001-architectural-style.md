# ADR-0001: Architectural Style — Modular Monolith with Clean / Onion Architecture

- **Status:** Accepted

- **Context:**
The **FlowGuard** Industrial Line & Conveyor Telemetry Engine must ingest high-frequency sensor streams (belt velocity, motor vibration, bearing temperature, and optical throughput counters), execute real-time sliding-window statistical analysis in memory, enforce strict hierarchical topological constraints across plant sectors and conveyor lines, and expose a stateless RESTful API for operators, industrial engineers, and external monitoring systems (`01-problem-statement.md`, §1–§3; `02-context.md`, §2–§4).

Following the architectural guiding principles defined in our engineering methodology (KB §1.2, Principle 1 & Principle 6), software architecture decisions must precede implementation to prevent the codebase from degenerating into a *Big Ball of Mud* (KB §1.0). Specifically, FlowGuard faces three competing architectural forces:
1. **Rich Domain Invariants & Statistical Isolation:** The core domain logic—comprising topological state transitions, abstract spare-part unit calculations ($u \in \mathbb{N}_0$), and sliding-window anomaly detection rules—must remain 100% pure, deterministic, and verifiable in complete isolation from HTTP transport frameworks, database drivers, or external message brokers (KB §3.2, §7.2, §13.2).
2. **Low-Latency In-Memory Processing:** Evaluating sliding windows over incoming telemetry streams requires zero network serialization overhead between the ingestion boundary, the statistical filter, and the domain anomaly evaluator (KB §7.4, 1st Commandment of Distributed Systems: *"Do not distribute"*).
3. **Extensibility for the 20+ Hour Roadmap:** The system must cleanly accommodate upcoming roadmap increments—including automated webhook dispatchers, row-level locking strategies, and OpenMetrics/Prometheus scraping endpoints—without inducing cascading changes across existing business rules (`01-problem-statement.md`, §4).

We must select a macro-architectural deployment style and an internal component organization pattern that balance domain protection, runtime performance, and evolutionary modularity.

- **Decision:**
We adopt a **Modular Monolith** deployment model internally structured according to **Concentric Clean / Onion Architecture (Ports & Adapters)** principles (KB §7.2, §13.2):

1. **Macro-Architecture (Modular Monolith):**
   The entire FlowGuard engine is packaged and deployed as a single cohesive runtime unit partitioned into strict, vertical feature modules (`IdentityAndAccess`, `PlantTopology`, `TelemetryIngestion`, `AnomalyAlerting`, and `SparePartsInventory`). Inter-module communication occurs strictly through explicit public application interfaces or in-process domain events rather than cross-table SQL joins or shared mutable state (KB §3.3, §7.2).

2. **Internal Module Layering (Concentric Onion Rings & The Dependency Rule):**
   Every vertical module enforces **The Dependency Rule** (KB §7.2): all source code dependencies point exclusively **inward** toward the Domain Core. Inner layers define interfaces (*Ports*), while outer layers provide technical implementations (*Adapters*):
   - **Domain Ring (Innermost Core):** Contains pure TypeScript Domain Entities (`<<entity>>`), Aggregate Roots (`<<root>>`), immutable Value Objects (`<<value object>>`), Domain Events, and Domain Services (such as the in-memory sliding-window statistical calculator) (KB §3.2, §7.2). It has **zero dependencies** on NestJS, Express, PostgreSQL, or any external npm library.
   - **Application Ring (Use Cases & Ports):** Contains Application Services (`<UseCase>Service`), Input/Output Data Transfer Objects (DTOs), Data Assemblers/Mappers, and outbound *Port* interfaces (`ISensorNodeRepository`, `IConveyorLineRepository`, `IAlertWebhookDispatcher`) (KB §4.1, §7.2, §7.4). It orchestrates transactional boundaries and security checks while delegating all business calculations to the Domain Ring.
   - **Infrastructure & Presentation Ring (Outermost Adapters):**
     - *Driving (Primary) Adapters:* NestJS REST Controllers, OpenAPI decorators, Joi/Zod boundary validation pipes, and JWT authentication guards (KB §7.2, §9.2).
     - *Driven (Secondary) Adapters:* PostgreSQL repository implementations (`PgConveyorLineRepository`), database connection pools, bidirectional persistence mappers, and HTTP webhook clients (KB §7.2, §9.2, §21.1).

3. **Explicit Bidirectional Data Mapping:**
   Persistence schemas and HTTP payloads are never leaked into the Domain Ring. Explicit Mapper classes (`Pure Fabrication`, KB §4.1) translate between Domain Aggregates, Relational Persistence Records, and REST DTOs (KB §7.4).

- **Considered Alternatives:**

  ### 1. Traditional N-Tier Layered Architecture (Without Dependency Inversion)
  - *Description:* Organizing the system into horizontal technical layers (`Controllers` -> `Services` -> `Data Access Layer / ORM Models`) where the Business Logic layer directly depends on the Data Access Layer and imports ORM entities (KB §7.1, §13.2).
  - *Pros:* Lower initial ceremony; fewer interfaces and mapper classes to maintain; familiar to junior developers for simple CRUD applications (KB §13.2).
  - *Cons:* Violates the Dependency Inversion Principle (SOLID). When business services directly import database models or ORM decorators, domain logic becomes tightly coupled to the persistence engine (KB §7.1, §9.2). Unit testing complex sliding-window rules or topological invariants requires mocking complex ORM internals or spinning up a live database, degrading test speed and reliability (KB §7.2, §14.2).

  ### 2. Distributed Microservices Architecture
  - *Description:* Decomposing FlowGuard into independent network-isolated processes (e.g., a `PlantTopologyService`, a `TelemetryIngestService`, and an `AlertDispatcherService`) communicating over HTTP/REST or gRPC and backed by separate databases (KB §7.4, §7.5).
  - *Pros:* Independent horizontal scaling per service; complete fault isolation at the OS process level; allows polyglot technology stacks per bounded context (KB §7.5).
  - *Cons:* Directly violates the **1st Commandment of Distributed Systems: *"Do not distribute"*** when a monolithic deployment suffices (KB §7.4). Distributing telemetry ingestion from topology validation introduces network latency, serialization overhead, partial failure modes, and complex distributed consistency patterns (Sagas / Transactional Outbox, KB §17.1–§17.2). For a single-team engineering effort, microservices introduce massive operational and DevOps overhead without proportional domain benefit (KB §1.2, Principle 3: *Less is More*).

  ### 3. Transaction Script / Anemic Domain Model
  - *Description:* Placing all validation, statistical math, and state mutations inside procedural service methods operating over dumb data structures (*getters* and *setters* only) (KB §3.2, §10.2).
  - *Pros:* Fast initial prototyping for trivial data-entry endpoints.
  - *Cons:* Classic **Data Class / Anemic Domain Model** anti-pattern (KB §3.2, §10.2). Scatters invariant enforcement across multiple services, making it easy for concurrent updates or future roadmap features to bypass critical rules (such as non-negative spare-part counters or sensor calibration bounds).

- **Consequences:**

  ### Positive
  - **100% Isolated & Fast Unit Testing:** Because the Domain and Application rings depend only on pure TypeScript interfaces, all domain invariants, aggregate boundaries, and sliding-window statistical algorithms can be unit-tested in milliseconds using in-memory test doubles (`InMemoryDomainRepository` / Stubs) without database or HTTP overhead (KB §5.2, §7.2, §14.2).
  - **Strict Invariant Protection:** Rich Domain Entities and immutable Value Objects enforce local preconditions and state invariants upon construction and mutation (`Preconditions` / `Invariants`, KB §4.1, §5.1, §10.2), making invalid domain states unrepresentable at runtime.
  - **Infrastructure Replaceability & Roadmap Readiness:** Outbound technical mechanisms (such as the PostgreSQL driver, future Prometheus exporters, or webhook dispatchers) sit behind narrow Port interfaces. Adding the planned 20-hour roadmap tasks requires only new Adapters or Domain Services without rewriting core entities (`01-problem-statement.md`, §4).
  - **Zero Network Latency Between Modules:** Keeping modules in-process within a Modular Monolith allows high-frequency telemetry ingestion to validate sensor metadata and update sliding windows at memory speed while preserving clean logical boundaries for future extraction if scale ever demands it (KB §7.4).

  ### Negative / Trade-offs
  - **Boilerplate & Mapping Ceremony:** Enforcing strict separation between Domain Entities, Persistence Models, and REST DTOs requires writing and maintaining explicit Mapper/Assembler classes and Port interfaces across every module (KB §7.2, §7.4, §13.2).
  - **Higher Architectural Discipline Required:** Developers (and AI coding assistants) must strictly respect the Dependency Rule and resist the shortcut of importing database queries or HTTP request objects directly into application or domain classes (KB §1.2, Principle 7; §9.2).

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial architectural decision establishing the Modular Monolith with Clean / Onion Architecture. |