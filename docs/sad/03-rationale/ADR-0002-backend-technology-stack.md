# ADR-0002: Back-End Technology Stack & Runtime Environment

- **Status:** Accepted

- **Context:**
**FlowGuard** requires an industrial-grade back-end runtime and application framework capable of handling concurrent HTTP telemetry ingestion bursts from industrial conveyor sensors, executing deterministic domain logic, enforcing role-based security, and exposing a documented REST API (`01-problem-statement.md`, §2–§3).

In accordance with our architectural principles (KB §1.2, Principle 4), technology choices must be driven by quality attributes—specifically **high-concurrency non-blocking I/O**, **compile-time type safety**, **dependency injection support for Clean Architecture**, and **developer productivity**—rather than arbitrary preferences. The platform must support both the established baseline implementation (asset topology, telemetry ingestion, authentication) and the planned 20+ hour roadmap (sliding-window median filters, concurrency locking, webhook engines, and Prometheus metrics) (`01-problem-statement.md`, §4).

- **Decision:**
We adopt **Node.js (LTS) + TypeScript + NestJS** as the core back-end runtime and application framework:

1. **Runtime Environment — Node.js (LTS v20+ / v22):**
   Powered by Google's V8 engine, Node.js uses an event-driven, **Single-Threaded Event Loop** combined with **Non-Blocking Asynchronous I/O** (KB §9.1). Network sockets, database queries, and webhook dispatches are delegated to OS kernel primitives or the libuv worker pool, allowing the server to handle thousands of concurrent sensor telemetry `POST` requests without suffering from thread-per-request memory exhaustion or context-switching overhead (KB §9.1).

2. **Programming Language — TypeScript (Strict Mode):**
   TypeScript provides static type checking, explicit interface contracts (`Ports`), generics, and `readonly` immutability modifiers at compile time (KB §9.1, §10.1). This directly supports DDD tactical patterns (`Entity`, `ValueObject`, `AggregateRoot`) and prevents runtime type errors across architectural boundaries.

3. **Application Framework — NestJS (over Express HTTP Engine):**
   NestJS provides an opinionated, enterprise-grade architecture over the battle-tested Express HTTP server (KB §9.2):
   - **First-Class Inversion of Control (IoC) Container:** Native Dependency Injection allows Application Services to depend on abstract TypeScript interfaces/tokens (`@Inject(SENSOR_REPOSITORY)`), binding them to concrete PostgreSQL or In-Memory adapters at the module level (KB §7.2, §9.2).
   - **Modular Encapsulation:** Each bounded context (`PlantModule`, `TelemetryModule`, `AuthModule`) encapsulates its own controllers, providers, and exported services, enforcing the Modular Monolith structure defined in `ADR-0001`.
   - **Declarative Request Pipeline:** Cross-cutting concerns are cleanly isolated from business logic using **Guards** (JWT & RBAC verification), **Pipes** (Joi/Zod boundary payload validation), **Interceptors** (structured logging and correlation IDs), and **Exception Filters** (centralized RFC-compliant JSON error mapping) (KB §9.2, §16.3).
   - **Separation of Bootstrap (`app.module` / `createApp`) and Network Listener (`main.ts`):** Enables integration test suites (Supertest) to mount the application pipeline in memory without binding to a live TCP port (KB §9.2, §14.1).

- **Considered Alternatives:**

  ### 1. Minimalist Node.js Framework (Raw Express.js or Fastify without IoC)
  - *Description:* Building the REST API directly on raw Express.js routers and middleware functions without a higher-level architectural framework (KB §9.2).
  - *Pros:* Zero framework overhead; minimal learning curve; complete freedom over file structure.
  - *Cons:* Lacks a built-in Dependency Injection container and standardized module boundaries. In a Clean Architecture project with multiple aggregates and ports, raw Express requires writing manual factory wiring boilerplate (`ServiceLocator` / manual constructor injection trees) and custom wrapper middlewares to catch async errors or generate OpenAPI specs (KB §7.4, §9.2).

  ### 2. Multi-Threaded Enterprise JVM Stack (Java 21 + Spring Boot)
  - *Description:* Implementing FlowGuard in Java using Spring Boot, Spring Web, and Spring Data / JDBC (KB §5.2, §14.1).
  - *Pros:* Mature enterprise ecosystem, strong static typing, native multi-threading for CPU-bound workloads, and first-class DDD/JPA patterns (KB §5.1–§5.2).
  - *Cons:* Higher memory footprint at startup, heavier build/compilation cycles (Maven/Gradle) compared to TypeScript incremental compilation, and more verbose ceremony when dealing with JSON payload serialization, dynamic webhook JSON schemas, and lightweight edge deployment in industrial gateways.

  ### 3. Systems-Level Compiled Language (Rust with Axum / Actix-Web)
  - *Description:* Building the telemetry engine in Rust with `tokio`, `axum`, and `sqlx`.
  - *Pros:* Unmatched memory efficiency, zero garbage-collection pauses, and compile-time memory/concurrency safety.
  - *Cons:* Steep development velocity trade-off due to borrow-checker complexity when modeling rich object graphs, mocking traits in unit tests, and iterating rapidly on REST CRUD + domain orchestration features within a tight roadmap window (KB §1.2, Principle 3).

- **Consequences:**

  ### Positive
  - **High-Throughput Telemetry Ingestion:** Node.js's non-blocking event loop processes concurrent HTTP sensor payloads and database I/O with minimal memory overhead (KB §9.1).
  - **Seamless Clean Architecture Wiring:** NestJS's IoC container naturally binds Domain/Application Ports to Infrastructure Adapters, making it trivial to swap `PgRepository` with `InMemoryRepository` during unit and integration testing (KB §5.2, §7.2, §14.2).
  - **Centralized Error & Validation Governance:** Global Exception Filters map Domain Exceptions (`InvariantViolationException`, `EntityNotFoundException`, `ResourceConflictException`) deterministically to HTTP status codes (`422`, `404`, `409`) without polluting controllers with `try/catch` blocks (KB §8.3, §9.2, §10.3).
  - **Unified Language & Tooling:** Using TypeScript across source code, database migrations, Jest unit tests, and Supertest integration suites streamlines CI/CD pipelines and developer onboarding (KB §10.1, §22.1).

  ### Negative / Trade-offs
  - **Single-Threaded CPU Sensitivity:** Because JavaScript executes on a single main thread, heavy CPU-bound operations could block the Event Loop (KB §9.1). Consequently, our in-memory sliding-window statistical algorithms (`ADR-0004`) must be strictly bounded in window size ($O(W)$ or $O(\log W)$) or offloaded to Worker Threads if complex ML inference is introduced later.
  - **Decorator & Metadata Ceremony:** NestJS relies on TypeScript experimental decorators (`@Injectable()`, `@Controller()`), requiring strict discipline to keep framework decorators out of the innermost Domain Ring (`ADR-0001`).

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial selection of Node.js, TypeScript, and NestJS for the FlowGuard backend engine. |