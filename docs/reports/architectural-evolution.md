# Comprehensive Architectural Evolution, Sequential Development, and Individual Contribution Report

**Project:** FlowGuard (Industrial Line & Conveyor Telemetry & Anomaly Detection Engine)

**Developer & Author:** 1241244-PedroRibeiro

**Assigned User Stories & Modules:** FG01 (Auth & RBAC), FG02 (Plant Topology), FG03 (Sensor Configuration), FG04 (Telemetry Ingestion), FG05 (Anomaly Alerts), and FG06 (Spare Parts Stock).

---

## 1. The Core Philosophy: Why We Followed the Process

In professional software engineering—particularly under the rigorous paradigms of **Clean Architecture** and **Domain-Driven Design (DDD)**—"putting the cart before the horse" refers to the anti-pattern of constructing user interfaces, presentation controllers, or relational database schemas before formally defining core business rules, domain invariants, and aggregate boundaries.

Our development approach for FlowGuard was strictly **bottom-up and inside-out**:

1. **The Domain Came First:** We established core business invariants, Value Objects (`TelemetryValue`, `AbstractStockQuantity`, `SensorSerialNumber`), and Aggregate Roots (`User`, `PlantSector`, `SensorNode`, `AnomalyAlert`, `SparePartStock`) before writing a single line of persistence code (`e0c28eb`, `7e07e6a`).
2. **Application Services Followed:** We implemented use-case orchestration within application service boundaries, keeping business logic completely independent of external frameworks (`82b5a24`, `c2d4ca7`).
3. **Infrastructure & Persistence Came Next:** We mapped domain entities to the relational PostgreSQL schema and managed database migrations (`001` through `008`) *after* the domain logic was fully constructed (`54ed6d3`, `b78f7fc`).
4. **Presentation & API Exposure:** REST controllers and NestJS modules were built last, acting as thin, secure presentation wrappers over application services (`2547e95`, `ea3cd05`).
5. **Automated Testing & Verification:** Bruno declarative test suites and Jest unit/integration test suites validated the entire vertical slice from domain invariants down to HTTP status codes (`cb64f31`, `75fe07b`, `90f7e56`).

---

## 2. Detailed Breakdown of Individual Contributions (User Stories FG01 to FG06)

As the sole developer responsible for the entire FlowGuard ecosystem, my individual work spanned the full software development lifecycle, ensuring that the backend core is bulletproof, fully compliant with requirements, and exhaustively tested:

### 2.1. FG01 – Identity, Authentication & RBAC Governance
* **Domain & Architecture:** Implemented the `User` aggregate root, utilizing `Argon2id` for memory-hard password hashing and stateless JWT for authentication (`178e561`, `e3102c3`).
* **Persistence & Invariants:** Built PostgreSQL repository support and enforced strict Mass-Assignment defense rules.
* **API & Security:** Exposed `/auth/login` and `/users` endpoints, protected by custom `JwtAuthGuard` and `RolesGuard` enforcing `OPERATOR`, `ENGINEER`, and `ADMINISTRATOR` roles.

### 2.2. FG02 – Plant Topology Management
* **Domain & Architecture:** Designed the `PlantSector` and `ConveyorLine` aggregates (`e0c28eb`), enforcing optimistic concurrency (`version` column) for line state transitions.
* **Persistence & Invariants:** Enforced the `ON DELETE RESTRICT` relational integrity invariant to prevent deleting sectors with active lines.
* **API & Security:** Implemented topology management routes, protected for `ENGINEER+` roles.

### 2.3. FG03 – Sensor Nodes & Threshold Configuration
* **Domain & Architecture:** Engineered the `SensorNode` aggregate and `ThresholdRule` entity (`7e07e6a`), supporting multiple transducer types (`MOTOR_VIBRATION`, `BELT_VELOCITY`, etc.).
* **Business Rules & Invariants:** Enforced critical constraints, including `criticalLimit > warningLimit` and `windowSizeSamples` bounds (3 to 128).

### 2.4. FG04 – Real-Time Telemetry Ingestion & Sliding Window
* **Domain & Architecture:** Developed the `SlidingWindowBuffer` (Ring Buffer) and `TelemetryEvaluationEngine` (`891b84f`). This allowed sub-millisecond moving average calculations without database I/O.
* **Atomicity:** The `TelemetryIngestionService` uses ACID transactions to atomically persist the reading, create an `AnomalyAlert`, and update the `ConveyorLine` status to `FAULT_HALTED` upon critical threshold breaches.

### 2.5. FG05 – Anomaly Alert Lifecycle Management
* **Domain & Architecture:** Implemented the `AnomalyAlert` aggregate (`891b84f`), governing the deterministic state machine (`OPEN` → `ACKNOWLEDGED` → `RESOLVED`).
* **API & Security:** Exposed intentional commands (`/acknowledge` and `/resolve`), enforcing `409 Conflict` if invalid state transitions are attempted. Protected by strict RBAC (`OPERATOR+` can acknowledge, but only `ENGINEER+` can resolve).

### 2.6. FG06 – Abstract Spare-Part Inventory Control
* **Domain & Architecture:** Developed the `SparePartStock` aggregate and `AbstractStockQuantity` VO (`ed5d749`), preventing negative stock balances.
* **Concurrency & Invariants:** Implemented Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`) to ensure high-contention safe deductions, coupled with an audit trail (`spare_part_movements`).

---

## 3. Sequential Development Steps & Chronological Milestones

### Phase 1: Foundations, Shared Kernel, and Architecture Setup
* **Base Architecture & Setup:** Established the clean architecture folder structure (`domain`, `application`, `infrastructure`, `presentation`).
* **Architectural Rationale (SAD & ADRs):** Documented core decisions through Architecture Decision Records (ADR-0001 through ADR-0008) covering Clean Architecture, PostgreSQL, JWT, REST APIs, and Automated Testing.

### Phase 2: Persistence Infrastructure & Security
* **Security & NestJS Adoption:** Integrated Argon2id security services and configured JWT authentication modules.
* **Relational Schema & PostgreSQL Mapping:** Implemented the complete relational database schema, database views, and initial seed data, ensuring persistence logic was fully aligned with domain models.

### Phase 3: Core Domain Aggregates, Repositories, and APIs (Topology & Sensors)
* **Categories & Topology:** Implemented `PlantSector` and `ConveyorLine` domains, application services, PostgreSQL repositories, and protected REST endpoints.
* **Sensors & Thresholds:** Developed the `SensorNode` aggregate, `ThresholdRule` bounds, and exposed the Sensor REST API with comprehensive Joi validation.

### Phase 4: Refinement, Sliding Window, Alerts, Stock, and Test Automation
* **Sliding Window & Telemetry:** Implemented the `TelemetryEvaluationEngine`, `SlidingWindowBuffer`, and atomic ingestion endpoint.
* **Alerting & Stock:** Added the Anomaly Alert state machine and Spare Parts Stock repository with pessimistic locking.
* **Test Suite Finalization:** Authored complete Bruno declarative test suites across all 6 modules (78 assertions passing) and achieved 144 passing Jest unit/integration tests.

---

## 4. Complete Commit History Ledger (Evolution in Git)

The following commit ledger extracted from the repository (`git log`) illustrates the rigorous tracking of individual progress, feature additions, test suites, and documentation updates:

```text
f548994 - test(integration,bruno): add FG06 stock lifecycle suites and atomicity checks
3d98d77 - feat(infrastructure,presentation): wire FG06 endpoints, pessimistic locking and app module
7c69e27 - feat(application): add SparePartsStockService use cases and repository ports
ed5d749 - feat(domain): implement AbstractStockQuantity, PartCode and SparePartStock aggregate for FG06
3a4d6c2 - dev(api): added developed anomaly alert
90f7e56 - test(bruno): add E2E contract suite for FG05 inspect, acknowledge and resolve alerts
b3994c7 - test(integration): add in-memory NestJS integration suite for FG05 alert lifecycle
65bbdc3 - feat(infrastructure,presentation): wire FG05 endpoints, CurrentUser decorator and AppModule
a8258f3 - feat(domain,application): implement FG05 alert state machine and use cases
e72c1c5 - chore: add bruno cli script to package.json for E2E test execution
4a5dc54 - test(bruno): add E2E suite for FG04 telemetry ingestion and alert generation
75fe07b - feat(presentation): add telemetry ingestion controller and joi validation pipe
9d6520b - feat(infrastructure): implement postgres telemetry persistence and mappers
a3429c6 - feat(application): add telemetry ingestion use case and repository ports
891b84f - feat(domain): implement sliding window buffer and anomaly alert aggregates for FG04
e44d1b5 - test(api): add extensive Bruno contract testing suite for FG03
aa16754 - test(integration): add Supertest suite for SensorNodeController
ea3cd05 - feat(presentation): add SensorNodeController and DI wiring
9ff4a24 - feat(infrastructure): implement PostgresSensorTelemetryRepository
c2d4ca7 - feat(application): add SensorManagementService and repository ports
7e07e6a - feat(domain): add SensorNode aggregate, ThresholdRule entity and shared VOs
f2b6b6e - test(e2e): add in-memory Supertest suites and comprehensive Bruno YAML tests for FG02
7511176 - feat(presentation): wire topology controllers, module, and RBAC endpoints
b78f7fc - feat(infra): implement PostgreSQL repository and mappers for topology
aa8f3ae - feat(application): implement PlantTopologyService, DTOs, and repository ports
e0c28eb - feat(domain): implement PlantSector and ConveyorLine aggregates with VOs and unit tests
b59f7b8 - docs(adr): update ADR-0007 to specify YAML format for Bruno integration suites
cb64f31 - test(api): implement exhaustive Bruno YAML test suite for FG01 auth and RBAC flows
afb3dbc - fix(auth): enforce HTTP 200 on login and correct Argon2id seed password hash
2547e95 - feat(presentation): implement JwtAuthGuard, RolesGuard, REST controllers and DI wiring
30e7129 - chore(dev): switch dev runner from tsx to ts-node to support decorator metadata
e3102c3 - feat(security): implement Argon2id hasher and JWT token service
54ed6d3 - feat(infra): implement UserMapper and PostgresUserRepository with ACID transaction
82b5a24 - feat(application): implement AuthService, UserService, ports and DTOs
f1142c6 - test(application): add unit tests for AuthService and UserService with in-memory fakes
187d1b9 - chore(core): setup project dependencies, nestjs stubs, and global exception filter
```