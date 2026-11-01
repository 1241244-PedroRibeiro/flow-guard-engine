# ADR-0007: Automated Testing Strategy — Test Pyramid, F.I.R.S.T. Principles, In-Memory Integration & Bruno API Suites

* **Status:** Accepted
* **Context:**
**FlowGuard** governs safety-critical industrial telemetry rules, sliding-window anomaly algorithms, and relational asset hierarchies (`01-problem-statement.md`, §2–§3). Manual testing via ad-hoc HTTP requests is slow, non-repeatable, and incapable of catching subtle regressions when refactoring domain logic or expanding the 20+ hour roadmap (`01-problem-statement.md`, §4, Task 4).



Following KB §14.1 (The Testing Pyramid), KB §14.2 (TDD & F.I.R.S.T. Principles), and KB §22.2 (API Testing Tooling), our testing architecture must verify four distinct layers of responsibility:

1. **Domain Invariants & Statistical Math:** Must execute in milliseconds with zero external dependencies (*Fast*, *Independent*, *Repeatable*).


2. **Application Use-Case Orchestration:** Must verify interaction expectations between services and outbound ports (repositories, webhook dispatchers) using controlled Test Doubles (*Mocks*, *Stubs*, *Fakes*).


3. **HTTP Perimeter & In-Memory Integration Contracts:** Must verify that routing, Joi/Zod validation pipes, JWT/RBAC guards, and exception filters return exact HTTP status codes (`201`, `400`, `401`, `403`, `404`, `409`, `422`) without requiring a live TCP port listener (KB §9.2).


4. **Live Black-Box API & Multi-Step Workflow Verification (Postman-Style Automated Suites):** Must validate end-to-end stateful HTTP scenarios against a running server and PostgreSQL database—including dynamic JWT extraction, environment variable chaining across requests, and database constraint enforcement (`ON DELETE RESTRICT`)—using Git-native declarative collections (KB §22.2).



* **Decision:**
We implement a four-tier **Automated Testing Strategy** powered by **Jest**, **Supertest**, and **Bruno (`bru` CLI)**, strictly adhering to **F.I.R.S.T.** principles (*Fast, Independent, Repeatable, Self-Validating, Timely*) (KB §14.1, §14.2, §22.2):



1. **Base Layer — Isolated Domain & Statistical Unit Tests (`*.spec.ts` via Jest):**
* Targets all Value Objects (`SensorSerialNumber`, `ThresholdBounds`, `AbstractStockQuantity`), Entities (`ConveyorLine`, `SensorNode`, `PlantSector`), and the `SlidingWindowEngine` (`ADR-0004`).


* Exercises boundary conditions, precondition failures (`IllegalArgumentException` / `DomainInvariantException`), and state transitions (e.g., verifying that a `DEACTIVATED` conveyor line rejects incoming telemetry or that moving median filters reject single-sample outliers).


* Runs purely in V8 memory with **zero mocks and zero I/O**, completing hundreds of assertions in under 1 second.




2. **Middle Layer — Application Use-Case Tests with Test Doubles (`*.service.spec.ts`):**
* Tests Application Services (`IngestTelemetryUseCase`, `RegisterConveyorLineUseCase`, `AdjustSparePartStockUseCase`) by injecting **In-Memory Fake Repositories** (`InMemorySensorNodeRepository`) and **Jest Spies/Mocks** (`IAlertWebhookDispatcher`) via NestJS's `@nestjs/testing` IoC container (`ADR-0001`, `ADR-0002`; KB §5.2, §14.2).


* Verifies that duplicate business codes trigger `ResourceConflictException`, missing references trigger `EntityNotFoundException`, and threshold breaches dispatch domain events accurately.




3. **Upper-Middle Layer — In-Memory HTTP Integration & Boundary Tests (`*.e2e-spec.ts` via Supertest):**
* Leverages the strict architectural separation between application bootstrap (`createApp` / `AppModule`) and the network listener (`main.ts`) (KB §9.2).


* **Supertest** mounts the full NestJS HTTP pipeline—including Joi/Zod validation pipes, `JwtAuthGuard`, `RolesGuard`, controllers, and the global `HttpExceptionFilter`—directly in memory without binding to an OS network port (KB §9.2, §14.1).


* Validates complete request/response lifecycles across all REST endpoints, asserting exact status codes, headers (`Location`, `Content-Type`), and JSON error envelopes.




4. **Top API Layer — Git-Native Declarative API Collections & CLI Suites (`api-tests/*.bru` via Bruno):**
* Complements code-level Supertest suites with Postman-style black-box HTTP request collections stored as plain-text `.bru` files directly inside the Git repository (`ADR-0008`, KB §22.2).


* **Automated Token & State Chaining:** Post-response scripts automatically extract JWT bearer tokens (`bru.setEnvVar("authToken", res.body.accessToken)`) and generated resource IDs (`sectorId`, `lineId`, `sensorId`, `alertId`) to chain multi-step industrial workflows (`Login as Engineer` $\rightarrow$ `Create Plant Sector` $\rightarrow$ `Register Conveyor Line` $\rightarrow$ `Attach Sensor Node` $\rightarrow$ `Ingest Telemetry Burst` $\rightarrow$ `Verify Anomaly Alert Creation` $\rightarrow$ `Acknowledge Alert as Operator`) (KB §22.2).


* **Declarative Contract & Invariant Assertions:** Each `.bru` file includes declarative `assert` blocks and JavaScript `tests` blocks verifying HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`), response times, schema properties, and database-enforced `ON DELETE RESTRICT` conflict protections.


* **Dual Execution Mode (GUI + Headless CI):** Developers can run collections interactively via the Bruno desktop client during local debugging or execute the entire folder headlessly via the Bruno CLI (`npx @usebruno/cli run --env local`) in automated QA scripts (`01-problem-statement.md`, §3, §4 Task 4).





* **Considered Alternatives:**
### 1. Manual QA & UI-Only End-to-End Testing (Cypress / Selenium Only)


* *Description:* Relying on manual testing or browser-driven E2E suites for all verification (an "Ice-Cream Cone" anti-pattern inverting the Testing Pyramid, KB §14.1).


* *Pros:* Tests the visual interface alongside the backend.


* *Cons:* Extremely slow, brittle, and expensive to maintain (KB §14.1). Pinpointing an edge-case bug in a sliding-window median calculation through a browser test takes minutes instead of milliseconds.




### 2. Cloud-Locked Postman Collections & Newman CLI


* *Description:* Building black-box API test suites inside Postman workspaces and exporting monolithic JSON files for Newman CLI execution (KB §19.2, §22.2).


* *Pros:* Familiar GUI and widespread industry recognition for manual API exploration (KB §22.2).


* *Cons:* Postman enforces cloud synchronization and restricts free-tier team collaboration (max 3 collaborators) (KB §22.2). Furthermore, exported `.postman_collection.json` files are deeply nested, UUID-heavy JSON blobs that produce unreadable Git diffs and painful merge conflicts compared to Bruno's clean, human-readable `.bru` DSL (KB §19.2, §22.2).




### 3. Testing Services Directly Against a Shared Live Cloud Database


* *Description:* Running all unit and service tests against a single shared remote PostgreSQL instance.


* *Pros:* No need to write `InMemoryRepository` fakes or mock adapters.


* *Cons:* Violates the **Independent** and **Repeatable** rules of **F.I.R.S.T.** (KB §14.2). Concurrent test runs by different developers or CI jobs mutate shared rows, causing flaky race-condition failures, and tests cannot run offline.




* **Consequences:**
### Positive


* **Sub-Second Developer Feedback Loop:** Developers and AI coding assistants can run `npm test` continuously during TDD (*Red-Green-Refactor*, KB §14.2) to validate domain and application changes instantaneously.


* **Zero Port-Collision Flakiness in CI:** Because Supertest invokes the Express/NestJS handler in memory without `app.listen(port)`, integration tests never fail due to `EADDRINUSE` port conflicts on GitHub Actions runners (KB §9.2, §22.1).


* **Git-Versioned Black-Box API Verification:** Storing Bruno `.bru` collections alongside source code ensures that every pull request updates both the implementation and the executable API contract tests in a single atomic commit, with zero cloud-account dependencies (KB §22.2).


* **High Confidence for the 20-Hour Roadmap:** Existing Jest, Supertest, and Bruno regression suites guarantee that adding new sliding-window filters, row-level locks, or Prometheus endpoints cannot silently break baseline asset or authentication workflows (`01-problem-statement.md`, §4).




### Negative / Trade-offs


* **Maintenance of In-Memory Fake Repositories:** Implementing `InMemoryDomainRepository` adapters alongside PostgreSQL repositories requires keeping fake behavior (such as unique constraint checks and `ON DELETE RESTRICT` simulation) faithful to the real database contract (KB §5.2, §14.2).


* **Synchronization Between Supertest and Bruno Suites:** Maintaining both in-memory Supertest integration specs and live Bruno `.bru` collections requires discipline so endpoint URI or DTO changes are reflected in both test harnesses.





---

## Revision History

| Version | Date | Author | Description |
| --- | --- | --- | --- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial testing strategy establishing the Jest + Supertest Testing Pyramid and F.I.R.S.T. compliance.
| **v1.1** | 2026-10-28 | Pedro Ribeiro | Added Top API Layer covering Postman-style black-box HTTP testing, token chaining, and automated contract assertions using Bruno (`.bru`) collections and CLI (KB §22.2).