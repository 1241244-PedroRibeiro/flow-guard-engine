# FG05 — Inspect, Acknowledge, and Resolve Anomaly Alerts

## 1. Requirements Engineering

### 1.1. User Story Description
As a Plant Operator or Industrial Engineer, I want to inspect, filter, acknowledge, and resolve Anomaly Alerts with diagnostic notes, so that floor incidents follow a traceable, auditable operational state machine.

### 1.2. Specifications and Architectural Clarifications
Source: `01-problem-statement.md` (§2.1), `ADR-0006`, `08-architecture-summary.md` (§2.5), and `08-database-structure.md` (§3.4).

- **Deterministic Alert State Machine (`AlertStatus`):**
  - Alerts are created in `OPEN` status when `TelemetryEvaluationEngine` detects a threshold breach (`FG04`).
  - **Operator Acknowledgement (`OPEN` $\rightarrow$ `ACKNOWLEDGED`):** Any authenticated `OPERATOR`, `ENGINEER`, or `ADMINISTRATOR` can execute `POST /api/v1/anomaly-alerts/:id/acknowledge` with a mandatory `diagnosticNote` (3–500 chars). The system records `acknowledgedBy` (from the authenticated JWT `@CurrentUser`) and `acknowledgedAt` (UTC timestamp). Attempting to acknowledge an already `ACKNOWLEDGED` or `RESOLVED` alert returns `409 Conflict`.
  - **Engineering Resolution (`ACKNOWLEDGED` $\rightarrow$ `RESOLVED`):** Only an `ENGINEER` or `ADMINISTRATOR` can execute `POST /api/v1/anomaly-alerts/:id/resolve`. An alert **must** be in `ACKNOWLEDGED` status before it can transition to `RESOLVED`; attempting to resolve an `OPEN` or already `RESOLVED` alert returns `409 Conflict`.
- **Database Consistency Check (`chk_alerts_ack_consistency`):** PostgreSQL enforces that `OPEN` alerts have `NULL` acknowledgement fields, while `ACKNOWLEDGED` and `RESOLVED` alerts have `NOT NULL` `acknowledged_by` and `acknowledged_at`.

### 1.3. Acceptance Criteria
- **AC1 — Paginated & Filtered Alert Querying:** `GET /api/v1/anomaly-alerts` supports filtering by `status` (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`), `severity` (`WARNING`, `CRITICAL`), and `lineId`, ordered by `triggered_at DESC`.
- **AC2 — Intentional Acknowledgement Command:** `POST /api/v1/anomaly-alerts/:id/acknowledge` transitions an `OPEN` alert to `ACKNOWLEDGED`, binding the caller's `UserId` and `diagnosticNote` (`200 OK`).
- **AC3 — Intentional Resolution Command:** `POST /api/v1/anomaly-alerts/:id/resolve` (restricted to `ENGINEER` / `ADMINISTRATOR`) transitions an `ACKNOWLEDGED` alert to `RESOLVED` and sets `resolvedAt` (`200 OK`).
- **AC4 — State Machine Conflict Protection:** Invalid state transitions (`OPEN` $\rightarrow$ `RESOLVED`, or mutating a `RESOLVED` alert) return `409 Conflict`.

### 1.4. Dependencies
- **Preceding Dependencies:** `FG01` (Auth/RBAC identity for `acknowledgedBy`), `FG04` (Generates `AnomalyAlert` records).
- **Succeeding Dependencies:** `FG09` (Milestone 3 Transactional Outbox webhook dispatch), `FG11` (Milestone 5 active alert gauges).

### 1.5. HTTP API

| Method | Path | Access | Success | Other outcomes |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/anomaly-alerts?status=...&severity=...&lineId=...&page=1&pageSize=20` | `OPERATOR+` | `200 OK`, paginated alerts | `400` invalid filter; `401` unauthorized |
| `POST` | `/api/v1/anomaly-alerts/:id/acknowledge` | `OPERATOR+` | `200 OK`, `AnomalyAlertResponseDTO` | `400` missing `diagnosticNote`; `401`; `404` missing alert; `409` not `OPEN` |
| `POST` | `/api/v1/anomaly-alerts/:id/resolve` | `ENGINEER`, `ADMINISTRATOR` | `200 OK`, `AnomalyAlertResponseDTO` | `401`/`403` role denied; `404` missing alert; `409` not `ACKNOWLEDGED` |

### 1.6. System Sequence Diagrams (SSD)

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Plant Operator
    actor Engineer as Industrial Engineer
    participant Ctrl@{ "type": "boundary" } as AnomalyAlertController
    participant Svc@{ "type": "control" } as AnomalyAlertService
    participant Domain as AnomalyAlert
    participant Repo@{ "type": "control" } as IAnomalyAlertRepository
    participant DB@{ "type": "database" } as PostgreSQL Database

    Operator->>Ctrl: POST /api/v1/anomaly-alerts/:id/acknowledge { diagnosticNote } [Bearer JWT]
    Ctrl->>Svc: acknowledgeAlert(alertId, currentUser.id, dto.diagnosticNote)
    Svc->>Repo: findById(alertId)
    Repo->>DB: SELECT * FROM anomaly_alerts WHERE id = $1
    DB-->>Repo: Alert row or empty
    break Alert not found
        Svc-->>Ctrl: throws EntityNotFoundException("AnomalyAlert not found")
        Ctrl-->>Operator: 404 Not Found
    end
    Svc->>Domain: alert.acknowledge(currentUser.id, diagnosticNote)
    break Alert status is not OPEN
        Domain-->>Svc: throws ResourceConflictException("Only OPEN alerts can be acknowledged")
        Svc-->>Ctrl: propagates ResourceConflictException
        Ctrl-->>Operator: 409 Conflict
    end
    Svc->>Repo: save(alert)
    Repo->>DB: UPDATE anomaly_alerts SET status = 'ACKNOWLEDGED', acknowledged_by = $2, acknowledged_at = $3, diagnostic_note = $4 WHERE id = $1
    DB-->>Repo: OK
    Svc-->>Ctrl: AnomalyAlertResponseDTO
    Ctrl-->>Operator: 200 OK

    Engineer->>Ctrl: POST /api/v1/anomaly-alerts/:id/resolve [Bearer JWT (ENGINEER)]
    Ctrl->>Svc: resolveAlert(alertId)
    Svc->>Repo: findById(alertId)
    Svc->>Domain: alert.resolve()
    break Alert status is not ACKNOWLEDGED
        Domain-->>Svc: throws ResourceConflictException("Alert must be ACKNOWLEDGED before resolution")
        Ctrl-->>Engineer: 409 Conflict
    end
    Svc->>Repo: save(alert)
    Repo->>DB: UPDATE anomaly_alerts SET status = 'RESOLVED', resolved_at = $2 WHERE id = $1
    Svc-->>Ctrl: AnomalyAlertResponseDTO
    Ctrl-->>Engineer: 200 OK