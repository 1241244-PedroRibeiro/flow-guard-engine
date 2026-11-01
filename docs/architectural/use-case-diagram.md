# Use Case Diagram & Functional Scope: FlowGuard

## 1. Functional Scope Overview (Implemented Baseline vs. 20+ Hour Roadmap)

In alignment with Requirements Engineering principles (KB §2.1), the Use Case Diagram below models the functional interactions between external actors and the **FlowGuard** system boundary. To provide complete clarity for project reviewers, use cases are explicitly partitioned into:
1. **Implemented Baseline Use Cases (`UC01`–`UC15`):** Core authentication, RBAC governance, plant sector and conveyor line topology management, sensor node and threshold configuration, real-time telemetry ingestion with moving-average evaluation, anomaly alert acknowledgement, and abstract spare-part inventory management.
2. **Planned 20+ Hour Roadmap Use Cases (`UC16`–`UC20`):** Advanced high-frequency moving-median & IQR outlier filtering (`Task 1`), concurrent optimistic/pessimistic locking workflows (`Task 2`), asynchronous transactional-outbox webhook dispatching (`Task 3`), automated black-box Bruno CLI contract verification (`Task 4`), and OpenMetrics/Prometheus telemetry scraping (`Task 5`).

---

## 2. Use Case Diagram (Mermaid)

```mermaid
flowchart LR

    %% ===================== ACTORS =====================
    ADMIN(["System Administrator\n(ADMINISTRATOR)"])
    ENGINEER(["Industrial Engineer\n(ENGINEER)"])
    OPERATOR(["Plant Operator\n(OPERATOR)"])
    GATEWAY(["Industrial IoT\nSensor Gateway"])
    WEBHOOK(["External Maintenance\nWebhook Receiver"])
    PROMETHEUS(["Prometheus / OpenMetrics\nScraper"])

    %% ===================== BASELINE: IDENTITY & ACCESS =====================
    subgraph AUTH_UC["Identity & Access Governance — Implemented Baseline"]
        direction TB
        UC01(("UC01: Authenticate\n(Login & Issue JWT)"))
        UC02(("UC02: Provision Staff &\nAssign RBAC Roles"))
        UC03(("UC03: Manage User Status\n(Activate / Deactivate)"))
    end

    %% ===================== BASELINE: PLANT TOPOLOGY & SENSORS =====================
    subgraph TOPO_UC["Plant Topology & Sensor Configuration — Implemented Baseline"]
        direction TB
        UC04(("UC04: Manage Plant Sectors\n(Create, Update, Restrict Delete)"))
        UC05(("UC05: Manage Conveyor Lines\n(Create, Deactivate, Reactivate)"))
        UC06(("UC06: Register & Calibrate\nSensor Nodes"))
        UC07(("UC07: Configure Warning &\nCritical Threshold Rules"))
        UC08(("UC08: Manage Spare-Part\nAbstract Stock Units"))
    end

    %% ===================== BASELINE: TELEMETRY & OPERATIONS =====================
    subgraph OPS_UC["Real-Time Telemetry & Floor Operations — Implemented Baseline"]
        direction TB
        UC09(("UC09: Ingest Sensor\nTelemetry Stream"))
        UC10(("UC10: Compute Sliding-Window\nMoving Average"))
        UC11(("UC11: Trigger Anomaly Alert &\nHalt/Degrade Conveyor Line"))
        UC12(("UC12: Query Conveyor Line\nHealth Summary (CQRS View)"))
        UC13(("UC13: Inspect Active &\nHistorical Anomaly Alerts"))
        UC14(("UC14: Acknowledge & Resolve\nAnomaly Alert"))
        UC15(("UC15: Update Conveyor Line\nOperational Status"))
    end

    %% ===================== FUTURE ROADMAP (20+ HOURS WORK) =====================
    subgraph ROADMAP_UC["Planned Future Enhancements — 20+ Hours AI-Assisted Roadmap"]
        direction TB
        UC16(("UC16: Compute High-Frequency\nMoving Median & IQR Outlier Filter\n[Roadmap Task 1]"))
        UC17(("UC17: Enforce Optimistic Version &\nPessimistic Row-Locked Mutations\n[Roadmap Task 2]"))
        UC18(("UC18: Configure & Dispatch\nAsync Outbox Alert Webhooks\n[Roadmap Task 3]"))
        UC19(("UC19: Execute Chained Black-Box\nBruno CLI Contract Suites\n[Roadmap Task 4]"))
        UC20(("UC20: Scrape OpenMetrics /\nPrometheus Telemetry Counters\n[Roadmap Task 5]"))
    end

    %% ===================== ACTOR RELATIONSHIPS (BASELINE) =====================
    ADMIN --> UC01
    ADMIN --> UC02
    ADMIN --> UC03

    ENGINEER --> UC01
    ENGINEER --> UC04
    ENGINEER --> UC05
    ENGINEER --> UC06
    ENGINEER --> UC07
    ENGINEER --> UC08
    ENGINEER --> UC12

    OPERATOR --> UC01
    OPERATOR --> UC12
    OPERATOR --> UC13
    OPERATOR --> UC14
    OPERATOR --> UC15

    GATEWAY --> UC09

    %% ===================== ACTOR RELATIONSHIPS (ROADMAP) =====================
    ENGINEER -.-> UC17
    ENGINEER -.-> UC18
    ADMIN -.-> UC19
    UC18 -.-> WEBHOOK
    PROMETHEUS -.-> UC20

    %% ===================== INCLUDE / EXTEND DEPENDENCIES =====================
    UC05 -.->|references sector| UC04
    UC06 -.->|attached to line| UC05
    UC07 -.->|guards sensor| UC06
    UC09 -.->|includes window avg| UC10
    UC09 -.->|includes median filter| UC16
    UC10 -.->|evaluates bounds| UC07
    UC16 -.->|evaluates bounds| UC07
    UC10 -.->|extends on breach| UC11
    UC11 -.->|triggers outbox webhook| UC18
    UC08 -.->|enforces row lock| UC17
    UC15 -.->|enforces version lock| UC17

```