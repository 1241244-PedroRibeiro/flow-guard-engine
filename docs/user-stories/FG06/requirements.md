# FG06 — Manage Spare-Part Inventory in Abstract Stock Units

## 1. Requirements Engineering

### 1.1. User Story Description
As an Industrial Engineer or Plant Operator, I want to register spare-part catalog items and manage their inventory in normalized non-negative integer abstract stock units ($u \in \mathbb{N}_0$), so that maintenance replacements are tracked with an audit trail and never produce negative stock balances.

### 1.2. Specifications and Architectural Clarifications
Source: `01-problem-statement.md` (§2.3), `ADR-0003`, `04-key-scenarios.md` (§5), and `08-database-structure.md` (§3.4).

- **Abstract Stock Unit Model (`AbstractStockQuantity`):** Spare parts (`SparePartStock`) are quantified in discrete non-negative integers ($u \in \mathbb{N}_0$). Fractional quantities or negative balances are strictly forbidden at both the domain Value Object level and the PostgreSQL storage boundary (`CHECK (stock_units >= 0)`).
- **Atomic Replenishment & Consumption with Audit Movements:**
  - `POST /api/v1/spare-parts/:id/replenish` (restricted to `ENGINEER` / `ADMINISTRATOR`) increases `stockUnits` by a positive integer `units` ($\ge 1$) and appends a `REPLENISHMENT` record to `spare_part_movements` with `reason` and `performedBy`.
  - `POST /api/v1/spare-parts/:id/consume` (accessible to `OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) verifies `currentUnits >= requestedUnits`. If insufficient, throws `DomainInvariantException` (`422 Unprocessable Entity`). If sufficient, deducts `units` and appends a `CONSUMPTION` movement inside an explicit ACID transaction (`withTransaction` + `SELECT ... FOR UPDATE`).

### 1.3. Acceptance Criteria
- **AC1 — Spare Part Registration:** Engineers/Admins can register a spare part (`POST /api/v1/spare-parts`) with a unique uppercase `partCode` (`PRT-BRG-6204`), `name`, and `initialStockUnits` ($\ge 0$). Duplicate `partCode` returns `409 Conflict`.
- **AC2 — Non-Negative Consumption Guard:** Deducting `units > stockUnits` via `POST /api/v1/spare-parts/:id/consume` is rejected with HTTP `422 Unprocessable Entity` and leaves the stored balance unchanged.
- **AC3 — Atomic Movement Audit Trail:** Every replenishment or consumption writes a `spare_part_movements` row (`REPLENISHMENT` or `CONSUMPTION`, `amount > 0`, `reason`, `performed_by`) within the same database transaction as the balance update.

### 1.4. Dependencies
- **Preceding Dependencies:** `FG01` (Auth/RBAC user identity).
- **Succeeding Dependencies:** `FG08` (Milestone 2 high-contention concurrency stress testing on `SELECT ... FOR UPDATE`).

### 1.5. HTTP API

| Method | Path | Access | Success | Other outcomes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/spare-parts` | `ENGINEER`, `ADMINISTRATOR` | `201 Created`, `SparePartStockResponseDTO` | `400` invalid data; `409` duplicate `partCode`; `422` negative initial stock |
| `GET` | `/api/v1/spare-parts` | `OPERATOR+` | `200 OK`, spare-part array | `401` unauthorized |
| `POST` | `/api/v1/spare-parts/:id/replenish` | `ENGINEER`, `ADMINISTRATOR` | `200 OK`, updated `SparePartStockResponseDTO` | `400` non-positive units/empty reason; `404` part missing |
| `POST` | `/api/v1/spare-parts/:id/consume` | `OPERATOR+` | `200 OK`, updated `SparePartStockResponseDTO` | `400` non-positive units; `404` part missing; `422` insufficient stock (`stockUnits < units`) |

### 1.6. System Sequence Diagrams (SSD)

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Plant Operator / Engineer
    participant Ctrl@{ "type": "boundary" } as SparePartStockController
    participant Svc@{ "type": "control" } as SparePartsStockService
    participant Domain as SparePartStock / AbstractStockQuantity
    participant Repo@{ "type": "control" } as PostgresSparePartStockRepository
    participant DB@{ "type": "database" } as PostgreSQL Database

    Operator->>Ctrl: POST /api/v1/spare-parts/:id/consume { units, reason } [Bearer JWT]
    Ctrl->>Svc: consumeStock(partId, dto, currentUser.id)
    Svc->>Repo: adjustStockWithLock(partId, "CONSUMPTION", dto.units, dto.reason, currentUser.id)
    Repo->>DB: BEGIN
    Repo->>DB: SELECT * FROM spare_part_stock WHERE id = $1 FOR UPDATE
    DB-->>Repo: Locked spare_part_stock row or empty
    break Spare part not found
        Repo->>DB: ROLLBACK
        Repo-->>Svc: throws EntityNotFoundException("SparePartStock not found")
        Ctrl-->>Operator: 404 Not Found
    end
    Repo->>Domain: sparePart.consume(AbstractStockQuantity.create(dto.units))
    break stockUnits < dto.units (Negative Balance Invariant Breach)
        Domain-->>Repo: throws DomainInvariantException("Insufficient spare-part stock units available")
        Repo->>DB: ROLLBACK
        Repo-->>Svc: propagates DomainInvariantException
        Ctrl-->>Operator: 422 Unprocessable Entity
    end
    Repo->>DB: UPDATE spare_part_stock SET stock_units = $2, updated_at = NOW() WHERE id = $1
    Repo->>DB: INSERT INTO spare_part_movements (part_id, movement_type, amount, reason, performed_by) VALUES (...)
    Repo->>DB: COMMIT
    Repo-->>Svc: Updated SparePartStock
    Svc-->>Ctrl: SparePartStockResponseDTO
    Ctrl-->>Operator: 200 OK