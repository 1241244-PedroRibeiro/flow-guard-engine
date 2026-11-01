# FG08 — Enforce Optimistic Version Locking & Pessimistic Row-Level Concurrency (Milestone 2 — 5.0h)

## 1. Requirements Engineering

### 1.1. User Story Description
As an Industrial Engineer or Plant Operator, I want concurrent conveyor line status mutations and threshold updates to enforce Optimistic Concurrency Control (`version`) and spare-part deductions to enforce Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`), so that simultaneous operations never cause lost updates or negative inventory balances.

### 1.2. Acceptance Criteria
- **AC1 — Optimistic Version Check on Conveyor Lines & Threshold Rules:** `PATCH /api/v1/conveyor-lines/:id/operational-status` requires `expectedVersion`. The SQL update executes `UPDATE conveyor_lines SET ..., version = version + 1 WHERE id = $1 AND version = $2`. If `rowCount === 0` while the line exists, the service throws `OptimisticConcurrencyConflictException`, returning HTTP `409 Conflict`.
- **AC2 — Serialized Pessimistic Row Locking on Stock Deductions:** Concurrent `POST /api/v1/spare-parts/:id/consume` calls acquire row-level locks via `SELECT ... FOR UPDATE` inside `withTransaction()`. Parallel requests attempting to consume the last available units are serialized so exactly one succeeds (`200 OK`) and the other receives `422 Unprocessable Entity`.