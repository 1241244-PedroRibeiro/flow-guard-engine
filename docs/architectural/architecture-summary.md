# Architecture Summary: Services, Functionalities & REST API Contracts

## 1. Summary of Services & Processing Pipeline

Every request in **FlowGuard** traverses the same deterministic Clean Architecture pipeline (`ADR-0001`, `ADR-0002`):  
**Client / Sensor Gateway $\rightarrow$ NestJS Routing Perimeter (`JwtAuthGuard`, `RolesGuard`, Joi/Zod Validation Pipe) $\rightarrow$ REST Controller $\rightarrow$ Application Service $\rightarrow$ Pure Domain Model / Sliding-Window Engine $\rightarrow$ Repository Port $\rightarrow$ Native PostgreSQL Pool (`pg`)**.

| Service / Domain Component | Layer | Responsibility | Used by |
|---|---|---|---|
| `AuthAndUserService` | Application | Verifies user credentials against **Argon2id** hashes, issues stateless JWTs (8h shift expiry), and governs staff onboarding (`PENDING_REGISTRATION` $\rightarrow$ `ACTIVE`). | Authentication, User Provisioning, Role Management |
| `PlantTopologyService` | Application | Manages `PlantSector` and `ConveyorLine` lifecycles, enforces unique business codes (`sectorCode`, `lineCode`), handles soft deactivation, and coordinates optimistic concurrency locking (`Task 2`). | Sector & Conveyor Line Management, Operational Status Transitions |
| `SensorManagementService` | Application | Registers `SensorNode` transducers (`BELT_VELOCITY`, `MOTOR_VIBRATION`, `BEARING_TEMPERATURE`, `OPTICAL_COUNTER`), manages calibration states, and attaches `ThresholdRule` bounds. | Sensor Node Management, Threshold Calibration |
| `TelemetryIngestionService` | Application | Orchestrates real-time telemetry ingestion, invokes `TelemetryEvaluationEngine`, persists enriched readings, and atomically triggers alerts and line state transitions upon breaches. | High-Frequency Sensor Telemetry Ingestion |
| `TelemetryEvaluationEngine` | Domain Service | Executes the 4-stage *Pipes-and-Filters* in-memory pipeline over bounded circular **Ring Buffers** ($N \le 128$), computing Moving Averages ($\mu_W$) and Moving Medians ($\tilde{x}_W$, `Task 1`). | `TelemetryIngestionService` |
| `LineStateTransitionDomainService` | Domain Service | Evaluates severity breaches (`WARNING` vs. `CRITICAL`), instantiates `AnomalyAlert` aggregates, and transitions parent `ConveyorLine` states (`RUNNING` $\rightarrow$ `DEGRADED_WARNING` or `FAULT_HALTED`). | `TelemetryIngestionService` |
| `AnomalyAlertService` | Application | Governs alert acknowledgement (`OPEN` $\rightarrow$ `ACKNOWLEDGED` $\rightarrow$ `RESOLVED`) by operators and coordinates asynchronous Transactional Outbox webhook dispatches (`Task 3`). | Alert Monitoring, Operator Acknowledgement, Webhook Dispatch |
| `SparePartsStockService` | Application | Manages normalized non-negative integer spare-part balances ($u \in \mathbb{N}_0$), executing replenishments and row-locked (`SELECT ... FOR UPDATE`) deductions (`Task 2`). | Maintenance Inventory Management, Stock Adjustments |
| `LineHealthQueryService` | Application (CQRS Read) | Queries the pre-joined PostgreSQL View `v_conveyor_line_health_summary` to avoid N+1 queries and formats system counters for the OpenMetrics `/api/v1/metrics` endpoint (`Task 5`). | Floor Dashboards, Health Checks, Prometheus Scraping |

---

## 2. Summary of Functionalities

### 2.1. Identity, Authentication & RBAC Governance (`FG-AUTH`)
- **Stateless Shift Authentication:** Authenticates users via `POST /api/v1/auth/login`, returning an RFC 7519 JWT signed with `JWT_SECRET` and valid for an 8-hour industrial shift (`ADR-0005`).
- **Cryptographic Hardening (Argon2id):** Passwords are hashed outside the Node.js event loop using memory-hard Argon2id parameters, preventing timing and GPU cracking attacks (`ADR-0002`, `ADR-0005`).
- **Anti-Enumeration & Mass-Assignment Defense:** Login failures return identical `401 Unauthorized` responses regardless of whether the email exists. Registration and update payloads strip role fields (`stripUnknown: true`) so clients cannot self-assign privileged roles (KB §9.4).
- **Role-Based Access Segregation:** Enforces three distinct operational roles: `OPERATOR` (floor monitoring & alert acknowledgement), `ENGINEER` (topology, sensor, threshold, and spare-part configuration), and `ADMINISTRATOR` (user and security governance).

### 2.2. Plant Sector & Conveyor Line Topology Management (`FG-TOPO`)
- **Hierarchical Asset Modeling:** Organizes industrial facilities into `PlantSector` aggregates containing multiple `ConveyorLine` aggregates (`01-problem-statement.md`, §2.2).
- **Referential Deletion Protection (`ON DELETE RESTRICT`):** Attempting to delete a `PlantSector` that holds conveyor lines, or a `ConveyorLine` that holds sensor nodes or telemetry history, is blocked at the database level and mapped to `409 Conflict` (`ADR-0003`).
- **Soft Deactivation & Reactivation:** Obsolete or maintenance-bound conveyor lines can be deactivated (`isActive = false`, `operationalStatus = DEACTIVATED`) and reactivated (`isActive = true`) without losing historical telemetry audit trails.

### 2.3. Sensor Nodes & Threshold Rule Configuration (`FG-SENS`)
- **Heterogeneous Transducer Support:** Supports `BELT_VELOCITY` ($\text{m/s}$), `MOTOR_VIBRATION` ($\text{mm/s}$), `BEARING_TEMPERATURE` ($^{\circ}\text{C}$), and `OPTICAL_COUNTER` ($\text{units/min}$).
- **Invariant-Protected Threshold Bounds:** Engineers configure `ThresholdRule` entities per sensor. Both the Domain Value Object (`ThresholdBounds`) and PostgreSQL `CHECK (critical_limit > warning_limit)` constraints guarantee that critical tolerances strictly exceed warning tolerances (`422 Unprocessable Entity` on violation).

### 2.4. Real-Time Telemetry Ingestion & In-Memory Sliding Window (`FG-INGEST`)
- **Sub-Millisecond Ring Buffer Aggregation:** Incoming readings are appended to a per-sensor circular buffer ($N \le 128$) in V8 memory (`ADR-0004`).
- **Four-Stage Pipes-and-Filters Pipeline:**
  1. *Physical Plausibility Sanitizer:* Rejects negative velocities or out-of-range transducer faults (`422 Unprocessable Entity`).
  2. *Sliding-Window Aggregator:* Computes the real-time Moving Average ($\mu_W$) (baseline) and Moving Median ($\tilde{x}_W$) (`Roadmap Task 1`).
  3. *Threshold Evaluator:* Compares smoothed window metrics against active `ThresholdRule` limits to prevent false-positive single-sample spikes.
  4. *Atomic State & Alert Dispatcher:* Persists the enriched `TelemetryReading` and, upon a breach, atomically creates an `AnomalyAlert` and transitions the `ConveyorLine` state.

### 2.5. Anomaly Alerting & Operational Acknowledgement (`FG-ALERT`)
- **Deterministic Alert Lifecycle:** Alerts transition strictly along `OPEN` $\rightarrow$ `ACKNOWLEDGED` (recording `acknowledgedBy` User UUID, timestamp, and operator diagnostic notes) $\rightarrow$ `RESOLVED`.
- **Asynchronous Webhook Dispatch (`Roadmap Task 3`):** Critical threshold breaches record an outbox event within the same PostgreSQL transaction and dispatch webhook notifications to external maintenance endpoints.

### 2.6. Abstract Spare-Part Inventory Control (`FG-STOCK`)
- **Normalized Non-Negative Integer Model:** Spare parts are tracked as discrete abstract units ($u \in \mathbb{N}_0$) without physical unit conversion overhead (`01-problem-statement.md`, §2.3).
- **Concurrency-Safe Deductions (`Roadmap Task 2`):** Stock consumption executes inside an explicit transaction using `SELECT ... FOR UPDATE` row-level locking and `CHECK (stock_units >= 0)`, returning `422 Unprocessable Entity` if available balance is insufficient.

---

## 3. Summary of REST API Endpoints

**Access Levels (`ADR-0005`, `ADR-0006`):**  
* `Public`: Unauthenticated access (health checks, login, and public onboarding registration).  
* `Gateway / Engineer`: Valid JWT (or gateway bearer token) authorized for telemetry ingestion.  
* `Operator+`: Valid JWT holding `OPERATOR`, `ENGINEER`, or `ADMINISTRATOR` role.  
* `Engineer+`: Valid JWT holding `ENGINEER` or `ADMINISTRATOR` role.  
* `Admin`: Valid JWT holding `ADMINISTRATOR` role.

### 3.1. Diagnostics, Health & Observability

| Method | Endpoint | Description | Access | Success | Errors |
|---|---|---|---|---|---|
| `GET` | `/api/v1/health` | Liveness and readiness diagnostic probe | Public | `200 OK` | `503` |
| `GET` | `/api/v1/metrics` | Scrape OpenMetrics / Prometheus counters *(Roadmap Task 5)* | Public / Scraper | `200 OK` (Text) | `500` |

### 3.2. Authentication & User Governance (`FG-AUTH`)

| Method | Endpoint | Description | Access | Success | Errors |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Authenticate credentials (Argon2id) and issue stateless JWT | Public | `200 OK` + Token | `400`, `401` |
| `POST` | `/api/v1/auth/register` | Public operator self-registration (`PENDING_REGISTRATION`) | Public | `201 Created` | `400`, `409` |
| `POST` | `/api/v1/users` | Provision staff account (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) | Admin | `201 Created` | `400`, `401`, `403`, `409` |
| `GET` | `/api/v1/users` | List system users with pagination and role filtering | Admin | `200 OK` + Page | `401`, `403` |
| `PATCH` | `/api/v1/users/:id/status` | Activate or deactivate user account | Admin | `200 OK` | `400`, `401`, `403`, `404` |
| `PATCH` | `/api/v1/users/:id/roles` | Assign or revoke RBAC roles | Admin | `200 OK` | `400`, `401`, `403`, `404` |

### 3.3. Plant Sectors & Conveyor Lines (`FG-TOPO`, `FG-QUERY`)

| Method | Endpoint | Description | Access | Success | Errors |
|---|---|---|---|---|---|
| `GET` | `/api/v1/plant-sectors` | List plant sectors (filterable by `isActive`) | Operator+ | `200 OK` + Array | `401` |
| `GET` | `/api/v1/plant-sectors/:id` | Get plant sector details by UUID or `sectorCode` | Operator+ | `200 OK` + Object | `401`, `404` |
| `POST` | `/api/v1/plant-sectors` | Register a new industrial plant sector | Engineer+ | `201 Created` | `400`, `401`, `403`, `409` |
| `PUT` | `/api/v1/plant-sectors/:id` | Update plant sector designation and description | Engineer+ | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| `DELETE` | `/api/v1/plant-sectors/:id` | Delete unreferenced plant sector (`ON DELETE RESTRICT` guard) | Engineer+ | `204 No Content` | `401`, `403`, `404`, `409` |
| `GET` | `/api/v1/conveyor-lines` | List conveyor lines with CQRS health summary (`v_conveyor_line_health_summary`) | Operator+ | `200 OK` + Array | `401` |
| `GET` | `/api/v1/conveyor-lines/:id` | Get conveyor line details and current operational state | Operator+ | `200 OK` + Object | `401`, `404` |
| `POST` | `/api/v1/conveyor-lines` | Create conveyor line inside a plant sector | Engineer+ | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| `PATCH` | `/api/v1/conveyor-lines/:id/operational-status` | Transition operational status (`RUNNING`, `MAINTENANCE`, `DEACTIVATED`) *(Optimistic Lock Task 2)* | Operator+ | `200 OK` | `400`, `401`, `404`, `409`, `422` |
| `DELETE` | `/api/v1/conveyor-lines/:id` | Delete unreferenced conveyor line (`ON DELETE RESTRICT` guard) | Engineer+ | `204 No Content` | `401`, `403`, `404`, `409` |

### 3.4. Sensor Nodes, Threshold Rules & Telemetry Ingestion (`FG-SENS`, `FG-INGEST`)

| Method | Endpoint | Description | Access | Success | Errors |
|---|---|---|---|---|---|
| `GET` | `/api/v1/sensor-nodes` | List sensor nodes (filterable by `lineId`, `sensorType`, `isActive`) | Operator+ | `200 OK` + Array | `401` |
| `POST` | `/api/v1/sensor-nodes` | Attach a new sensor node to a conveyor line | Engineer+ | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| `PUT` | `/api/v1/sensor-nodes/:id/threshold-rule` | Configure or update `warningLimit` and `criticalLimit` (`critical > warning`) | Engineer+ | `200 OK` | `400`, `401`, `403`, `404`, `422` |
| `PATCH` | `/api/v1/sensor-nodes/:id/deactivate` | Soft-deactivate sensor node | Engineer+ | `200 OK` | `401`, `403`, `404` |
| `POST` | `/api/v1/sensor-nodes/:id/telemetry-readings` | Ingest real-time telemetry reading, compute sliding-window stats ($\mu_W$, $\tilde{x}_W$), and evaluate anomaly bounds | Gateway / Engineer+ | `201 Created` + Evaluation Result | `400`, `401`, `404`, `422` |
| `GET` | `/api/v1/sensor-nodes/:id/telemetry-readings` | Query paginated historical readings and window metrics | Operator+ | `200 OK` + Page | `400`, `401`, `404` |

### 3.5. Anomaly Alerts & Spare-Part Inventory (`FG-ALERT`, `FG-STOCK`)

| Method | Endpoint | Description | Access | Success | Errors |
|---|---|---|---|---|---|
| `GET` | `/api/v1/anomaly-alerts` | List anomaly alerts (filterable by `status`, `severity`, `lineId`, paginated) | Operator+ | `200 OK` + Page | `401` |
| `POST` | `/api/v1/anomaly-alerts/:id/acknowledge` | Intentional command: Operator acknowledges alert with diagnostic note | Operator+ | `200 OK` | `400`, `401`, `404`, `409`, `422` |
| `POST` | `/api/v1/anomaly-alerts/:id/resolve` | Intentional command: Mark acknowledged alert as resolved | Engineer+ | `200 OK` | `401`, `403`, `404`, `409`, `422` |
| `GET` | `/api/v1/spare-parts` | List spare-part inventory balances ($u \in \mathbb{N}_0$) | Operator+ | `200 OK` + Array | `401` |
| `POST` | `/api/v1/spare-parts` | Register new spare-part catalog item with initial stock | Engineer+ | `201 Created` | `400`, `401`, `403`, `409`, `422` |
| `POST` | `/api/v1/spare-parts/:id/replenish` | Increase abstract spare-part stock units | Engineer+ | `200 OK` + Balance | `400`, `401`, `403`, `404`, `422` |
| `POST` | `/api/v1/spare-parts/:id/consume` | Deduct abstract spare-part stock units (`SELECT ... FOR UPDATE`, prevents $< 0$) | Operator+ | `200 OK` + Balance | `400`, `401`, `404`, `422` |

