# ADR-0006: RESTful API Design, Intentional Resource Modeling, Boundary Validation & OpenAPI 3.0

- **Status:** Accepted

- **Context:**
**FlowGuard** serves as the central integration backbone connecting operator web dashboards, industrial engineering configuration tools, automated sensor gateways, and upcoming OpenMetrics/Prometheus scrapers (`02-context.md`, §3–§4). 

To prevent *Loosey-Goosey* or RPC-style *CRUDY* interfaces that leak internal database structures or lose business intent (KB §7.4, §7.5, §8.2), we must establish strict conventions for URI design, HTTP method semantics, input validation at the perimeter, error response payloads, and machine-readable API documentation (`01-problem-statement.md`, §3).

- **Decision:**
We adopt a **Contract-First RESTful API Architecture** aligned with **Level 2 of the Richardson Maturity Model** and Roy Fielding's REST principles, documented via **OpenAPI 3.0 (Swagger)** and protected by **Perimeter Input Validation** (KB §7.5, §8.2, §8.3, §9.2):

1. **Resource-Oriented URI Design (Nouns, Plural Collections & Hierarchy — KB §8.2):**
   - All endpoints are versioned under `/api/v1/` and address domain **Resources** using plural nouns:
     - `/api/v1/plant-sectors` and `/api/v1/plant-sectors/{sectorId}`
     - `/api/v1/conveyor-lines` and `/api/v1/conveyor-lines/{lineId}`
     - `/api/v1/sensor-nodes` and `/api/v1/sensor-nodes/{sensorId}/telemetry-readings`
     - `/api/v1/anomaly-alerts` and `/api/v1/spare-parts`
   - **Prohibition of CRUD Verb Names in URIs:** Endpoints never use RPC-style paths like `/api/v1/getConveyorLines` or `/api/v1/deleteSensor/12` (KB §8.2, Principle 1).
   - **Intentional / Task-Based Sub-Resources (CQRS Alignment — KB §7.5, §8.2):** State transitions that carry specific domain intent are modeled as explicit controller sub-resources or state resources rather than generic full-record `PUT` overwrites:
     - `POST /api/v1/anomaly-alerts/{alertId}/acknowledge` (captures operator acknowledgement intent and audit note).
     - `PATCH /api/v1/conveyor-lines/{lineId}/operational-status` (intentionally transitions line between `RUNNING`, `MAINTENANCE`, `FAULT_HALTED`, or `DEACTIVATED`).
   - **Query String Filtering & Pagination:** Collection reads never execute unbounded `findAll()` queries on large tables (KB §4.2, §8.2). Filtering and pagination use standard query parameters: `GET /api/v1/anomaly-alerts?status=OPEN&severity=CRITICAL&page=1&pageSize=25`.

2. **Strict HTTP Method & Status Code Semantics (KB §8.2, §8.3):**
   - `GET`: Safe and idempotent resource retrieval (`200 OK` or `404 Not Found`).
   - `POST`: Resource creation or intentional command submission (`201 Created` with `Location` header for newly created resources, or `200 OK` / `202 Accepted` for processing actions).
   - `PUT` / `PATCH`: Idempotent full replacement (`PUT`) or partial state mutation (`PATCH`) (`200 OK` or `204 No Content`).
   - `DELETE`: Logical or physical deletion (`204 No Content`), returning `409 Conflict` when blocked by `ON DELETE RESTRICT` referential integrity (`ADR-0003`).
   - **Deterministic Error Mapping:**
     - `400 Bad Request`: Syntactic JSON error or boundary schema validation failure (Joi/Zod).
     - `401 Unauthorized`: Missing, expired, or invalid JWT (`ADR-0005`).
     - `403 Forbidden`: Valid JWT, but insufficient RBAC role for the operation (`ADR-0005`).
     - `404 Not Found`: Target Aggregate Root ID does not exist.
     - `409 Conflict`: Duplicate unique business code (`sectorCode`, `serialNumber`), optimistic concurrency version mismatch, or `ON DELETE RESTRICT` violation.
     - `422 Unprocessable Entity`: Domain invariant violation (e.g., attempting to set `criticalThreshold <= warningThreshold` or deducting spare parts below zero).
     - `500 Internal Server Error`: Unhandled technical failure (sanitized in production so stack traces never leak).

3. **Perimeter Input Validation Before Controller Execution (KB §9.2):**
   - Every incoming request (`req.body`, `req.query`, `req.params`) is validated at the routing boundary using declarative **Joi / Zod Validation Pipes** before reaching the Controller or Application Service (KB §9.2). Malformed payloads are rejected immediately with `400 Bad Request` and structured field-level diagnostics.

4. **Interactive OpenAPI 3.0 Specification:**
   - The complete REST contract—including request/response DTO schemas, bearer authentication security schemes, and HTTP status codes—is published via OpenAPI 3.0 and served interactively at `/api/docs` (KB §9.5, §19.2).

- **Considered Alternatives:**

  ### 1. RPC-Over-HTTP (Richardson Level 0 — "The Swamp of POX/JSON")
  - *Description:* Exposing a single endpoint (e.g., `POST /api/rpc`) or action-named URLs (`POST /api/createSector`, `POST /api/updateStock`) returning `200 OK` with `{ success: false, errorCode: 104 }` for all errors (KB §8.3).
  - *Pros:* Simple to map directly to procedural functions.
  - *Cons:* Ignores HTTP caching, idempotency guarantees, standard status codes, and RESTful resource addressability (KB §8.2, §8.3). Forces external integrators and monitoring tools to parse custom body flags just to detect failures.

  ### 2. GraphQL API
  - *Description:* Exposing a single `/graphql` endpoint allowing clients to submit custom query trees and mutations.
  - *Pros:* Flexible field selection for complex front-end views.
  - *Cons:* Poor fit for high-frequency industrial sensor telemetry ingestion, standard HTTP status code semantics, and simple cURL/webhook integrations. GraphQL also reintroduces severe **N+1 Query** risks requiring complex DataLoader caching layers, whereas our REST + SQL View approach (`ADR-0003`) solves read performance deterministically (KB §21.2).

  ### 3. Full HATEOAS (Richardson Level 3) on All Telemetry Payloads
  - *Description:* Embedding hypermedia `_links` arrays inside every single telemetry reading and list item response (KB §8.2, Principle 5; §8.3).
  - *Pros:* Self-discoverable state transitions for hypermedia clients.
  - *Cons:* Significantly inflates JSON payload sizes during high-throughput telemetry queries without adding value for fixed industrial IoT gateways and Prometheus scrapers. Level 2 REST with intentional sub-resources provides the optimal balance of clarity and performance.

- **Consequences:**

  ### Positive
  - **Self-Documenting & Predictable Integration:** Front-end developers, automated test suites, and third-party industrial systems can inspect `/api/docs` (OpenAPI 3.0) and rely on standard RFC HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `422`) (KB §8.3).
  - **Fail-Fast Perimeter Protection:** Invalid types, missing required fields, or SQL/XSS injection strings are rejected at the Joi/Zod validation pipe before any domain object is instantiated or any database connection is acquired (KB §9.2, §16.1).
  - **Decoupled Evolution via DTOs:** Because REST Controllers expose dedicated Request/Response DTOs rather than internal Domain Entities or database rows, internal refactoring of the Domain Ring never breaks external API clients (KB §7.4).

  ### Negative / Trade-offs
  - **DTO & Schema Maintenance:** Every endpoint requires maintaining synchronized Request/Response DTO definitions, validation schemas, and OpenAPI annotations.

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial decision establishing Richardson Level 2 REST conventions, boundary validation, and OpenAPI 3.0 contracts. |