# FG03 — Register Sensor Nodes and Configure Threshold Rules

## 1. Requirements Engineering

### 1.1. User Story Description
As an Industrial Engineer, I want to register Sensor Nodes on Conveyor Lines and configure their Warning and Critical Threshold Rules, so that each industrial transducer has validated physical tolerance bounds for real-time anomaly detection.

### 1.2. Specifications and Architectural Clarifications
Source: `01-problem-statement.md` (§2.1), `ADR-0003`, `ADR-0004`, and `08-database-structure.md` (§3.3).

- **Transducer Classification (`SensorType`):** Each `SensorNode` is mounted on an existing `ConveyorLine` (`lineId`), identified by a globally unique `serialNumber` (`SN-VIB-9001`), and typed as one of `{BELT_VELOCITY, MOTOR_VIBRATION, BEARING_TEMPERATURE, OPTICAL_COUNTER}`.
- **Owned Threshold Rule Entity (`ThresholdRule`):** Each `SensorNode` owns at most one active `ThresholdRule` defining `warningLimit`, `criticalLimit`, measurement `unit` (`m/s`, `mm/s`, `C`, `units/min`), and `windowSizeSamples` ($3 \le N \le 128$, default $32$).
- **Threshold Ordering Invariant:** Both the domain entity (`ThresholdRule.create` / `updateLimits`) and the PostgreSQL `CHECK` constraint (`chk_threshold_rules_bounds`) enforce:
  $$\text{criticalLimit} > \text{warningLimit}$$
  Violating this rule returns HTTP `422 Unprocessable Entity`.
- **Soft Deactivation:** Sensors undergoing replacement or maintenance are soft-deactivated via `PATCH /api/v1/sensor-nodes/:id/deactivate` (`isActive = false`), preserving historical `telemetry_readings` and `anomaly_alerts` (`ON DELETE RESTRICT`).

### 1.3. Acceptance Criteria
- **AC1 — Sensor Registration:** Engineers/Admins can attach a new `SensorNode` to an existing `ConveyorLine` (`POST /api/v1/sensor-nodes`). Duplicate `serialNumber` (case-insensitive) returns `409 Conflict`; non-existent `lineId` returns `404 Not Found`.
- **AC2 — Threshold Rule Upsert & Invariant Validation:** Engineers/Admins can configure or replace a sensor's `ThresholdRule` via `PUT /api/v1/sensor-nodes/:id/threshold-rule`. If `criticalLimit <= warningLimit` or `windowSizeSamples` is outside `[3, 128]`, the system rejects the request with `422 Unprocessable Entity`.
- **AC3 — Multi-Criteria Filtering:** Operators, Engineers, and Admins can list sensors (`GET /api/v1/sensor-nodes`) filtered by `lineId`, `sensorType`, and `isActive`, including each sensor's attached `thresholdRule`.
- **AC4 — Safe Deactivation:** `PATCH /api/v1/sensor-nodes/:id/deactivate` marks the sensor inactive (`200 OK`) so it rejects new telemetry readings while retaining historical audit logs.

### 1.4. Dependencies
- **Preceding Dependencies:** `FG01` (Auth/RBAC), `FG02` (`ConveyorLine` must exist before attaching a `SensorNode`).
- **Succeeding Dependencies:** `FG04` (`TelemetryIngestionService` evaluates incoming readings against `SensorNode` and `ThresholdRule`).

### 1.5. Input and Output Data

| Field | Contract |
| --- | --- |
| `lineId` | Required UUID on `POST /sensor-nodes`; references `conveyor_lines(id)` |
| `serialNumber` | Required string, trimmed & uppercase, 3–40 chars, unique (`uq_sensor_nodes_serial_upper`) |
| `sensorType` | `BELT_VELOCITY \| MOTOR_VIBRATION \| BEARING_TEMPERATURE \| OPTICAL_COUNTER` |
| `warningLimit` / `criticalLimit` | Required finite numbers on `PUT .../threshold-rule`; must satisfy `criticalLimit > warningLimit` |
| `unit` | Required non-empty string (`mm/s`, `m/s`, `C`, `units/min`), max 20 chars |
| `windowSizeSamples` | Integer in `[3, 128]`, defaults to `32` |

### 1.6. HTTP API

| Method | Path | Access | Success | Other outcomes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/sensor-nodes` | `ENGINEER`, `ADMINISTRATOR` | `201 Created`, `SensorNodeResponseDTO` | `400` invalid data; `404` line missing; `409` duplicate `serialNumber` |
| `GET` | `/api/v1/sensor-nodes?lineId=...&sensorType=...&isActive=...` | `OPERATOR+` | `200 OK`, sensor array | `400` invalid filter; `401` unauthorized |
| `PUT` | `/api/v1/sensor-nodes/:id/threshold-rule` | `ENGINEER`, `ADMINISTRATOR` | `200 OK`, `ThresholdRuleResponseDTO` | `400` invalid types; `404` sensor missing; `422` `criticalLimit <= warningLimit` |
| `PATCH` | `/api/v1/sensor-nodes/:id/deactivate` | `ENGINEER`, `ADMINISTRATOR` | `200 OK`, `SensorNodeResponseDTO` | `400` malformed UUID; `404` sensor missing |

### 1.7. System Sequence Diagrams (SSD)

#### 1.7.1. Configure Sensor Threshold Rule (`PUT /api/v1/sensor-nodes/:id/threshold-rule`)

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as Industrial Engineer
    participant Ctrl@{ "type": "boundary" } as SensorNodeController
    participant Svc@{ "type": "control" } as SensorManagementService
    participant Domain as ThresholdRule
    participant Repo@{ "type": "control" } as ISensorTelemetryRepository
    participant DB@{ "type": "database" } as PostgreSQL Database

    Engineer->>Ctrl: PUT /api/v1/sensor-nodes/:id/threshold-rule { warningLimit, criticalLimit, unit, windowSizeSamples }
    Ctrl->>Svc: upsertThresholdRule(sensorId, dto)
    Svc->>Repo: findSensorById(sensorId)
    Repo->>DB: SELECT * FROM sensor_nodes WHERE id = $1
    DB-->>Repo: Sensor row or empty
    break Sensor not found
        Svc-->>Ctrl: throws EntityNotFoundException("SensorNode not found")
        Ctrl-->>Engineer: 404 Not Found
    end
    Svc->>Domain: ThresholdRule.create({ sensorId, warningLimit, criticalLimit, unit, windowSizeSamples })
    break criticalLimit <= warningLimit or windowSizeSamples not in [3..128]
        Domain-->>Svc: throws DomainInvariantException("criticalLimit must be strictly greater than warningLimit")
        Svc-->>Ctrl: propagates DomainInvariantException
        Ctrl-->>Engineer: 422 Unprocessable Entity
    end
    Svc->>Repo: saveThresholdRule(rule)
    Repo->>DB: INSERT INTO threshold_rules ... ON CONFLICT (sensor_id) DO UPDATE ...
    DB-->>Repo: Persisted rule row
    Repo-->>Svc: ThresholdRule
    Svc-->>Ctrl: ThresholdRuleResponseDTO
    Ctrl-->>Engineer: 200 OK
```


#### 1.7.2. Sensor Registration and Limiar Configuration Successful

```mermaid
sequenceDiagram
    autonumber
    participant Engineer as Industrial Engineer (ENGINEER)
    participant API as Public API (Guards + Joi Pipe)
    participant Ctrl as SensorNodeController
    participant Svc as SensorManagementService
    participant Repo as ISensorTelemetryRepository
    participant DB as PostgreSQL Database

    rect rgb(230, 245, 230)
        Note right of Engineer: Cenário A: Registo de Sensor e Regra de Limiar (201 Created / 200 OK)
        Engineer->>API: POST /api/v1/sensor-nodes { lineId, serialNumber: "SN-VIB-9001", sensorType: "MOTOR_VIBRATION" } [Bearer JWT]
        API->>API: JwtAuthGuard & RolesGuard (Verifica role ENGINEER)
        API->>Ctrl: createSensorNode(dto)
        Ctrl->>Svc: registerSensor(dto)
        Svc->>Repo: findLineById(lineId)
        DB-->>Repo: ConveyorLine exists
        Svc->>Repo: saveSensor(sensor)
        Repo->>DB: INSERT INTO sensor_nodes (line_id, serial_number, sensor_type) VALUES ($1, $2, $3)
        DB-->>Repo: OK
        Repo-->>Svc: SensorNode Aggregate
        Svc-->>Ctrl: SensorNodeResponseDTO
        Ctrl-->>Engineer: 201 Created

        Engineer->>API: PUT /api/v1/sensor-nodes/{id}/threshold-rule { warningLimit: 4.5, criticalLimit: 7.1, unit: "mm/s" }
        API->>Ctrl: upsertThresholdRule(id, dto)
        Ctrl->>Svc: configureThreshold(sensorId, dto)
        Svc->>Svc: ThresholdRule.create({ warningLimit: 4.5, criticalLimit: 7.1 }) [7.1 > 4.5: Válido]
        Svc->>Repo: saveThresholdRule(rule)
        Repo->>DB: INSERT INTO threshold_rules ... ON CONFLICT (sensor_id) DO UPDATE ...
        DB-->>Repo: OK
        Repo-->>Svc: ThresholdRule Entity
        Svc-->>Ctrl: ThresholdRuleResponseDTO
        Ctrl-->>Engineer: 200 OK
    end
```

#### 1.7.3. criticalLimit > warningLimit violation
```mermaid
sequenceDiagram
    autonumber
    participant Engineer as Industrial Engineer (ENGINEER)
    participant API as Public API (Guards)
    participant Ctrl as SensorNodeController
    participant Svc as SensorManagementService
    participant Domain as ThresholdRule Value Object
    participant DB as PostgreSQL Database

    rect rgb(255, 230, 230)
        Note right of Engineer: Cenário B: Tentativa de Configurar Limiar Inválido (422 Unprocessable Entity)
        Engineer->>API: PUT /api/v1/sensor-nodes/{id}/threshold-rule { warningLimit: 8.0, criticalLimit: 6.0, unit: "mm/s" } [Bearer JWT]
        API->>Ctrl: upsertThresholdRule(id, dto)
        Ctrl->>Svc: configureThreshold(sensorId, dto)
        Svc->>Repo: findSensorById(sensorId)
        DB-->>Repo: Sensor found
        Svc->>Domain: ThresholdRule.create({ warningLimit: 8.0, criticalLimit: 6.0 })
        Note over Domain: Invariante violado: criticalLimit (6.0) não é estritamente superior a warningLimit (8.0).
        Domain-->>Svc: throws DomainInvariantException("criticalLimit must be strictly greater than warningLimit")
        Svc-->>Ctrl: propagates DomainInvariantException
        Ctrl->>API: Map to 422 Unprocessable Entity
        API-->>Engineer: 422 Unprocessable Entity { error: "Unprocessable Entity", message: "criticalLimit must be strictly greater than warningLimit" }
    end
```

#### 1.7.4. Soft Deactivation

```mermaid
sequenceDiagram
    autonumber
    participant Engineer as Industrial Engineer (ENGINEER)
    participant API as Public API (Guards)
    participant Ctrl as SensorNodeController
    participant Svc as SensorManagementService
    participant Repo as ISensorTelemetryRepository
    participant DB as PostgreSQL Database

    rect rgb(230, 240, 255)
        Note right of Engineer: Cenário C: Soft Deactivation de Sensor Node para Manutenção (200 OK)
        Engineer->>API: PATCH /api/v1/sensor-nodes/{id}/deactivate [Bearer JWT]
        API->>Ctrl: deactivateSensor(id)
        Ctrl->>Svc: deactivateSensorNode(id)
        Svc->>Repo: findSensorById(id)
        DB-->>Repo: Sensor row found (isActive: true)
        Repo-->>Svc: SensorNode Aggregate
        Svc->>Svc: sensor.deactivate() (isActive = false)
        Svc->>Repo: saveSensor(sensor)
        Repo->>DB: UPDATE sensor_nodes SET is_active = FALSE, updated_at = NOW() WHERE id = $1
        DB-->>Repo: OK (1 row updated)
        Repo-->>Svc: Updated SensorNode
        Svc-->>Ctrl: SensorNodeResponseDTO (isActive: false)
        Ctrl-->>Engineer: 200 OK + Updated Sensor DTO
    end
```