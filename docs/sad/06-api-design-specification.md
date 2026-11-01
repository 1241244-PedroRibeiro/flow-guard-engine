# REST API Design Specification & Architectural Contract Guidelines: FlowGuard

## 1. Executive Summary and Contract-First Methodology
In strict alignment with **ADR-0006 (RESTful API Design, Intentional Resource Modeling, Boundary Validation & OpenAPI 3.0)** and the REST architectural principles formulated by Roy Fielding (KB §8.2, §8.3), this document establishes the formal transport conventions, RBAC permissions matrix, Data Transfer Object (DTO) payload contracts, and error resolution rules for the **FlowGuard Back-End REST API**.

To guarantee seamless interoperability across floor operator dashboards, industrial engineering tools, high-frequency IoT sensor gateways, automated Bruno CLI suites, and Prometheus metric scrapers, FlowGuard enforces a strict **Contract-First** methodology:
1. **Authoritative OpenAPI 3.0.3 Baseline:** The machine-readable specification (`docs/api/openapi.yaml`) serves as the single source of truth for all HTTP endpoints, request/response schemas, and security schemes (`ADR-0006`).
2. **Intentional / Task-Based Resource Modeling (CQRS Alignment):** Beyond standard collection CRUD, state mutations carrying specific industrial domain intent—such as acknowledging an anomaly alert, transitioning a conveyor line into maintenance, or consuming discrete spare-part units—are exposed as explicit, intention-revealing sub-resources (KB §7.5, §8.2).
3. **Four-Tier Automated Contract Verification:** Every endpoint contract, validation boundary, and status code (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`) is verified automatically via in-memory **Supertest** integration suites and Git-native **Bruno (`.bru`)** black-box collections (`ADR-0007`, `ADR-0008`).

---

## 2. Global Conventions, Uniform Resource Identifiers & Protocols

### 2.1. Protocol, Versioning, and Content Negotiation
* **Base Path:** `/api/v1` (explicitly versioned in the URI path to preserve backward compatibility for industrial edge gateways).
* **Transport:** HTTPS mandatory in staging/production deployments; HTTP permitted exclusively in local development and CI test runners.
* **Content Negotiation:** Request and response bodies use `application/json; charset=utf-8` (KB §8.1, §8.2 Principle 3). The `/api/v1/metrics` endpoint (Roadmap Task 5) negotiates `text/plain; version=0.0.4; charset=utf-8` in compliance with the OpenMetrics/Prometheus exposition specification.
* **Casing & Naming Standards:**
  * **URI Resource Paths:** Plural nouns in lowercase `kebab-case` (e.g., `/api/v1/plant-sectors`, `/api/v1/conveyor-lines`, `/api/v1/sensor-nodes`, `/api/v1/anomaly-alerts`, `/api/v1/spare-parts`). CRUD verb names in URLs (`/getLines`, `/deleteSector`) are strictly prohibited (KB §8.2 Principle 1).
  * **JSON Payload Properties (DTOs):** `camelCase` (e.g., `sectorCode`, `warningLimit`, `movingAverage`, `stockUnits`).
  * **Domain Enumerations:** `UPPER_SNAKE_CASE` (e.g., `MOTOR_VIBRATION`, `DEGRADED_WARNING`, `FAULT_HALTED`, `ACKNOWLEDGED`).

### 2.2. HTTP Method Semantics & Idempotency (Richardson Maturity Level 2)
In accordance with KB §8.2 (Principle 2) and §8.3:
* **`GET` (Safe & Idempotent):** Retrieves individual resource representations or paginated/filtered collections. Never mutates server or database state.
* **`POST` (Non-Idempotent Creation / Intentional Command):** Creates a new subordinate resource in a collection (returning `201 Created` + `Location` header) or triggers an atomic domain command such as telemetry ingestion, alert acknowledgement, or stock replenishment/consumption (returning `200 OK` or `201 Created`).
* **`PUT` (Idempotent Full Replacement):** Replaces mutable configuration details of an existing resource (e.g., updating a plant sector's designation or replacing a sensor's `ThresholdRule` bounds).
* **`PATCH` (Partial / Intentional State Transition):** Executes targeted lifecycle or operational state transitions (e.g., `/api/v1/conveyor-lines/{id}/operational-status` or `/api/v1/users/{id}/status`).
* **`DELETE` (Idempotent Removal with Referential Guard):** Permanently deletes an unreferenced master record, returning `204 No Content`. If the target asset is referenced by child records (`ON DELETE RESTRICT`), deletion is rejected with `409 Conflict`.

---

## 3. Role-Based Access Control (RBAC) & Endpoint Permissions Matrix

In accordance with **ADR-0005**, FlowGuard enforces three operational roles (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) validated via stateless JWT claims (`Authorization: Bearer <token>`) and active account status checks (`UserStatus.ACTIVE`).

| Capability / Scope | HTTP Method | Resource URI | Permitted Roles | Functional Intent & Scope | Success | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Diagnostics** | `GET` | `/api/v1/health` | **Public** | Liveness and database readiness probe (KB §9.5). | `200 OK` | `503` |
| **Observability (Task 5)** | `GET` | `/api/v1/metrics` | **Public / Scraper** | Exports real-time OpenMetrics / Prometheus telemetry counters. | `200 OK` | `500` |
| **FG-AUTH** | `POST` | `/api/v1/auth/login` | **Public** | Verifies credentials (`Argon2id`) and issues stateless 8h shift JWT. | `200 OK` | `400`, `401`, `403` |
| **FG-AUTH** | `POST` | `/api/v1/auth/register` | **Public** | Self-registers an `OPERATOR` account in `PENDING_REGISTRATION` status. | `201 Created` | `400`, `409` |
| **FG-AUTH** | `POST` | `/api/v1/users` | `ADMINISTRATOR` | Provisions staff account (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`). | `201 Created` | `400`, `401`, `403`, `409` |
| **FG-AUTH** | `GET` | `/api/v1/users?role=...&page=1&pageSize=20` | `ADMINISTRATOR` | Lists system users with pagination and role/status filtering. | `200 OK` | `400`, `401`, `403` |
| **FG-AUTH** | `PATCH` | `/api/v1/users/{id}/status` | `ADMINISTRATOR` | Activates or deactivates a user account (`ACTIVE` / `DEACTIVATED`). | `200 OK` | `400`, `401`, `403`, `404` |
| **FG-AUTH** | `PATCH` | `/api/v1/users/{id}/roles` | `ADMINISTRATOR` | Updates assigned RBAC roles for a user account. | `200 OK` | `400`, `401`, `403`, `404` |
| **FG-TOPO** | `POST` | `/api/v1/plant-sectors` | `ENGINEER`, `ADMINISTRATOR` | Registers a new industrial plant sector with unique `sectorCode`. | `201 Created` | `400`, `401`, `403`, `409` |
| **FG-TOPO** | `GET` | `/api/v1/plant-sectors?isActive=true` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Lists plant sectors with optional active filtering and search. | `200 OK` | `400`, `401` |
| **FG-TOPO** | `GET` | `/api/v1/plant-sectors/{id}` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Retrieves a plant sector by UUID or business `sectorCode`. | `200 OK` | `401`, `404` |
| **FG-TOPO** | `PUT` | `/api/v1/plant-sectors/{id}` | `ENGINEER`, `ADMINISTRATOR` | Updates sector designation, description, or active state. | `200 OK` | `400`, `401`, `403`, `404`, `409` |
| **FG-TOPO** | `DELETE` | `/api/v1/plant-sectors/{id}` | `ENGINEER`, `ADMINISTRATOR` | Removes an unreferenced plant sector (`ON DELETE RESTRICT` guard). | `204 No Content` | `401`, `403`, `404`, `409` |
| **FG-TOPO / QUERY** | `GET` | `/api/v1/conveyor-lines?sectorId=...` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Queries conveyor lines enriched via CQRS view `v_conveyor_line_health_summary`. | `200 OK` | `400`, `401` |
| **FG-TOPO** | `GET` | `/api/v1/conveyor-lines/{id}` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Retrieves detailed conveyor line state and attached sensor summary. | `200 OK` | `401`, `404` |
| **FG-TOPO** | `POST` | `/api/v1/conveyor-lines` | `ENGINEER`, `ADMINISTRATOR` | Registers a new conveyor line within an existing plant sector. | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| **FG-TOPO (Task 2)** | `PATCH` | `/api/v1/conveyor-lines/{id}/operational-status` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Transitions operational status (`RUNNING`, `MAINTENANCE`, `DEACTIVATED`) with optimistic `version` check. | `200 OK` | `400`, `401`, `404`, `409`, `422` |
| **FG-TOPO** | `DELETE` | `/api/v1/conveyor-lines/{id}` | `ENGINEER`, `ADMINISTRATOR` | Removes an unreferenced conveyor line (`ON DELETE RESTRICT` guard). | `204 No Content` | `401`, `403`, `404`, `409` |
| **FG-SENS** | `GET` | `/api/v1/sensor-nodes?lineId=...&sensorType=...` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Lists sensor nodes filtered by conveyor line, type, or active state. | `200 OK` | `400`, `401` |
| **FG-SENS** | `POST` | `/api/v1/sensor-nodes` | `ENGINEER`, `ADMINISTRATOR` | Attaches a new sensor transducer (`serialNumber`, `sensorType`) to a line. | `201 Created` | `400`, `401`, `403`, `404`, `409` |
| **FG-SENS** | `PUT` | `/api/v1/sensor-nodes/{id}/threshold-rule` | `ENGINEER`, `ADMINISTRATOR` | Configures or replaces `warningLimit` and `criticalLimit` (`critical > warning`). | `200 OK` | `400`, `401`, `403`, `404`, `422` |
| **FG-SENS** | `PATCH` | `/api/v1/sensor-nodes/{id}/deactivate` | `ENGINEER`, `ADMINISTRATOR` | Soft-deactivates a sensor node while preserving telemetry history. | `200 OK` | `401`, `403`, `404` |
| **FG-INGEST (Task 1)** | `POST` | `/api/v1/sensor-nodes/{id}/telemetry-readings` | `ENGINEER`, `ADMINISTRATOR` (or Gateway Token) | Ingests raw reading, updates in-memory Ring Buffer ($\mu_W$, $\tilde{x}_W$), and triggers alert/line transition on breach. | `201 Created` | `400`, `401`, `403`, `404`, `422` |
| **FG-INGEST** | `GET` | `/api/v1/sensor-nodes/{id}/telemetry-readings?page=1&pageSize=50` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Retrieves paginated historical readings with moving average and median metrics. | `200 OK` | `400`, `401`, `404` |
| **FG-ALERT** | `GET` | `/api/v1/anomaly-alerts?status=OPEN&severity=CRITICAL` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Lists anomaly alerts filtered by status, severity, or conveyor line. | `200 OK` | `400`, `401` |
| **FG-ALERT** | `POST` | `/api/v1/anomaly-alerts/{id}/acknowledge` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Intentional command acknowledging an `OPEN` alert with operator notes. | `200 OK` | `400`, `401`, `404`, `409`, `422` |
| **FG-ALERT** | `POST` | `/api/v1/anomaly-alerts/{id}/resolve` | `ENGINEER`, `ADMINISTRATOR` | Intentional command resolving an `ACKNOWLEDGED` alert after maintenance. | `200 OK` | `401`, `403`, `404`, `409`, `422` |
| **FG-STOCK** | `GET` | `/api/v1/spare-parts` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Lists spare-part catalog items and current abstract integer stock balances. | `200 OK` | `401` |
| **FG-STOCK** | `POST` | `/api/v1/spare-parts` | `ENGINEER`, `ADMINISTRATOR` | Registers a new spare part with initial non-negative abstract stock ($u \ge 0$). | `201 Created` | `400`, `401`, `403`, `409`, `422` |
| **FG-STOCK** | `POST` | `/api/v1/spare-parts/{id}/replenish` | `ENGINEER`, `ADMINISTRATOR` | Atomically increases abstract stock units and logs a `REPLENISHMENT` movement. | `200 OK` | `400`, `401`, `403`, `404`, `422` |
| **FG-STOCK (Task 2)** | `POST` | `/api/v1/spare-parts/{id}/consume` | `OPERATOR`, `ENGINEER`, `ADMINISTRATOR` | Atomically deducts abstract stock units under `SELECT ... FOR UPDATE` lock (rejects $< 0$ with `422`). | `200 OK` | `400`, `401`, `404`, `422` |

---

## 4. Contract Specifications: DTO Models and Domain Invariants

### 4.1. Authentication & User Governance DTOs (`FG-AUTH`)

* **`LoginRequestDTO` (`POST /api/v1/auth/login`):**
  ```json
  {
    "email": "eng.ribeiro@flowguard.industrial",
    "password": "Str0ng!ShiftPassword#2026"
  }

```

* **`LoginResponseDTO` (`200 OK`):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 28800,
  "user": {
    "id": "6f8a2b10-9c44-4d1a-8b22-112233445566",
    "firstName": "Pedro",
    "lastName": "Ribeiro",
    "email": "eng.ribeiro@flowguard.industrial",
    "status": "ACTIVE",
    "roles": ["ENGINEER"]
  }
}

```



### 4.2. Plant Topology & Optimistic Concurrency DTOs (`FG-TOPO`, `FG-QUERY`)

* **`CreateConveyorLineRequestDTO` (`POST /api/v1/conveyor-lines`):**
```json
{
  "sectorId": "a1b2c3d4-e5f6-4a5b-8c9d-001122334455",
  "lineCode": "LINE-SORT-NORTH-01",
  "name": "North Parcel Sorter Primary Belt"
}

```


* **`UpdateLineOperationalStatusRequestDTO` (`PATCH /api/v1/conveyor-lines/{id}/operational-status`):**
Includes the `expectedVersion` integer for Optimistic Concurrency Control (`ADR-0003`, Roadmap Task 2). If another engineer or automated fault transition modified the line concurrently, the endpoint rejects the stale write with HTTP `409 Conflict`.
```json
{
  "operationalStatus": "MAINTENANCE",
  "expectedVersion": 3,
  "reason": "Scheduled bearing replacement on drive roller #2"
}

```


* **`ConveyorLineHealthSummaryResponseDTO` (`GET /api/v1/conveyor-lines` — CQRS View Projection):**
```json
{
  "id": "b2c3d4e5-f6a7-4b6c-9d0e-112233445566",
  "sectorId": "a1b2c3d4-e5f6-4a5b-8c9d-001122334455",
  "sectorCode": "SEC-LOGISTICS-A",
  "lineCode": "LINE-SORT-NORTH-01",
  "name": "North Parcel Sorter Primary Belt",
  "operationalStatus": "DEGRADED_WARNING",
  "isActive": true,
  "version": 4,
  "activeSensorCount": 4,
  "openWarningAlertCount": 1,
  "openCriticalAlertCount": 0,
  "updatedAt": "2026-10-28T14:22:10.000Z"
}

```



### 4.3. Sensor Node & Threshold Rule DTOs (`FG-SENS`)

* **`UpsertThresholdRuleRequestDTO` (`PUT /api/v1/sensor-nodes/{id}/threshold-rule`):**
Enforces the domain and SQL invariant `criticalLimit > warningLimit`. Violating this boundary returns HTTP `422 Unprocessable Entity`.
```json
{
  "warningLimit": 4.5,
  "criticalLimit": 7.1,
  "unit": "mm/s",
  "windowSizeSamples": 32
}

```



### 4.4. Real-Time Telemetry Ingestion & Sliding-Window Evaluation DTOs (`FG-INGEST`)

* **`IngestTelemetryReadingRequestDTO` (`POST /api/v1/sensor-nodes/{id}/telemetry-readings`):**
```json
{
  "rawValue": 7.85,
  "unit": "mm/s",
  "recordedAt": "2026-10-28T14:25:00.120Z"
}

```


* **`TelemetryIngestionEvaluationResponseDTO` (`201 Created`):**
Returns the persisted reading enriched with the real-time in-memory sliding-window statistics ($\mu_W$, $\tilde{x}_W$) and any triggered `AnomalyAlert` or `ConveyorLine` state transition (`ADR-0004`).
```json
{
  "reading": {
    "id": "f9e8d7c6-b5a4-4f3e-8d2c-998877665544",
    "sensorId": "c3d4e5f6-a7b8-4c7d-8e1f-223344556677",
    "rawValue": 7.85,
    "movingAverage": 7.32,
    "movingMedian": 7.28,
    "unit": "mm/s",
    "windowSampleCount": 32,
    "recordedAt": "2026-10-28T14:25:00.120Z"
  },
  "evaluation": {
    "breachDetected": true,
    "severity": "CRITICAL",
    "previousLineStatus": "DEGRADED_WARNING",
    "newLineStatus": "FAULT_HALTED",
    "triggeredAlertId": "d4e5f6a7-b8c9-4d8e-9f2a-334455667788"
  }
}

```



### 4.5. Anomaly Alert Acknowledgement & Spare-Part Stock DTOs (`FG-ALERT`, `FG-STOCK`)

* **`AcknowledgeAlertRequestDTO` (`POST /api/v1/anomaly-alerts/{id}/acknowledge`):**
```json
{
  "diagnosticNote": "Inspecting drive motor mount bolts on Line North-01; belt halted safely."
}

```


* **`StockAdjustmentRequestDTO` (`POST /api/v1/spare-parts/{id}/consume` or `/replenish`):**
```json
{
  "units": 2,
  "reason": "Replaced 2 SKF-6204 bearings on LINE-SORT-NORTH-01 (Alert d4e5f6a7)"
}

```


* **`SparePartStockResponseDTO` (`200 OK`):**
```json
{
  "id": "e5f6a7b8-c9d0-4e9f-8a3b-445566778899",
  "partCode": "PRT-BRG-6204",
  "name": "High-Speed Conveyor Roller Bearing SKF-6204",
  "stockUnits": 18,
  "updatedAt": "2026-10-28T14:30:15.000Z"
}

```



---

## 5. Standardized Error Envelope & HTTP Status Code Mapping

When any request fails boundary validation, authentication, authorization, referential checks, or domain invariants, the global `HttpExceptionFilter` returns a uniform, RFC-compliant JSON error envelope (stack traces are never exposed in production, KB §9.2, §16.1):

```json
{
  "timestamp": "2026-10-28T14:32:10.405Z",
  "status": 409,
  "error": "Conflict",
  "message": "Cannot delete PlantSector SEC-LOGISTICS-A: actively referenced by 3 conveyor lines.",
  "path": "/api/v1/plant-sectors/a1b2c3d4-e5f6-4a5b-8c9d-001122334455",
  "details": [
    "Foreign key constraint fk_conveyor_lines_sector (ON DELETE RESTRICT) blocked deletion."
  ]
}

```

### HTTP Status Code Resolution Matrix

| Status Code | RFC Semantics | Architectural Scenario in FlowGuard |
| --- | --- | --- |
| **`200 OK`** | Success | Safe `GET` query, alert acknowledgement/resolution, or stock balance update. |
| **`201 Created`** | Resource Created | Creation of user, plant sector, conveyor line, sensor node, spare part, or telemetry reading. |
| **`204 No Content`** | Empty Success | Successful `DELETE` of an unreferenced plant sector or conveyor line. |
| **`400 Bad Request`** | Syntax / Validation Error | Joi/Zod perimeter validation failure (malformed UUID, missing required field, non-integer stock). |
| **`401 Unauthorized`** | Unauthenticated | Missing, malformed, or expired Bearer JWT, or invalid login credentials (identical message for anti-enumeration, `ADR-0005`). |
| **`403 Forbidden`** | Unauthorized Role / Status | Valid JWT, but caller lacks required RBAC role (e.g., `OPERATOR` attempting `DELETE /plant-sectors`) or account is `DEACTIVATED`. |
| **`404 Not Found`** | Resource Not Found | Target Aggregate Root UUID or business code (`sectorCode`, `lineCode`, `serialNumber`) does not exist. |
| **`409 Conflict`** | State / Referential Conflict | Duplicate unique business code (`sectorCode`, `email`), `ON DELETE RESTRICT` violation, invalid alert state transition, or optimistic concurrency `version` mismatch. |
| **`422 Unprocessable Entity`** | Domain Invariant Breach | Semantic domain violation: `criticalLimit <= warningLimit`, negative belt velocity, telemetry sent to a `DEACTIVATED` sensor, or spare-part deduction exceeding `stockUnits`. |
| **`500 Internal Server Error`** | Unhandled Server Fault | Unexpected infrastructure failure; sanitized generic message returned to client. |

---

## 6. Input Boundary Validation Architecture (Joi / Zod Pipes)

In accordance with KB §9.2 and **ADR-0005 / ADR-0006**, controllers never trust raw `req.body`, `req.query`, or `req.params`:

1. **Strict Schema Enforcement:** Every route attaches a declarative validation schema verifying primitive types, string bounds, UUID formats, and positive integer pagination (`page >= 1`, `1 <= pageSize <= 100`).
2. **Mass-Assignment Protection (`stripUnknown: true`):** Unrecognized fields—such as a client attempting to inject `"roles": ["ADMINISTRATOR"]` or `"status": "ACTIVE"` into `/api/v1/auth/register`—are stripped or rejected at the perimeter before reaching the controller.
3. **Fail-Fast Execution:** Invalid requests short-circuit immediately with HTTP `400 Bad Request`, consuming zero database connections or domain CPU cycles.