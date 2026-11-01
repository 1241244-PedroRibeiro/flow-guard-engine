# Component Architecture & Structural Design: FlowGuard Back-End (C4 Model Level 3)

## 1. Architectural Scope & Context Framing

This document formalizes the internal component breakdown for the **FlowGuard Back-End Modular Monolith Container**, establishing full traceability across our Architecture Decision Records (`ADR-0001` through `ADR-0008`), the Domain Model (`domain-model.puml`), and the 20+ hour implementation roadmap.

Within the hierarchical C4 Model framework (KB §6.2), this artifact occupies **Level 3 (Component Diagram)**, zooming directly into the structural boundaries of the central backend container identified in **Level 2 (Container Diagram)**:

* **Level 1 — System Context:** Situates the FlowGuard boundary within its industrial ecosystem, serving three human personas—`Plant Operator` (`OPERATOR`), `Industrial Engineer` (`ENGINEER`), and `System Administrator` (`ADMINISTRATOR`)—alongside three automated external integrators: `Industrial IoT Sensor Gateways`, `External Maintenance & Webhook Receivers`, and `Prometheus / OpenMetrics Scrapers`.
* **Level 2 — Container Decomposition:** Segregates the runtime environment into discrete deployable units: the `Operations & Engineering Client (SPA / Bruno Harness)`, the central `FlowGuard Back-End Modular Monolith (Node.js / NestJS / TypeScript)`, and the `Relational Database (PostgreSQL 16+)`.
* **Level 3 — Component Breakdown (This Document):** Unpacks the internal anatomy of the Back-End Container across four concentric Clean/Onion Architecture rings, detailing its HTTP controllers, perimeter validation pipes, application use-case services, pure domain aggregates, in-memory sliding-window statistical services, and native PostgreSQL persistence adapters.

In strict adherence to **ADR-0001** and **The Dependency Rule** (KB §7.2), all source code dependencies point exclusively inwards toward the Domain Core. Outer layers depend on inner abstractions (*Ports*), ensuring business invariants and statistical math remain 100% independent of HTTP transport, NestJS decorators, and SQL queries.

---

## 2. Structural Layering & Component Architecture

```text
+-------------------------------------------------------------------------------------------------------------------------+
|                             1. Presentation & Delivery Layer (Primary / Driving Adapters)                               |
|  - NestJS Routers, JwtAuthGuard, RolesGuard, Global HttpExceptionFilter                                                 |
|  - Boundary Request DTO Validation Pipes (Joi / Zod Schemas with stripUnknown: true)                                    |
|  - REST Controllers: C_Auth, C_Topology, C_Sensor, C_Telemetry, C_Alert, C_Stock, C_Metrics                             |
+-------------------------------------------------------------------------------------------------------------------------+
                                                            |
                                                            | (invokes application use cases via validated DTOs)
                                                            v
+-------------------------------------------------------------------------------------------------------------------------+
|                                 2. Application Services Layer (Use Cases & Orchestration)                               |
|  - AuthAndUserService, PlantTopologyService, SensorManagementService, TelemetryIngestionService                         |
|  - AnomalyAlertService, SparePartsStockService, LineHealthQueryService                                                  |
|  - Use-Case Orchestration, ACID Transaction Demarcation, Outbound Port Coordination                                     |
+-------------------------------------------------------------------------------------------------------------------------+
                              |                                                             |
                              | (executes domain logic & mutates aggregates)                | (depends on abstract Ports)
                              v                                                             v
+---------------------------------------------------------+   +-----------------------------------------------------------+
|                  3. Domain Core Layer                   |   |         4. Infrastructure Interfaces (Domain Ports)       |
|  - Aggregates & Entities: User, PlantSector,            |   |  - Repository & Outbound Ports:                           |
|    ConveyorLine, SensorNode, ThresholdRule,             |   |    IUserRepository, IPlantTopologyRepository,             |
|    TelemetryReading, AnomalyAlert, SparePartStock       |   |    ISensorTelemetryRepository, IAnomalyAlertRepository,   |
|  - Value Objects: SensorSerialNumber, TelemetryValue,   |   |    ISparePartStockRepository, IAlertWebhookDispatcher     |
|    AbstractStockQuantity, SectorCode, LineCode          |   +-----------------------------------------------------------+
|  - Stateless Domain Services:                           |                                 ^
|    * TelemetryEvaluationEngine (Ring Buffer / Median)   |                                 | (implements outbound Ports)
|    * LineStateTransitionDomainService                   |                                 |
+---------------------------------------------------------+   +-----------------------------------------------------------+
                                                              |        4. Persistence & Outbound Adapters (Driven)        |
                                                              |  - Native PostgreSQL Pool Repositories (R_User,           |
                                                              |    R_Topology, R_Sensor, R_Alert, R_Stock)                |
                                                              |  - Bidirectional Data Mappers (Domain <-> SQL Row)        |
                                                              |  - HttpWebhookDispatcherAdapter (Transactional Outbox)    |
                                                              +-----------------------------------------------------------+

```

### 2.1. Presentation & Delivery Layer (Primary / Driving Adapters)

This outermost perimeter handles HTTP protocol mechanics, authentication verification, and payload sanitization before any business workflow is triggered (KB §9.2):

* **Thin REST Controllers:** Controllers (`C_Auth`, `C_Topology`, `C_Sensor`, `C_Telemetry`, `C_Alert`, `C_Stock`, `C_Metrics`) contain zero business logic (KB §4.1, §9.2). They extract path parameters, query filters, and validated request bodies, invoke the corresponding Application Service, and return standardized JSON DTOs with deterministic HTTP status codes (`200 OK`, `201 Created`, `204 No Content`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`).
* **Perimeter Security & Boundary Validation:**
* `JwtAuthGuard` and `RolesGuard` verify stateless RFC 7519 Bearer tokens and enforce role permissions (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) at the routing boundary (`ADR-0005`).
* Declarative Joi/Zod Validation Pipes validate incoming JSON schemas and strip unrecognised fields (`stripUnknown: true`), preventing *Mass Assignment* vulnerabilities before controllers execute (`ADR-0005`, `ADR-0006`).
* `HttpExceptionFilter` intercepts domain and application exceptions (`DomainInvariantException`, `ResourceConflictException`, `EntityNotFoundException`) and translates them into uniform RFC-compliant error envelopes without leaking stack traces (`ADR-0006`).



### 2.2. Application Services Layer (Use Cases & Workflow Coordinators)

Application Services coordinate transactional use cases and enforce cross-aggregate workflows without containing low-level statistical formulas or SQL queries (KB §7.2):

* **Specialized Use-Case Services:**
* `AuthAndUserService`: Coordinates credential verification via `Argon2id`, issues signed JWTs, and governs administrator-driven staff onboarding (`PENDING_REGISTRATION` $\rightarrow$ `ACTIVE`).
* `PlantTopologyService`: Manages the lifecycle of `PlantSector` and `ConveyorLine` aggregates, enforcing unique business codes (`sectorCode`, `lineCode`), soft deactivation, and optimistic concurrency checks (`version` column in Roadmap Task 2).
* `SensorManagementService`: Orchestrates `SensorNode` registration, calibration states, and the attachment of `ThresholdRule` warning/critical bounds.
* `TelemetryIngestionService`: High-throughput coordinator that validates active sensor status, delegates real-time stream evaluation to `TelemetryEvaluationEngine`, persists enriched `TelemetryReading` records, and triggers atomic alert/line state mutations when thresholds are breached.
* `AnomalyAlertService`: Manages operator alert acknowledgements (`OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `RESOLVED`) and coordinates asynchronous webhook dispatching via the Transactional Outbox pattern (Roadmap Task 3).
* `SparePartsStockService`: Coordinates inventory replenishments and deductions across `SparePartStock` aggregates using explicit PostgreSQL transactions and pessimistic row locks (`SELECT ... FOR UPDATE`, Roadmap Task 2).
* `LineHealthQueryService`: Dedicated read-side service (lightweight CQRS, KB §4.2, §7.5, §21.2) that queries pre-aggregated PostgreSQL Views (`v_conveyor_line_health_summary`) and exports real-time telemetry counters for the `/api/v1/metrics` OpenMetrics endpoint (Roadmap Task 5).



### 2.3. Domain Core Layer (Entities, Value Objects & Domain Services)

The innermost ring contains pure TypeScript business logic with zero external framework or driver dependencies (`ADR-0001`):

* **Rich Domain Aggregates & Invariants:**
* `User`: Protects credential hashes, account lifecycle transitions, and role sets.
* `PlantSector` & `ConveyorLine`: Enforce topological identity invariants and valid operational state transitions (`RUNNING`, `DEGRADED_WARNING`, `FAULT_HALTED`, `MAINTENANCE`, `DEACTIVATED`).
* `SensorNode` & `ThresholdRule`: Enforce physical calibration limits and guarantee that `criticalLimit > warningLimit`.
* `AnomalyAlert`: Enforces state-machine rules preventing resolved alerts from being re-acknowledged or mutated out of sequence.
* `SparePartStock`: Encapsulates `AbstractStockQuantity` ($u \in \mathbb{N}_0$), guaranteeing that `consume()` operations never result in negative inventory balances.


* **Stateless Domain Services:**
* `TelemetryEvaluationEngine`: Implements the 4-stage *Pipes-and-Filters* in-memory statistical pipeline (`ADR-0004`). Maintains bounded circular *Ring Buffers* ($N \le 128$) per sensor, computing real-time Moving Averages ($\mu_W$), Moving Medians ($\tilde{x}_W$ via order statistics in Roadmap Task 1), and Z-Score volatility metrics in microseconds.
* `LineStateTransitionDomainService`: Coordinates domain rules spanning `SensorNode`, `ThresholdRule`, `AnomalyAlert`, and `ConveyorLine` when a smoothed statistical reading breaches warning or critical tolerances.



### 2.4. Infrastructure & Persistence Layer (Secondary / Driven Adapters)

Implements the outbound *Port* interfaces defined in the Application/Domain layers (`ADR-0001`, `ADR-0003`):

* **Native PostgreSQL Connection Pool Repositories:** Concrete adapters (`PgUserRepository`, `PgPlantTopologyRepository`, `PgSensorTelemetryRepository`, `PgAnomalyAlertRepository`, `PgSparePartStockRepository`) execute parameterized SQL queries (`$1, $2`) over a native `pg` connection pool, backed by explicit bidirectional Data Mappers (`UserMapper`, `ConveyorLineMapper`, etc.).
* **In-Memory Fake Repositories for Testing:** Parallel `InMemory*Repository` implementations satisfy the exact same Port interfaces, enabling sub-second unit and application service testing without a live database (`ADR-0007`).
* **Outbox Webhook Dispatcher Adapter:** `HttpWebhookDispatcherAdapter` implements `IAlertWebhookDispatcher` to deliver signed JSON alert payloads to external maintenance systems reliably (Roadmap Task 3).

---

## 3. Justification of Architectural Decisions & Multi-Level Alignment

### 3.1. Separation of `TelemetryEvaluationEngine` in the Domain Core vs. Database Aggregation

* **Context & Decision:** High-frequency statistical smoothing ($\mu_W$ and $\tilde{x}_W$) is executed inside the pure Domain Service `TelemetryEvaluationEngine` using bounded in-memory ring buffers rather than SQL window queries in `PgSensorTelemetryRepository`.
* **Technical Justification:** Executing `PERCENTILE_CONT(0.5)` or `AVG()` across millions of rows in PostgreSQL on every incoming sensor reading would saturate database CPU and disk I/O (`ADR-0004`). Keeping the sliding window in V8 memory bounds memory usage to $O(S \times N)$, achieves sub-millisecond latency, and allows 100% deterministic unit testing of statistical edge cases in Jest without database fixtures.

### 3.2. Separation of `LineHealthQueryService` (CQRS Read Path) from Write Services

* **Context & Decision:** Dashboard health summaries and Prometheus metrics scraping are routed to a dedicated `LineHealthQueryService` backed by the SQL View `v_conveyor_line_health_summary` rather than loading full domain aggregate graphs through `PlantTopologyService`.
* **Technical Justification:** Operational dashboards and monitoring scrapers frequently request composite summaries (line status, active sensor count, open warning/critical alert counts, latest moving average). Loading every `ConveyorLine`, all its `SensorNodes`, and all `AnomalyAlerts` into memory would trigger the **N+1 Queries** anti-pattern (KB §4.2, §9.3, §21.2). A read-optimized SQL View projects the exact DTO in a single query.

### 3.3. Explicit Dual Concurrency Strategy Across Repositories (Optimistic vs. Pessimistic)

* **Context & Decision:** `PgPlantTopologyRepository` and `PgSensorTelemetryRepository` enforce **Optimistic Locking** via a `version` column on configuration updates, whereas `PgSparePartStockRepository` enforces **Pessimistic Row-Level Locking** (`SELECT ... FOR UPDATE`) on inventory deductions (`ADR-0003`, Roadmap Task 2).
* **Technical Justification:** Topology and threshold edits by engineers are low-contention administrative actions where detecting stale overwrites (`409 Conflict`) is ideal. Conversely, automated maintenance routines deducting discrete spare-part units experience high write contention on shared stock rows, requiring pessimistic serialization to guarantee `stock_units >= 0`.

---

## 4. Traceability Matrix: Capability Modules vs. Architectural Components

| Capability ID & Scope | Status | Controllers (Presentation) | Application Services | Domain Entities & Services | Repositories / Adapters (Infrastructure) |
| --- | --- | --- | --- | --- | --- |
| **FG-AUTH: Auth, Users & RBAC** | **Baseline** | `C_Auth` (`/api/v1/auth`, `/users`) | `AuthAndUserService` | `User`, `UserRole`, `PasswordHash`, `PersonName` | `IUserRepository` $\rightarrow$ `PgUserRepository` |
| **FG-TOPO: Plant Sectors & Lines** | **Baseline** | `C_Topology` (`/api/v1/plant-sectors`, `/conveyor-lines`) | `PlantTopologyService` | `PlantSector`, `ConveyorLine`, `LineStatus` | `IPlantTopologyRepository` $\rightarrow$ `PgPlantTopologyRepository` |
| **FG-SENS: Sensors & Thresholds** | **Baseline** | `C_Sensor` (`/api/v1/sensor-nodes`, `/threshold-rules`) | `SensorManagementService` | `SensorNode`, `ThresholdRule`, `TelemetryValue` | `ISensorTelemetryRepository` $\rightarrow$ `PgSensorTelemetryRepository` |
| **FG-INGEST: Telemetry & Moving Avg** | **Baseline** | `C_Telemetry` (`.../telemetry-readings`) | `TelemetryIngestionService` | `TelemetryReading`, `DS_TelemetryEngine`, `DS_LineState` | `PgSensorTelemetryRepository`, `PgAnomalyAlertRepository` |
| **FG-ALERT: Anomaly Alert Lifecycle** | **Baseline** | `C_Alert` (`/api/v1/anomaly-alerts`) | `AnomalyAlertService` | `AnomalyAlert`, `AlertSeverity`, `AlertStatus` | `IAnomalyAlertRepository` $\rightarrow$ `PgAnomalyAlertRepository` |
| **FG-STOCK: Abstract Spare Parts** | **Baseline** | `C_Stock` (`/api/v1/spare-parts`) | `SparePartsStockService` | `SparePartStock`, `AbstractStockQuantity` | `ISparePartStockRepository` $\rightarrow$ `PgSparePartStockRepository` |
| **FG-QUERY: CQRS Health Views** | **Baseline** | `C_Topology`, `C_Metrics` | `LineHealthQueryService` | Read DTO Projections | `v_conveyor_line_health_summary` (SQL View) |
| **TASK-1: Moving Median & IQR Filter** | **Roadmap (20h+)** | `C_Telemetry` | `TelemetryIngestionService` | `DS_TelemetryEngine` (Min-Max Heap / Order Statistics) | In-Memory Ring Buffer State |
| **TASK-2: Row & Optimistic Locking** | **Roadmap (20h+)** | `C_Topology`, `C_Stock` | `PlantTopologyService`, `SparePartsStockService` | `ConveyorLine` (`version`), `SparePartStock` | `SELECT ... FOR UPDATE` & `WHERE version = $v` |
| **TASK-3: Webhook Alert Engine** | **Roadmap (20h+)** | `C_Alert`, `C_Telemetry` | `AnomalyAlertService` | `AnomalyAlert`, Outbox Event | `IAlertWebhookDispatcher` $\rightarrow$ `HttpWebhookDispatcherAdapter` |
| **TASK-4: Boundary & Bruno Suites** | **Roadmap (20h+)** | All Controllers | All Services | All Invariants | Supertest E2E + Bruno (`.bru` CLI Suites) |
| **TASK-5: OpenMetrics / Prometheus** | **Roadmap (20h+)** | `C_Metrics` (`/api/v1/metrics`) | `LineHealthQueryService` | Telemetry & Alert Counters | Prometheus Text Exposition Formatter |