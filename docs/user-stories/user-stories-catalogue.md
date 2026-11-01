# FlowGuard — User Stories & Functional Catalogue (Stage 1 Baseline vs. Stage 2 AI Roadmap)

## 1. Executive Overview & Stage Allocation

In accordance with Requirements Engineering best practices (Master KB §2.1, §18.1) and the architectural vision of **FlowGuard** (`01-problem-statement.md`, `ROADMAP.md`), this catalogue formalizes all Engineering (`ENG`), Architectural (`ARC`), and Functional (`FG`) User Stories across the project's two development stages:

* **Stage 1 — Foundational Baseline (Sprint 1 / Pre-Submission State):** Establishes project governance, Clean/Onion Modular Monolith architecture, PostgreSQL 16 3NF persistence with `ON DELETE RESTRICT` guards, stateless JWT + `Argon2id` authentication, plant topology management, sensor & threshold configuration, real-time sliding-window moving-average ($\mu_W$) telemetry ingestion, anomaly alert lifecycle, and abstract spare-part inventory control (`FG01`–`FG06`).
* **Stage 2 — AI-Assisted Advanced Evolution (Sprint 2 / 28-Hour Roadmap):** Expands the baseline engine over 28 planned engineering hours across 5 advanced milestones: high-frequency dual-heap Moving Median ($\tilde{x}_W$) & IQR outlier filtering (`FG07`), high-contention Optimistic (`version`) & Pessimistic (`SELECT ... FOR UPDATE`) locking (`FG08`), Transactional Outbox asynchronous webhook alert dispatching (`FG09`), exhaustive Joi boundary pipes & chained Bruno CLI black-box suites (`FG10`), and OpenMetrics / Prometheus telemetry scraping (`FG11`).

---

## 2. Master User Story Catalogue & Stage Matrix

### 2.1. Engineering & Architectural Foundation Stories (Stage 1 — Completed)

| Story ID | Category | Title / Summary | Stage / Sprint | Key Artifacts & Deliverables | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **`ENG01`** | Engineering | Repository Setup, MIT License, Branching & Conventional Commits | **Stage 1 (Baseline)** | `README.md`, `LICENSE`, `.gitignore`, Git history | **Done** |
| **`ENG02`** | Engineering | Reproducible Docker Compose Environment & Makefile Orchestration | **Stage 1 (Baseline)** | `docker-compose.yml`, `Makefile`, `backend/Dockerfile` | **Done** |
| **`ENG03`** | Engineering | Automated CI Pipeline (GitHub Actions: Build, Typecheck, Jest) | **Stage 1 (Baseline)** | `.github/workflows/ci.yml`, `ADR-0008` | **Done** |
| **`ARC01`** | Architecture | DDD Core Domain Analysis, Ubiquitous Language & Rationale | **Stage 1 (Baseline)** | `dm.puml`, `domain-model-sketch.md`, `glossary.md` | **Done** |
| **`ARC02`** | Architecture | Software Architecture Document (SAD), C4 Views (L1–L3) & ADRs | **Stage 1 (Baseline)** | `docs/sad/01–05`, `ADR-0001`–`ADR-0008`, C4 `.puml` | **Done** |
| **`ARC03`** | Architecture | Contract-First REST API Specification & OpenAPI 3.0.3 Contract | **Stage 1 (Baseline)** | `06-api-design-specification.md`, `docs/api/openapi.yaml` | **Done** |
| **`ARC04`** | Architecture | Relational Mapping, 3NF Schema, Constraints, Views & Seed Scripts | **Stage 1 (Baseline)** | `07-relational-mapping...md`, `08-database-structure.md`, `migrations/001–008` | **Done** |
| **`ARC05`** | Architecture | Four-Tier Automated Testing Strategy (Jest, Supertest, Bruno) | **Stage 1 (Baseline)** | `ADR-0007`, `jest.config.js`, `tests/unit`, `tests/integration` | **Done** |

---

### 2.2. Core Functional User Stories — Stage 1 (Implemented Baseline)

| Story ID | Module / Scope | Primary Actor(s) | User Story Statement | Use Cases Covered | Stage / Sprint | Specification Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`FG01`** | `FG-AUTH` (Identity & RBAC) | `ADMINISTRATOR`, `OPERATOR`, `ENGINEER` | *As a System Administrator or Plant Staff member, I want to authenticate via stateless JWTs and manage user accounts and RBAC roles, so that industrial operations are protected by strict role segregation.* | `UC01`, `UC02`, `UC03` | **Stage 1 — Baseline** | `docs/user-stories/FG01/requirements.md` |
| **`FG02`** | `FG-TOPO` & `FG-QUERY` (Plant Topology) | `ENGINEER`, `OPERATOR` | *As an Industrial Engineer, I want to register and manage Plant Sectors and Conveyor Lines and query their real-time CQRS health summaries, so that the physical factory layout is accurately modeled and protected against accidental deletion.* | `UC04`, `UC05`, `UC12`, `UC15` | **Stage 1 — Baseline** | `docs/user-stories/FG02/requirements.md` |
| **`FG03`** | `FG-SENS` (Sensors & Thresholds) | `ENGINEER`, `OPERATOR` | *As an Industrial Engineer, I want to register Sensor Nodes on Conveyor Lines and configure their Warning and Critical Threshold Rules, so that each transducer has validated physical tolerance bounds.* | `UC06`, `UC07` | **Stage 1 — Baseline** | `docs/user-stories/FG03/requirements.md` |
| **`FG04`** | `FG-INGEST` (Telemetry & Sliding Window) | `IoT Sensor Gateway`, `ENGINEER`, `OPERATOR` | *As an Industrial IoT Gateway or Engineer, I want to ingest real-time sensor telemetry streams and evaluate sliding-window moving averages in memory, so that threshold breaches automatically trigger anomaly alerts and halt or degrade affected conveyor lines.* | `UC09`, `UC10`, `UC11` | **Stage 1 — Baseline** | `docs/user-stories/FG04/requirements.md` |
| **`FG05`** | `FG-ALERT` (Anomaly Alert Lifecycle) | `OPERATOR`, `ENGINEER` | *As a Plant Operator or Industrial Engineer, I want to inspect, filter, acknowledge, and resolve Anomaly Alerts with diagnostic notes, so that floor incidents follow a traceable operational workflow.* | `UC13`, `UC14` | **Stage 1 — Baseline** | `docs/user-stories/FG05/requirements.md` |
| **`FG06`** | `FG-STOCK` (Abstract Spare Parts) | `ENGINEER`, `OPERATOR` | *As an Industrial Engineer or Operator, I want to register spare-part catalog items and manage their inventory in normalized non-negative integer abstract stock units, so that maintenance replacements never produce negative stock balances.* | `UC08` | **Stage 1 — Baseline** | `docs/user-stories/FG06/requirements.md` |

---

### 2.3. Advanced Functional & Technical Stories — Stage 2 (28+ Hours AI Roadmap)

| Story ID | Roadmap Milestone | Primary Actor(s) | User Story Statement | Use Cases Covered | Est. Effort | Specification Path |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **`FG07`** | **Milestone 1** (`Task 1`) | `IoT Sensor Gateway`, `ENGINEER` | *As an Industrial Engineer, I want the sliding-window engine to compute $O(\log W)$ dual-heap Moving Medians ($\tilde{x}_W$), filter single-sample IQR spikes, and warm up buffers on startup, so that transient vibration impacts do not trigger false-positive line halts.* | `UC16` | **6.0 h** | `docs/user-stories/FG07/requirements.md` |
| **`FG08`** | **Milestone 2** (`Task 2`) | `ENGINEER`, `OPERATOR` | *As an Industrial Engineer or Operator, I want concurrent conveyor line status mutations to enforce Optimistic Concurrency Control (`version`) and spare-part deductions to enforce Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`), so that simultaneous operations never cause lost updates or negative stock.* | `UC17` | **5.0 h** | `docs/user-stories/FG08/requirements.md` |
| **`FG09`** | **Milestone 3** (`Task 3`) | `External Webhook Receiver`, `ENGINEER` | *As an Industrial Engineer, I want anomaly alerts to persist transactional outbox events and dispatch HMAC-SHA256 signed webhooks asynchronously with retry backoff, so that external maintenance systems are notified reliably without blocking HTTP telemetry ingestion.* | `UC18` | **6.5 h** | `docs/user-stories/FG09/requirements.md` |
| **`FG10`** | **Milestone 4** (`Task 4`) | `ADMINISTRATOR`, `QA / CI Runner` | *As a System Architect, I want exhaustive Joi boundary validation pipes (`stripUnknown: true`) and chained Git-native Bruno CLI (`.bru`) test suites, so that all REST contract boundaries and multi-step industrial workflows are verified automatically.* | `UC19` | **6.0 h** | `docs/user-stories/FG10/requirements.md` |
| **`FG11`** | **Milestone 5** (`Task 5`) | `Prometheus Scraper`, `OPERATOR` | *As a Site Reliability / Industrial Engineer, I want FlowGuard to expose real-time telemetry counters, window evaluation latencies, and active alert gauges at `GET /api/v1/metrics` in OpenMetrics format, so that Prometheus and Grafana can scrape system health.* | `UC20` | **4.5 h** | `docs/user-stories/FG11/requirements.md` |

---

## 3. Dependency Graph Between User Stories

```mermaid
flowchart TD
    subgraph STAGE1["Stage 1 — Implemented Baseline (Sprint 1)"]
        FG01["FG01: Identity, Auth (Argon2id/JWT) & RBAC"]
        FG02["FG02: Plant Sectors, Conveyor Lines & CQRS Health View"]
        FG03["FG03: Sensor Nodes & Threshold Rules"]
        FG04["FG04: Telemetry Ingestion & Sliding-Window Moving Average"]
        FG05["FG05: Anomaly Alert Lifecycle (Acknowledge & Resolve)"]
        FG06["FG06: Abstract Spare-Part Stock Management"]
    end

    subgraph STAGE2["Stage 2 — Planned AI-Assisted Roadmap (28 Hours)"]
        FG07["FG07 (M1 - 6.0h): Dual-Heap Moving Median & IQR Outlier Filter"]
        FG08["FG08 (M2 - 5.0h): Optimistic (version) & Pessimistic (FOR UPDATE) Locks"]
        FG09["FG09 (M3 - 6.5h): Transactional Outbox & Async Webhook Dispatcher"]
        FG10["FG10 (M4 - 6.0h): Boundary Validation Pipes & Chained Bruno CLI Suites"]
        FG11["FG11 (M5 - 4.5h): OpenMetrics / Prometheus Exporter (/api/v1/metrics)"]
    end

    FG01 --> FG02
    FG01 --> FG06
    FG02 --> FG03
    FG03 --> FG04
    FG04 --> FG05

    FG04 -.->|extended by| FG07
    FG02 -.->|hardened by| FG08
    FG06 -.->|hardened by| FG08
    FG05 -.->|extended by| FG09
    FG01 & FG02 & FG03 & FG04 & FG05 & FG06 -.->|verified by| FG10
    FG02 & FG04 & FG05 -.->|scraped by| FG11