# ADR-0007: Automated Testing Strategy — Test Pyramid, F.I.R.S.T. Principles & In-Memory Integration

- **Status:** Accepted

- **Context:**
**FlowGuard** governs safety-critical industrial telemetry rules, sliding-window anomaly algorithms, and relational asset hierarchies (`01-problem-statement.md`, §2–§3). Manual testing via ad-hoc HTTP requests is slow, non-repeatable, and incapable of catching subtle regressions when refactoring domain logic or expanding the 20+ hour roadmap (`01-problem-statement.md`, §4, Task 4).

Following KB §14.1 (The Testing Pyramid) and KB §14.2 (TDD & F.I.R.S.T. Principles), our testing architecture must verify three distinct layers of responsibility:
1. **Domain Invariants & Statistical Math:** Must execute in milliseconds with zero external dependencies (*Fast*, *Independent*, *Repeatable*).
2. **Application Use-Case Orchestration:** Must verify interaction expectations between services and outbound ports (repositories, webhook dispatchers) using controlled Test Doubles (*Mocks*, *Stubs*, *Fakes*).
3. **HTTP Perimeter & End-to-End API Contracts:** Must verify that routing, Joi/Zod validation pipes, JWT/RBAC guards, and exception filters return exact HTTP status codes (`201`, `400`, `401`, `403`, `404`, `409`, `422`) without requiring a live TCP port listener (KB §9.2).

- **Decision:**
We implement a multi-layered **Automated Testing Pyramid** powered by **Jest** and **Supertest**, strictly adhering to **F.I.R.S.T.** principles (*Fast, Independent, Repeatable, Self-Validating, Timely*) (KB §14.1, §14.2):

1. **Base Layer — Isolated Domain & Statistical Unit Tests (`*.spec.ts` via Jest):**
   - Targets all Value Objects (`SensorSerialNumber`, `ThresholdBounds`, `AbstractStockQuantity`), Entities (`ConveyorLine`, `SensorNode`, `PlantSector`), and the `SlidingWindowEngine` (`ADR-0004`).
   - Exercises boundary conditions, precondition failures (`IllegalArgumentException` / `DomainInvariantException`), and state transitions (e.g., verifying that a `DEACTIVATED` conveyor line rejects incoming telemetry or that moving median filters reject single-sample outliers).
   - Runs purely in V8 memory with **zero mocks and zero I/O**, completing hundreds of assertions in under 1 second.

2. **Middle Layer — Application Use-Case Tests with Test Doubles (`*.service.spec.ts`):**
   - Tests Application Services (`IngestTelemetryUseCase`, `RegisterConveyorLineUseCase`, `AdjustSparePartStockUseCase`) by injecting **In-Memory Fake Repositories** (`InMemorySensorNodeRepository`) and **Jest Spies/Mocks** (`IAlertWebhookDispatcher`) via NestJS's `@nestjs/testing` IoC container (`ADR-0001`, `ADR-0002`; KB §5.2, §14.2).
   - Verifies that duplicate business codes trigger `ResourceConflictException`, missing references trigger `EntityNotFoundException`, and threshold breaches dispatch domain events accurately.

3. **Top API Layer — HTTP Integration & Boundary Tests (`*.e2e-spec.ts` via Supertest):**
   - Leverages the strict architectural separation between application bootstrap (`createApp` / `AppModule`) and the network listener (`main.ts`) (KB §9.2).
   - **Supertest** mounts the full NestJS HTTP pipeline—including Joi/Zod validation pipes, `JwtAuthGuard`, `RolesGuard`, controllers, and the global `HttpExceptionFilter`—directly in memory without binding to an OS network port (KB §9.2, §14.1).
   - Validates complete request/response lifecycles across all REST endpoints, asserting exact status codes, headers (`Location`, `Content-Type`), and JSON error envelopes.

- **Considered Alternatives:**

  ### 1. Manual QA & UI-Only End-to-End Testing (Cypress / Selenium Only)
  - *Description:* Relying on manual testing or browser-driven E2E suites for all verification (an "Ice-Cream Cone" anti-pattern inverting the Testing Pyramid, KB §14.1).
  - *Pros:* Tests the visual interface alongside the backend.
  - *Cons:* Extremely slow, brittle, and expensive to maintain (KB §14.1). Pinpointing an edge-case bug in a sliding-window median calculation through a browser test takes minutes instead of milliseconds.

  ### 2. Testing Services Directly Against a Shared Live Cloud Database
  - *Description:* Running all unit and service tests against a single shared remote PostgreSQL instance.
  - *Pros:* No need to write `InMemoryRepository` fakes or mock adapters.
  - *Cons:* Violates the **Independent** and **Repeatable** rules of **F.I.R.S.T.** (KB §14.2). Concurrent test runs by different developers or CI jobs mutate shared rows, causing flaky race-condition failures, and tests cannot run offline.

- **Consequences:**

  ### Positive
  - **Sub-Second Developer Feedback Loop:** Developers and AI coding assistants can run `npm test` continuously during TDD (*Red-Green-Refactor*, KB §14.2) to validate domain and application changes instantaneously.
  - **Zero Port-Collision Flakiness in CI:** Because Supertest invokes the Express/NestJS handler in memory without `app.listen(port)`, integration tests never fail due to `EADDRINUSE` port conflicts on GitHub Actions runners (KB §9.2, §22.1).
  - **High Confidence for the 20-Hour Roadmap:** Existing regression tests guarantee that adding new sliding-window filters, row-level locks, or Prometheus endpoints cannot silently break baseline asset or authentication workflows (`01-problem-statement.md`, §4).

  ### Negative / Trade-offs
  - **Maintenance of In-Memory Fake Repositories:** Implementing `InMemoryDomainRepository` adapters alongside PostgreSQL repositories requires keeping fake behavior (such as unique constraint checks and `ON DELETE RESTRICT` simulation) faithful to the real database contract (KB §5.2, §14.2).

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial testing strategy establishing the Jest + Supertest Testing Pyramid and F.I.R.S.T. compliance. |