# Relational Mapping & Persistence Strategy: FlowGuard Back-End

## 1. Executive Summary and Scope of Document

In accordance with **ADR-0001 (Clean / Onion Architecture)**, **ADR-0002 (Node.js / TypeScript / NestJS Stack)**, and **ADR-0003 (PostgreSQL Persistence & Concurrency Control)**, this document formalizes the mapping strategy between the canonical Domain-Driven Design (DDD) model (`domain-model.puml`) and the physical relational schema in **PostgreSQL 16+** (KB §21.1).

The persistence architecture enforces four foundational engineering rules:
1. **Zero ORM Contamination in the Domain Ring:** Domain entities, aggregate roots, and value objects are written in 100% pure TypeScript with zero persistence decorators (`@Entity`, `@Column`) or driver imports (`ADR-0001`).
2. **Native Connection Pool (`pg`) & Explicit Bidirectional Data Mappers:** Repositories execute parameterized SQL statements (`$1, $2`) over a managed `pg.Pool` connection pool. Dedicated Data Mapper classes (`Pure Fabrication`, KB §4.1, §7.4) translate between encapsulated Domain Aggregates and flat relational rows via static `toDomain(row)` (`reconstitute`) and `toPersistence(aggregate)` methods.
3. **Database as a Fortress for Domain Invariants:** All structural invariants—including hierarchical deletion blocks (`ON DELETE RESTRICT`), non-negative spare-part stock balances (`CHECK (stock_units >= 0)`), and threshold ordering (`CHECK (critical_limit > warning_limit)`)—are enforced natively by the PostgreSQL engine (`ADR-0003`, KB §21.1).
4. **Evolutionary Continuity (Baseline to 20+ Hour Roadmap):** The schema supports both the implemented baseline and the scheduled 20+ hour roadmap enhancements (optimistic concurrency `version` columns, pessimistic `SELECT ... FOR UPDATE` row locks, and the `outbox_webhook_events` table for asynchronous webhook delivery).

---

## 2. Global Mapping Patterns (DDD to Relational Schema)

```text
+----------------------------------------+          +----------------------------------------+
|              DOMAIN RING               |          |          INFRASTRUCTURE RING           |
|                                        |          |                                        |
|  +----------------------------------+  |  Mapper  |  +----------------------------------+  |
|  |   Aggregate Root / Entity        |  | Contract |  |   PgRepository + DataMapper      |  |
|  | - Technical UUID (EntityId)      |  |<-------->|  | - Parameterized SQL ($1, $2)     |  |
|  | - Business Code VOs (SectorCode) |  | toDomain |  | - Reconstitutes VOs & Entities   |  |
|  | - Embedded VOs (TelemetryValue)  |  | toPersist|  | - Manages Explicit Transactions  |  |
|  +----------------------------------+  |          |  +----------------------------------+  |
+----------------------------------------+          +----------------------------------------+
                                                                        |
                                                                        v
                                                    +----------------------------------------+
                                                    |        POSTGRESQL 16+ DATABASE         |
                                                    | - 3NF / BCNF Normalized Tables         |
                                                    | - FOREIGN KEY ... ON DELETE RESTRICT   |
                                                    | - CHECK Invariant Constraints          |
                                                    | - Functional Unique Indexes (LOWER)    |
                                                    | - CQRS Read View (v_conveyor_line_...) |
                                                    +----------------------------------------+

```

### 2.1. Dual Identity Strategy: Surrogate UUID Primary Keys + Natural Business Codes

In alignment with KB §21.1:

* **Technical Surrogate Key (`id UUID PRIMARY KEY`):** Every Aggregate Root and internal Entity table uses a standard RFC 4122 UUID (`gen_random_uuid()` / Node.js `crypto.randomUUID()`) as its immutable relational Primary Key and Foreign Key target.
* **Domain Business Code (`sector_code`, `line_code`, `serial_number`, `part_code`):** Human-readable industrial identifiers encapsulated as Value Objects in the domain (`SectorCode`, `LineCode`, `SensorSerialNumber`, `PartCode`) are mapped to `VARCHAR(30–40) NOT NULL` columns protected by **case-insensitive functional unique indexes** (`CREATE UNIQUE INDEX ... ON ... (UPPER(code))`). This prevents duplicate codes differing only in casing (`line-01` vs. `LINE-01`) even under concurrent writes.

### 2.2. Value Objects Mapping (Flattening & Collection Strategies)

Value Objects have no independent lifecycle identity (KB §3.2, §13.1) and are persisted using three deterministic patterns:

1. **Single-Column Primitive Flattening:** Single-attribute Value Objects (`Email`, `PasswordHash`, `Designation`, `SectorCode`, `LineCode`, `SensorSerialNumber`, `AbstractStockQuantity`) are flattened directly into typed columns on the owning aggregate table (`email VARCHAR(255)`, `stock_units INTEGER`).
2. **Multi-Column Prefixed Flattening:** Composite Value Objects (`PersonName` containing `firstName` + `lastName`; `TelemetryValue` containing `numericValue` + `unit`) are mapped to prefixed columns inside the owning table:
* `User.name` (`PersonName`) $\rightarrow$ `first_name VARCHAR(75) NOT NULL`, `last_name VARCHAR(75) NOT NULL`.
* `ThresholdRule` (`warningLimit`, `criticalLimit`) $\rightarrow$ `warning_limit DOUBLE PRECISION NOT NULL`, `critical_limit DOUBLE PRECISION NOT NULL`, `unit VARCHAR(20) NOT NULL`.
* `TelemetryReading` (`rawValue`, `movingAverage`, `movingMedian`) $\rightarrow$ `raw_value DOUBLE PRECISION NOT NULL`, `moving_average DOUBLE PRECISION NOT NULL`, `moving_median DOUBLE PRECISION NOT NULL`, `unit VARCHAR(20) NOT NULL`.


3. **Owned Dependent Tables (`ON DELETE CASCADE`):** Multi-valued collections owned strictly inside an Aggregate Root boundary—specifically `User.roles: Set<UserRole>`—are stored in a dependent junction table (`user_roles`) with a composite primary key `(user_id, role)` and `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` (KB §3.2 Rule 4).

### 2.3. Cross-Aggregate References by Identifier Only

Strictly adhering to DDD aggregate rules (KB §3.2, §21.1):

* Aggregates never embed object references to other Aggregate Roots in memory, nor do repositories execute automatic eager ORM graph loads across aggregate boundaries.
* Cross-aggregate links (`ConveyorLine` $\rightarrow$ `PlantSector`; `SensorNode` $\rightarrow$ `ConveyorLine`; `AnomalyAlert` $\rightarrow$ `SensorNode`, `ConveyorLine`, `User`) store only the target UUID identifier (`sector_id`, `line_id`, `sensor_id`, `acknowledged_by`) backed by `FOREIGN KEY ... ON DELETE RESTRICT`.

---

## 3. Physical DDL Mapping by Bounded Module

### 3.1. Identity & Access Module (`users`, `user_roles`)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(75) NOT NULL,
    last_name VARCHAR(75) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_users_status CHECK (
        status IN ('ACTIVE', 'DEACTIVATED', 'PENDING_REGISTRATION')
    )
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));

CREATE TABLE user_roles (
    user_id UUID NOT NULL,
    role VARCHAR(30) NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_roles_valid CHECK (
        role IN ('OPERATOR', 'ENGINEER', 'ADMINISTRATOR')
    )
);

```

### 3.2. Plant Topology Module (`plant_sectors`, `conveyor_lines`)

```sql
CREATE TABLE plant_sectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uq_plant_sectors_code_upper ON plant_sectors (UPPER(sector_code));

CREATE TABLE conveyor_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id UUID NOT NULL,
    line_code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    operational_status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_conveyor_lines_sector FOREIGN KEY (sector_id)
        REFERENCES plant_sectors(id) ON DELETE RESTRICT,
    CONSTRAINT chk_conveyor_lines_status CHECK (
        operational_status IN ('RUNNING', 'DEGRADED_WARNING', 'FAULT_HALTED', 'MAINTENANCE', 'DEACTIVATED')
    ),
    CONSTRAINT chk_conveyor_lines_active_consistency CHECK (
        (is_active = FALSE AND operational_status = 'DEACTIVATED') OR
        (is_active = TRUE AND operational_status <> 'DEACTIVATED')
    ),
    CONSTRAINT chk_conveyor_lines_version_positive CHECK (version >= 1)
);

CREATE UNIQUE INDEX uq_conveyor_lines_code_upper ON conveyor_lines (UPPER(line_code));

```

### 3.3. Sensor & Telemetry Module (`sensor_nodes`, `threshold_rules`, `telemetry_readings`)

```sql
CREATE TABLE sensor_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID NOT NULL,
    serial_number VARCHAR(40) NOT NULL,
    sensor_type VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_calibrated_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sensor_nodes_line FOREIGN KEY (line_id)
        REFERENCES conveyor_lines(id) ON DELETE RESTRICT,
    CONSTRAINT chk_sensor_nodes_type CHECK (
        sensor_type IN ('BELT_VELOCITY', 'MOTOR_VIBRATION', 'BEARING_TEMPERATURE', 'OPTICAL_COUNTER')
    )
);

CREATE UNIQUE INDEX uq_sensor_nodes_serial_upper ON sensor_nodes (UPPER(serial_number));

CREATE TABLE threshold_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL,
    warning_limit DOUBLE PRECISION NOT NULL,
    critical_limit DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL,
    window_size_samples INTEGER NOT NULL DEFAULT 32,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_threshold_rules_sensor UNIQUE (sensor_id),
    CONSTRAINT fk_threshold_rules_sensor FOREIGN KEY (sensor_id)
        REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    CONSTRAINT chk_threshold_rules_bounds CHECK (critical_limit > warning_limit),
    CONSTRAINT chk_threshold_rules_window_size CHECK (window_size_samples BETWEEN 3 AND 128)
);

CREATE TABLE telemetry_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL,
    raw_value DOUBLE PRECISION NOT NULL,
    moving_average DOUBLE PRECISION NOT NULL,
    moving_median DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL,
    window_sample_count INTEGER NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_telemetry_readings_sensor FOREIGN KEY (sensor_id)
        REFERENCES sensor_nodes(id) ON DELETE RESTRICT,
    CONSTRAINT chk_telemetry_window_count CHECK (window_sample_count >= 1)
);

```

### 3.4. Anomaly Alerting & Spare Parts Inventory Modules (`anomaly_alerts`, `spare_part_stock`, `spare_part_movements`, `outbox_webhook_events`)

```sql
CREATE TABLE anomaly_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL,
    line_id UUID NOT NULL,
    reading_id UUID NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    message TEXT NOT NULL,
    diagnostic_note TEXT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMPTZ NULL,
    acknowledged_by UUID NULL,
    resolved_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_alerts_sensor FOREIGN KEY (sensor_id)
        REFERENCES sensor_nodes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_alerts_line FOREIGN KEY (line_id)
        REFERENCES conveyor_lines(id) ON DELETE RESTRICT,
    CONSTRAINT fk_alerts_reading FOREIGN KEY (reading_id)
        REFERENCES telemetry_readings(id) ON DELETE SET NULL,
    CONSTRAINT fk_alerts_ack_user FOREIGN KEY (acknowledged_by)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_alerts_severity CHECK (severity IN ('WARNING', 'CRITICAL')),
    CONSTRAINT chk_alerts_status CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    CONSTRAINT chk_alerts_ack_consistency CHECK (
        (status = 'OPEN' AND acknowledged_at IS NULL AND acknowledged_by IS NULL) OR
        (status IN ('ACKNOWLEDGED', 'RESOLVED') AND acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL)
    )
);

CREATE TABLE spare_part_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    stock_units INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_spare_part_stock_non_negative CHECK (stock_units >= 0)
);

CREATE UNIQUE INDEX uq_spare_part_code_upper ON spare_part_stock (UPPER(part_code));

CREATE TABLE spare_part_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id UUID NOT NULL,
    movement_type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    performed_by UUID NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_part_movements_part FOREIGN KEY (part_id)
        REFERENCES spare_part_stock(id) ON DELETE RESTRICT,
    CONSTRAINT fk_part_movements_user FOREIGN KEY (performed_by)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_part_movements_type CHECK (movement_type IN ('REPLENISHMENT', 'CONSUMPTION')),
    CONSTRAINT chk_part_movements_amount_positive CHECK (amount > 0)
);

-- Transactional Outbox Table for Asynchronous Alert Webhooks (Roadmap Task 3, KB §17.2)
CREATE TABLE outbox_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_outbox_alert FOREIGN KEY (alert_id)
        REFERENCES anomaly_alerts(id) ON DELETE CASCADE,
    CONSTRAINT chk_outbox_status CHECK (delivery_status IN ('PENDING', 'DISPATCHED', 'FAILED'))
);

```

---

## 4. Concurrency Control, Transaction Demarcation & Reproducible Seeding

### 4.1. Atomic Multi-Table Transactions & Locking Protocols (`ADR-0003`)

All multi-statement mutations execute inside explicit `BEGIN ... COMMIT / ROLLBACK` blocks using a dedicated `PoolClient` acquired from `pg.Pool`:

1. **Telemetry Breach & Alert Creation (`TelemetryIngestionService`):**
* Inserts the enriched `telemetry_readings` row.
* If a threshold breach occurred, inserts the `anomaly_alerts` row, inserts the `outbox_webhook_events` JSONB record (Roadmap Task 3), and updates `conveyor_lines.operational_status` within the **exact same ACID transaction**. If any step fails, the entire transaction rolls back.


2. **Pessimistic Row-Level Locking on Spare Parts (`SparePartsStockService` — Roadmap Task 2):**
* Executes `SELECT id, part_code, name, stock_units FROM spare_part_stock WHERE id = $1 FOR UPDATE`.
* Evaluates `SparePartStock.consume(quantity)` in the domain model.
* Updates `stock_units = $2` and inserts the `spare_part_movements` audit record before issuing `COMMIT`.


3. **Optimistic Concurrency Control on Conveyor Lines (`PlantTopologyService` — Roadmap Task 2):**
* Executes `UPDATE conveyor_lines SET operational_status = $1, is_active = $2, version = version + 1, updated_at = NOW() WHERE id = $3 AND version = $4`.
* If `rowCount === 0` (while the line ID exists), throws `OptimisticConcurrencyConflictException`, mapped to HTTP `409 Conflict`.



### 4.2. Reproducible Seed Script (`003_seed_industrial_baseline.sql`)

To ensure deterministic local startups and repeatable Bruno/Supertest runs, seed migrations execute in strict foreign-key dependency order:

1. **Identity Seeds:** 1 `ADMINISTRATOR` (`admin@flowguard.industrial`), 1 `ENGINEER` (`eng.ribeiro@flowguard.industrial`), and 1 `OPERATOR` (`op.silva@flowguard.industrial`) with pre-computed `Argon2id` password hashes.
2. **Plant Topology Seeds:** 2 Plant Sectors (`SEC-LOGISTICS-A`, `SEC-PACKAGING-B`) and 3 Conveyor Lines (`LINE-SORT-NORTH-01`, `LINE-SORT-SOUTH-02`, `LINE-PACK-MAIN-01`).
3. **Sensor & Threshold Seeds:** 4 calibrated `SensorNode` transducers (`MOTOR_VIBRATION`, `BELT_VELOCITY`, `BEARING_TEMPERATURE`, `OPTICAL_COUNTER`) with attached `ThresholdRule` limits.
4. **Spare Parts Inventory Seeds:** 3 standard replacement parts (`PRT-BRG-6204`, `PRT-BELT-MOD-10`, `PRT-OPT-LENS-02`) with initial positive integer balances.