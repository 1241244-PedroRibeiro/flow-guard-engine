# Key Architectural Scenarios: FlowGuard

## 1. Introduction and Purpose of Key Scenarios
In software architecture documentation, key architectural scenarios capture the most critical functional paths, high-risk operational areas, and quality attribute intersections that validate the system's design against non-functional drivers (ARQSI_01_intro_SW_ARCH.pdf, p. 19; ARQSI_02_sw_ach_documentation.pdf, p. 5)[cite: 19]. For the FlowGuard telemetry engine, these scenarios exercise security boundaries, referential consistency, sliding-window streaming math, and modular component isolation under realistic industrial conditions.

---

## 2. Key Scenario 1: Secure Engineer Authentication and Role-Based Route Authorization
- **Description:** An industrial engineer or system administrator accesses protected administrative capabilities—such as configuring plant sectors, defining conveyor line topologies, or calibrating sliding-window thresholds—by presenting valid authentication credentials (`01-problem-statement.md`, §3; `02-context.md`, §3).
- **Architectural Drivers:** Security, Maintainability, and Role-Based Access Control (RBAC) (ADR-0005).
- **Flow & Behaviour:** 
  1. The client application issues an HTTP request containing credentials (`POST /api/v1/auth/login`) to the authentication controller (ADR-0005).
  2. The application service verifies credentials against salted password hashes (**`Argon2id`**) retrieved from the persistence repository (ADR-0002, ADR-0005).
  3. Upon verification, the service issues a stateless JSON Web Token (JWT) encapsulating standardized claims: Subject ID (`sub`), assigned system roles (`OPERATOR`, `ENGINEER`, or `ADMINISTRATOR`), and an expiration timestamp (`exp`) (ADR-0005).
  4. Subsequent requests to protected administrative endpoints include the token in the standard HTTP request header (`Authorization: Bearer <token>`) (ADR-0005).
  5. Decoupled perimeter authentication and role-validation guards (NestJS `JwtAuthGuard` & `RolesGuard`) intercept the HTTP request, verify the cryptographic signature against the secret key, confirm validity, and enforce the `ENGINEER` role requirement before dispatching execution to application controllers (ARQSI_04_architectural_styles.pdf, p. 18; ADR-0005).
- **Architectural Validation:** Confirms that authentication and role authorization policies are enforced at the transport perimeter, shielding application services and domain aggregates from infrastructure and protocol concerns (ARQSI_04_architectural_styles.pdf, p. 18; ADR-0005).

---

## 3. Key Scenario 2: Topological Integrity Enforcement during Asset Deletion
- **Description:** An engineer attempts to delete a master industrial asset (such as a `PlantSector` or `ConveyorLine`) that is actively referenced by operational sensor nodes or historical telemetry audit logs (`01-problem-statement.md`, §2.2).
- **Architectural Drivers:** Data Integrity, Referential Consistency, and Domain Invariant Preservation (`01-problem-statement.md`, §2.2).
- **Flow & Behaviour:**
  1. A client initiates a deletion command (`DELETE /api/v1/plant-sectors/{id}`) (ARQSI_03_REST architectural style.pdf, pp. 13-14).
  2. The application service coordinates with the persistence repository to verify dependency guards before performing any database write operation (`01-problem-statement.md`, §2.2).
  3. Relational foreign key constraints configured with restrict policies (**`FOREIGN KEY ... ON DELETE RESTRICT`**) along with domain service queries detect active references, immediately halting the operation (02 - Node.js - v2.pdf, p. 36; ADR-0003).
  4. The system blocks the deletion and returns an RFC-compliant HTTP **`409 Conflict`** response with a structured error payload detailing the dependent child assets, preventing cascading state corruption (ARQSI_03_REST architectural style.pdf, p. 15; 01 - Introduction to Web Development.v2.pdf, p. 48; ADR-0003, ADR-0006).
- **Architectural Validation:** Demonstrates that the persistence architecture and domain service layer protect referential integrity, eliminating orphan records and preserving historical auditability without manual database interventions (ADR-0003).

---

## 4. Key Scenario 3: Real-Time Telemetry Ingestion and Sliding-Window Statistical Evaluation
- **Description:** High-frequency sensor streams arrive continuously from industrial conveyor belts. The engine processes incoming readings in memory, computes sliding-window moving averages and moving medians, and evaluates anomaly rules without degrading database throughput (`01-problem-statement.md`, §2.1; ADR-0004).
- **Architectural Drivers:** Performance, Reliability, and Real-Time Anomaly Detection (ADR-0004).
- **Flow & Behaviour:**
  1. Telemetry payloads (`POST /api/v1/sensor-nodes/{sensorId}/telemetry-readings`) are validated at the routing boundary using strict validation schemas (02 - Node.js - v2.pdf, pp. 56-58; ADR-0006).
  2. The request reaches the `TelemetryEvaluationEngine` domain service, where the reading passes through the *Pipes-and-Filters* pipeline (ADR-0004):
     - *Filter 1:* Sanitizes physical boundaries and range preconditions (`TelemetryValue`).
     - *Filter 2:* Appends the reading to the sensor's bounded circular ring buffer and computes moving averages ($\mu_W$) and moving medians ($\tilde{x}_W$) in memory in microseconds (ADR-0004).
     - *Filter 3:* Evaluates smoothed metrics against active `ThresholdRule` bounds (`WARNING` vs. `CRITICAL`).
     - *Filter 4:* If a threshold breach is confirmed, an `AnomalyAlert` is generated and the parent `ConveyorLine` state transitions (`RUNNING` $\rightarrow$ `DEGRADED_WARNING` or `FAULT_HALTED`) (ADR-0004).
  3. The enriched telemetry reading and state mutation are saved atomically within an ACID database transaction (02 - Node.js - v2.pdf, p. 36; ADR-0003).
- **Architectural Validation:** Confirms that high-frequency telemetry processing is handled in V8 memory via bounded sliding-window buffers, ensuring sub-millisecond evaluation times and preventing database I/O saturation (ADR-0004).

---

## 5. Key Scenario 4: High-Contention Spare-Part Stock Deduction
- **Description:** Multiple automated maintenance workflows simultaneously request spare-part replacements that draw from the same normalized non-negative inventory pool ($u \in \mathbb{N}_0$) (`01-problem-statement.md`, §2.3).
- **Architectural Drivers:** Concurrency Control, ACID Consistency, and Inventory Invariant Preservation (`01-problem-statement.md`, §2.3, §2.4).
- **Flow & Behaviour:**
  1. The application service opens an explicit PostgreSQL transaction (`BEGIN`) (ADR-0003).
  2. The repository executes a **pessimistic row lock** (`SELECT stock_units FROM spare_part_stock WHERE id = $1 FOR UPDATE`) to serialize conflicting updates (02 - Node.js - v2.pdf, p. 36; ADR-0003).
  3. The domain entity verifies the non-negative inventory invariant (`stock_units - requested_units >= 0`). If insufficient, the transaction rolls back and throws an unprocessable entity error (**`422 Unprocessable Entity`**) (ADR-0003, ADR-0006).
  4. If sufficient, the stock counter updates and the transaction commits (`COMMIT`), preventing race conditions, lost updates, or negative inventory balances (02 - Node.js - v2.pdf, p. 36; ADR-0003).
- **Architectural Validation:** Confirms that concurrent spare-part allocation requests are serialized safely via row-level locking and transaction boundaries, upholding absolute data consistency under high industrial write contention (ADR-0003).