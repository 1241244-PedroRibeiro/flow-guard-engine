# Domain Model Analysis & Architectural Rationale: FlowGuard

## 1. Domain Modeling Approach and Scope
In accordance with Domain-Driven Design (DDD) principles and our architectural guidelines (KB §3), this document formalizes the canonical Domain Model for the **FlowGuard** Industrial Line & Conveyor Telemetry Engine. The analytical scope established during the architecture phase encompasses the core telemetry ingestion pipeline, asset topologies, anomaly alerting mechanisms, and spare-part inventory boundaries.

The domain model serves as a conceptual blueprint, capturing core business entities, value objects, domain rules, and aggregate consistency boundaries while strictly decoupling pure business invariants from persistence, presentation, or transport mechanisms (KB §3.1, §3.2).

---

## 2. Aggregate Decomposition and Consistency Boundaries
The FlowGuard domain is organized into 5 business aggregates and one supporting Shared Kernel, adhering strictly to the DDD invariant rule: *an aggregate defines a boundary within which business invariants are maintained in a fully consistent (ACID) state, and external entities may only reference the Aggregate Root via its globally unique business identifier* (KB §3.2).

| Aggregate | Aggregate Root | Business Responsibility & Scope |
| --- | --- | --- |
| **Identity & Access Aggregate** | `User` | User credentials, personal name (`PersonName`), lifecycle status (`ACTIVE`, `DEACTIVATED`, `PENDING_REGISTRATION`), and Role-Based Access Control (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) (`02-context.md`, §3). |
| **Plant Topology Aggregate** | `PlantSector`, `ConveyorLine` | Hierarchical industrial asset management representing physical plant sectors, production segments, and conveyor belt topologies (`01-problem-statement.md`, §2.2). |
| **Sensor & Telemetry Aggregate** | `SensorNode`, `ThresholdRule` | Heterogeneous sensor nodes (velocity, vibration, temperature, optical counters), calibration metadata, and sliding-window threshold bounds (`01-problem-statement.md`, §2.1). |
| **Anomaly & Alerting Aggregate** | `AnomalyAlert` | Real-time threshold breaches, anomaly states, automated alerting lifecycles, and conveyor line operational state transitions (`01-problem-statement.md`, §2.1). |
| **Spare Parts Inventory Aggregate** | `SparePartStock` | Normalized abstract stock units ($u \in \mathbb{N}_0$) for replacement components and maintenance tracking (`01-problem-statement.md`, §2.3). |

---

## 3. Evolutionary Traceability & Domain Decisions Log

This section documents the evolution of the domain model, recording key architectural decisions and domain invariants established for the FlowGuard engine.

### Decision Log 1: User Roles and Staff Onboarding Lifecycle (`ADR-0005`)
* **Context:** The system requires distinct operational permissions for plant floor operators, maintenance engineers, and system administrators (`02-context.md`, §3). Public registration must remain restricted, while staff onboarding must follow a secure invitation flow.
* **Model Rationale:** 
  - The `UserRole` enumeration defines `{OPERATOR, ENGINEER, ADMINISTRATOR}`.
  - The `UserStatus` enumeration defines `{ACTIVE, DEACTIVATED, PENDING_REGISTRATION}`. Public self-registration provisions standard `OPERATOR` accounts with `PENDING_REGISTRATION` state until completed by an administrator.

### Decision Log 2: Hierarchical Referential Integrity on Asset Deletion (`ADR-0003`)
* **Context:** Industrial plant topologies form strict parent-child hierarchies (`PlantSector` $\rightarrow$ `ConveyorLine` $\rightarrow$ `SensorNode`). Accidental deletion of active parent assets would corrupt telemetry audit trails (`01-problem-statement.md`, §2.2).
* **Model Rationale:**
  - Enforced via relational foreign keys with **`ON DELETE RESTRICT`** constraints. Decommissioning assets must be handled via soft deactivation (`is_active = FALSE`) rather than physical deletion.

### Decision Log 3: In-Memory Sliding-Window Telemetry Pipeline (`ADR-0004`)
* **Context:** Raw sensor streams arrive at high frequency. Evaluating historical database queries for moving averages and moving medians on every ingestion request would saturate disk I/O and CPU (`01-problem-statement.md`, §2.1).
* **Model Rationale:**
  - Encapsulated within the `TelemetryEvaluationEngine` domain service, maintaining bounded in-memory circular ring buffers per active sensor to compute sliding-window statistics in microseconds.

### Decision Log 4: Non-Negative Abstract Stock Units (`01-problem-statement.md`, §2.3)
* **Context:** Spare parts and maintenance inventory must be tracked without complex unit conversion overhead.
* **Model Rationale:**
  - Modeled using the `AbstractStockQuantity` Value Object, backed by domain preconditions and PostgreSQL `CHECK (stock_units >= 0)` constraints to prevent negative inventory balances.

---

## 4. Referential Integrity and Deletion Invariants (`ARC04`)
To satisfy database-level and domain-level integrity rules, deletion operations enforce strict consistency constraints:
* **Referential Guards:** Master assets (`PlantSector`, `ConveyorLine`) cannot be removed if active child sensors or historical telemetry records exist. Repository queries enforce dependency checks before deletion, returning `409 Conflict` on violations (KB §9.3).
* **Soft Lifecycle Deactivation:** Assets no longer operational are marked inactive via domain methods (`ConveyorLine.deactivate()`) rather than physically removed, preserving historical telemetry correlation.