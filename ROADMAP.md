# FlowGuard — Engineering Roadmap & Planned Future Work (28+ Hours)

> **Project Status:** Active Baseline Implemented (`v1.0.0`)  
> **Planned Upcoming Effort:** ~28 Hours across 5 Engineering Milestones  
> **Architecture Reference:** Clean / Onion Modular Monolith (`docs/sad/`, `ADR-0001` to `ADR-0008`)

---

## 1. Current Baseline State (Already Implemented)

FlowGuard has an established architectural and functional foundation covering:
- **Architectural & Domain Documentation (`docs/`):** Complete Software Architecture Document (SAD), 8 Architecture Decision Records (`ADR-0001`–`ADR-0008`), C4 Model diagrams (Levels 1–3), Domain Model (`dm.puml`), OpenAPI 3.0.3 contract (`docs/api/openapi.yaml`), and Ubiquitous Language Glossary.
- **Database & Infrastructure (`docker-compose.yml`, `migrations/001–008`):** Reproducible PostgreSQL 16 schema in 3NF/BCNF with `ON DELETE RESTRICT` referential guards, `CHECK` constraints, functional case-insensitive unique indexes, CQRS read views (`v_conveyor_line_health_summary`, `v_sensor_latest_telemetry`), and deterministic seed data.
- **Core Domain & Application Layers (`backend/src/`):**
  - Stateless JWT authentication + `Argon2id` password hashing (`FG-AUTH`).
  - Plant Sector and Conveyor Line lifecycle management (`FG-TOPO`).
  - Sensor Node registration, calibration, and Threshold Rule bounds (`FG-SENS`).
  - Baseline circular Ring Buffer (`SlidingWindowBuffer`) with Moving Average ($\mu_W$) calculation (`FG-INGEST`).
  - Anomaly Alert creation, operator acknowledgement, and spare-part stock management (`FG-ALERT`, `FG-STOCK`).

---

## 2. Planned Future Work Backlog (28 Hours)

The following five engineering milestones represent the active backlog scheduled for upcoming development iterations:

### Milestone 1: High-Frequency Moving Median ($\tilde{x}_W$) & IQR Outlier Rejection Engine
- **Estimated Effort:** 6 Hours
- **Target Layer:** `backend/src/domain/sensor/` (`SlidingWindowBuffer.ts`, `TelemetryEvaluationEngine.ts`)
- **Architectural Reference:** `ADR-0004`, `01-problem-statement.md` (§2.1, §4 Task 1)
- **Scope & Deliverables:**
  - [ ] Implement dual-heap (Min-Heap / Max-Heap) order-statistic tracking inside `SlidingWindowBuffer` to compute the Moving Median ($\tilde{x}_W$) in $O(\log W)$ time without copying or sorting the full window array on every sample.
  - [ ] Add Interquartile Range ($IQR = Q_3 - Q_1$) spike filtering for `MOTOR_VIBRATION` and `OPTICAL_COUNTER` transducers to strip single-sample electromagnetic noise before threshold comparison.
  - [ ] Implement server startup warm-up (`bootstrapWindowState`) to hydrate active ring buffers from the last $N$ persisted readings in `telemetry_readings` upon process restart.
  - [ ] Add comprehensive Jest unit test suites covering even/odd window sizes, impulse spike rejection, and buffer rollover invariants.

---

### Milestone 2: High-Contention Concurrency Control (Optimistic & Pessimistic Locking)
- **Estimated Effort:** 5 Hours
- **Target Layer:** `backend/src/infrastructure/persistence/repositories/` & `backend/src/application/`
- **Architectural Reference:** `ADR-0003`, `04-key-scenarios.md` (§5), `11-relational-mapping-and-persistence-strategy.md` (§4.1)
- **Scope & Deliverables:**
  - [ ] Enforce **Optimistic Concurrency Control** (`version` column check: `WHERE id = $1 AND version = $2`) on `ConveyorLine` operational status transitions and `ThresholdRule` updates, throwing `OptimisticConcurrencyConflictException` (`409 Conflict`) on stale writes.
  - [ ] Enforce **Pessimistic Row-Level Locking** (`SELECT ... FOR UPDATE`) inside explicit PostgreSQL `PoolClient` transactions (`withTransaction`) for `SparePartStock.consume()` operations to prevent race conditions and negative inventory balances under concurrent maintenance requests.
  - [ ] Write concurrent stress integration tests verifying that parallel stock deductions and simultaneous line status edits serialize deterministically without lost updates.

---

### Milestone 3: Transactional Outbox Pattern & Asynchronous Webhook Alert Dispatcher
- **Estimated Effort:** 6.5 Hours
- **Target Layer:** `backend/src/application/alert/`, `backend/src/infrastructure/persistence/repositories/PostgresAnomalyAlertRepository.ts`
- **Architectural Reference:** `ADR-0004`, `ADR-0006`, `12-database-structure.md` (`outbox_webhook_events`)
- **Scope & Deliverables:**
  - [ ] Persist an `outbox_webhook_events` record (status `PENDING`, `JSONB` payload) inside the exact same ACID transaction that creates a `WARNING` or `CRITICAL` `AnomalyAlert`.
  - [ ] Implement `HttpWebhookDispatcherAdapter` (implementing `IAlertWebhookDispatcher`) with configurable timeout, HMAC-SHA256 payload signature headers (`X-FlowGuard-Signature`), and exponential backoff retry logic.
  - [ ] Build a non-blocking background relay poller querying `idx_outbox_pending_created` (`FOR UPDATE SKIP LOCKED`) to dispatch pending events and transition rows to `DISPATCHED` or `FAILED`.
  - [ ] Add unit and integration tests using mocked webhook receivers.

---

### Milestone 4: Exhaustive Boundary Validation & Git-Native Bruno (`.bru`) Black-Box Suites
- **Estimated Effort:** 6 Hours
- **Target Layer:** `backend/tests/integration/` & `backend/tests/bruno/FlowGuard/`
- **Architectural Reference:** `ADR-0006`, `ADR-0007`, `ADR-0008`
- **Scope & Deliverables:**
  - [ ] Complete Joi boundary validation pipes across all request DTOs (`stripUnknown: true`), ensuring mass-assignment attempts on `/auth/register` and `/users` are stripped or rejected with structured `400 Bad Request` diagnostics.
  - [ ] Expand in-memory **Supertest** integration suites (`*.controller.spec.ts`) to assert all RFC status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`) across every module.
  - [ ] Author chained **Bruno (`.bru` / `.yml`)** API collections under `backend/tests/bruno/FlowGuard/` covering end-to-end stateful workflows:
    1. `01-Auth_and_Users`: Admin login, JWT extraction (`bru.setEnvVar`), staff provisioning, RBAC role guards (`401`/`403`).
    2. `02-Plant_Topology`: Sector & line creation, `ON DELETE RESTRICT` conflict verification (`409 Conflict`).
    3. `03-Sensors_and_Thresholds`: Sensor attachment and invalid threshold rejection (`critical <= warning` $\rightarrow$ `422`).
    4. `04-Telemetry_Sliding_Window`: Multi-sample telemetry burst triggering automatic line halt (`FAULT_HALTED`).
    5. `05-Anomaly_Alerts` & `06-Spare_Parts_Stock`: Operator alert acknowledgement and non-negative stock deduction boundary tests.

---

### Milestone 5: OpenMetrics / Prometheus Telemetry Scraper Endpoint (`/api/v1/metrics`)
- **Estimated Effort:** 4.5 Hours
- **Target Layer:** `backend/src/presentation/http/controllers/HealthController.ts`, `backend/src/application/topology/LineHealthQueryService.ts`
- **Architectural Reference:** `01-problem-statement.md` (§2.5, §4 Task 5), `08-architecture-summary.md` (§3.1)
- **Scope & Deliverables:**
  - [ ] Implement an in-memory metrics registry tracking real-time counters and gauges (`flowguard_telemetry_readings_ingested_total`, `flowguard_sliding_window_evaluation_duration_ms`, `flowguard_active_anomaly_alerts`, `flowguard_conveyor_lines_by_status`).
  - [ ] Expose `GET /api/v1/metrics` returning `text/plain; version=0.0.4; charset=utf-8` compliant with Prometheus scrapers.
  - [ ] Add automated Supertest assertions verifying OpenMetrics exposition syntax and counter increments after telemetry ingestion.

---

## 3. Summary of Planned Effort

| Milestone | Core Architectural Area | Target Files / Modules | Est. Hours |
| :--- | :--- | :--- | :---: |
| **Milestone 1** | Moving Median ($\tilde{x}_W$) & IQR Outlier Filter | `domain/sensor/*` | **6.0 h** |
| **Milestone 2** | Optimistic (`version`) & Pessimistic (`FOR UPDATE`) Locks | `infrastructure/persistence/*`, `application/*` | **5.0 h** |
| **Milestone 3** | Transactional Outbox & Webhook Alert Dispatcher | `application/alert/*`, `infrastructure/*` | **6.5 h** |
| **Milestone 4** | Boundary Validation Pipes, Supertest & Bruno Suites | `presentation/http/*`, `tests/bruno/*` | **6.0 h** |
| **Milestone 5** | OpenMetrics / Prometheus Exporter (`/api/v1/metrics`) | `presentation/http/controllers/*` | **4.5 h** |
| **Total** | | | **28.0 Hours** |