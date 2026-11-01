# ADR-0003: Relational Persistence Engine, Invariant Protection & Concurrency Control

- **Status:** Accepted

- **Context:**
**FlowGuard** manages a highly interconnected industrial asset hierarchy—`PlantSector` $\rightarrow$ `ConveyorLine` $\rightarrow$ `SensorNode` $\rightarrow$ `ThresholdRule`—alongside high-frequency `TelemetryReading` streams, `AnomalyAlert` lifecycles, and normalized `SparePartStock` counters (`01-problem-statement.md`, §2.1–§2.4; `02-context.md`, §2).

The domain imposes three non-negotiable data management requirements:
1. **Strict Referential Integrity & Deletion Protection:** Deleting a `PlantSector`, `ConveyorLine`, or `SensorNode` that is referenced by active rules or historical telemetry logs would corrupt industrial audit trails and compliance records. Such deletions must be strictly blocked (`ON DELETE RESTRICT`), whereas retirement of obsolete assets must occur via soft deactivation (`is_active = FALSE`) (`01-problem-statement.md`, §2.2; KB §9.3, §21.1).
2. **Domain Invariant Enforcement at the Storage Boundary:** Spare-part inventory balances ($u \in \mathbb{N}_0$) must never drop below zero, and sensor threshold bounds must satisfy $\text{min\_value} < \text{max\_value}$ under all execution paths (`01-problem-statement.md`, §2.3; KB §21.1).
3. **High-Concurrency Write Isolation:** Multiple sensor nodes and plant operators frequently trigger simultaneous state mutations on the same conveyor line (e.g., transitioning a line to `MAINTENANCE` or `FAULT_HALTED` while telemetry bursts arrive) or deduct spare-part stock units concurrently. The persistence layer must guarantee ACID transactions and prevent race conditions, lost updates, and phantom reads (`01-problem-statement.md`, §2.4; KB §11.7, §13.3).

- **Decision:**
We select **PostgreSQL (v16+)** as the primary relational database management system (RDBMS), accessed via a parameterized connection pool (`pg` / TypeORM query runner) encapsulated strictly behind Repository Adapters (KB §9.2, §9.3, §21.1):

1. **Normalized Relational Schema (3NF / BCNF):**
   Core domain entities are mapped to normalized relational tables in Third Normal Form / Boyce-Codd Normal Form to eliminate data redundancy and update anomalies (KB §11.3, §13.6). Cross-aggregate references are stored strictly as foreign key IDs (`UUID` or unique business codes like `sector_code`, `serial_number`) rather than coupling ORM object graphs across aggregate boundaries (KB §3.2, §21.1).

2. **Database-Level Invariant & Referential Enforcement:**
   In alignment with KB §21.1, the PostgreSQL schema acts as the ultimate fortress for domain invariants:
   - **Referential Integrity:** All foreign keys linking child assets or telemetry records to parent structures specify `ON DELETE RESTRICT` (defaulting away from dangerous `ON DELETE CASCADE` across aggregates) (KB §9.3, §11.4, §21.1).
   - **Check Constraints:** Explicit SQL `CHECK` constraints enforce domain boundaries directly in the engine, such as `CHECK (stock_units >= 0)`, `CHECK (window_size_seconds > 0)`, and `CHECK (critical_threshold > warning_threshold)` (KB §11.4, §21.1).
   - **Case-Insensitive Uniqueness:** Unique business identifiers (user emails, plant sector codes, sensor serial numbers) are enforced via functional unique indexes (`CREATE UNIQUE INDEX ... ON ... (LOWER(code))`) or `CITEXT` to prevent case-collation duplicates.

3. **Concurrency Control Strategy (ACID + Pessimistic & Optimistic Locking):**
   - **Multi-Entity Atomic Mutations:** Operations that record an anomaly alert and simultaneously transition a `ConveyorLine` status execute inside an explicit PostgreSQL transaction (`BEGIN` ... `COMMIT` / `ROLLBACK`) (KB §11.7).
   - **Row-Level Pessimistic Locking:** High-contention mutations (such as concurrent spare-part stock deductions or line state transitions scheduled in Roadmap Task 2) utilize `SELECT ... FOR UPDATE` to serialize conflicting writes at the row level (KB §5.2, §11.7).
   - **Optimistic Concurrency Control:** Configuration aggregates (`ConveyorLine`, `ThresholdRule`) include a `version INT NOT NULL DEFAULT 1` column incremented on every update to detect stale administrative edits (`409 Conflict`) (KB §5.2, §8.3).

4. **Read-Optimized SQL Views (Lightweight CQRS) & JSONB Hybrid Storage:**
   - Complex dashboard queries (e.g., aggregating active line health, sensor counts, and unacknowledged alert totals) use pre-joined **PostgreSQL Views** (`v_conveyor_line_health_summary`) to prevent the **N+1 Queries** performance anti-pattern (KB §7.5, §9.3, §21.2).
   - Semi-structured sensor metadata or raw webhook diagnostic payloads use PostgreSQL's native **`JSONB`** data type with GIN indexing, providing document flexibility without sacrificing relational ACID guarantees (KB §9.3).

- **Considered Alternatives:**

  ### 1. Document NoSQL Database (MongoDB with Mongoose ODM)
  - *Description:* Storing plant sectors, conveyor lines, and telemetry readings as JSON/BSON documents in MongoDB collections (KB §9.3, §13.3).
  - *Pros:* Flexible schema evolution; fast single-document reads when embedding child sub-documents (KB §9.3, §13.4).
  - *Cons:*
    - **No Native Referential Integrity on Delete:** MongoDB does not enforce foreign key constraints when a referenced document is deleted (KB §9.3). Preventing the deletion of a `PlantSector` or `ConveyorLine` with active sensors requires manual application-level pre-checks (`countDocuments`), which are inherently vulnerable to time-of-check to time-of-use (TOCTOU) race conditions under concurrent requests (KB §9.3).
    - **Document Size & Unbounded Growth Limits:** Embedding high-frequency `TelemetryReading` records inside a `SensorNode` document quickly breaches MongoDB's 16 MB document limit (KB §9.3, §13.4), forcing normalized `ObjectId` references anyway—which then require slow application-side `.populate()` calls prone to N+1 query issues (KB §9.3).

  ### 2. Specialized Time-Series Database Only (InfluxDB)
  - *Description:* Using a dedicated time-series engine as the sole persistence store for FlowGuard.
  - *Pros:* High compression and fast range aggregations over raw time-stamped metrics.
  - *Cons:* Poor fit for relational asset hierarchies, RBAC user management, spare-part inventory transactions, and strict foreign-key constraint enforcement (`ON DELETE RESTRICT`). Using InfluxDB alongside PostgreSQL would require managing polyglot persistence synchronization across two database engines, violating our simplicity principle for the core engine (KB §1.2, Principle 3).

  ### 3. Embedded File Database (SQLite)
  - *Description:* Storing relational tables in a local single-file SQLite database.
  - *Pros:* Zero external database server setup; fast local reads.
  - *Cons:* Database-level write locking (`SQLITE_BUSY`) serializes concurrent writes across the entire file rather than supporting fine-grained row-level locking (`SELECT ... FOR UPDATE`), creating a severe bottleneck during simultaneous multi-sensor telemetry ingestion bursts.

- **Consequences:**

  ### Positive
  - **Mathematical Guarantee of Data Integrity:** `ON DELETE RESTRICT` foreign keys and `CHECK (stock_units >= 0)` constraints ensure that neither application bugs nor concurrent race conditions can orphan telemetry records or produce negative inventory balances (KB §9.3, §21.1).
  - **Elimination of N+1 Query Bottlenecks:** Dedicated SQL Views (`v_conveyor_line_health_summary`) project aggregated read DTOs in a single database round-trip (KB §4.2, §21.2).
  - **Safe Concurrent State Transitions:** Row-level locks and transactional rollbacks guarantee deterministic behavior during simultaneous sensor anomaly triggers and operator acknowledgements (KB §11.7).
  - **SQL Injection Immunity:** All queries executed within repositories use strictly parameterized prepared statements (`$1, $2`), neutralizing SQL injection vectors (KB §16.1).

  ### Negative / Trade-offs
  - **Schema Migration Discipline:** Modifying table structures requires formal, version-controlled SQL DDL migration scripts rather than schemaless field insertions (KB §11.1, §11.4).
  - **Connection Pool Sizing:** High-frequency telemetry ingestion requires careful tuning of the PostgreSQL connection pool (`max` connections, idle timeouts) so concurrent requests do not exhaust database server backends.

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial decision establishing PostgreSQL, 3NF normalization, and concurrency locking strategies. |