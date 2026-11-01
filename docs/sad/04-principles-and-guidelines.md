# Architectural Principles & Engineering Guidelines: FlowGuard

## 1. Introduction & Purpose
This document outlines the core architectural principles and engineering guidelines governing the design, implementation, evolution, and testing of **FlowGuard**. These principles operationalize the architectural vision, ensuring that all design trade-offs consistently favor maintainability, testability, data integrity, and industrial reliability.

In accordance with ARQSI guidelines (KB §1.2), architecture is treated as active argumentation and structured reasoning rather than passive documentation.

---

## 2. Core Architectural Principles

### Principle 1 — The Dependency Rule (Concentric Architecture First)
* **Definition:** All source code dependencies must point **exclusively inward** toward the Domain Core (KB §7.2). The innermost rings (Entities, Value Objects, Domain Services) contain pure business logic and know nothing about outer infrastructure concerns (PostgreSQL, NestJS, HTTP transport, or external webhooks).
* **Application in FlowGuard:** Domain invariants (e.g., non-negative abstract spare-part units, threshold bounds, sensor status transitions) are protected inside rich domain models. Infrastructure adapters implement outbound *Port* interfaces, never the reverse.

### Principle 2 — Database as a Fortress (Relational Invariants)
* **Definition:** Relational databases must actively protect domain consistency. Business rules that govern structural integrity and safety must never be left solely to application-layer validation, which is vulnerable to concurrency race conditions (KB §9.3, §21.1).
* **Application in FlowGuard:** PostgreSQL enforces foreign key constraints with `ON DELETE RESTRICT` (preventing the accidental deletion of referenced plant sectors or conveyor lines) and explicit `CHECK` constraints (guaranteeing non-negative spare parts and valid threshold intervals) (`01-problem-statement.md`, §2; KB §21.1).

### Principle 3 — Intentional APIs & Boundary Validation
* **Definition:** RESTful APIs must express business intent through resource-oriented URIs and standard HTTP methods, avoiding CRUD-over-RPC anti-patterns (KB §7.5, §8.2). Furthermore, all incoming boundary payloads must be validated at the perimeter before reaching application services (KB §9.2).
* **Application in FlowGuard:** URIs use plural nouns (`/api/v1/conveyor-lines`), status codes strictly reflect outcomes (`201 Created`, `409 Conflict`, `422 Unprocessable Entity`), and Joi/Zod validation pipes intercept malformed or malicious payloads at the routing perimeter.

### Principle 4 — Testability by Design (Isolation from I/O)
* **Definition:** Business logic and statistical calculations must be testable in complete isolation from external networks, databases, and web frameworks in under one second (KB §14.1, §14.2).
* **Application in FlowGuard:** By decoupling domain services and use cases from database drivers via Repository interfaces, unit tests execute purely in V8 memory using `InMemoryRepository` fakes and Jest assertions.

### Principle 5 — Less is More (Pragmatic Simplicity)
* **Definition:** Introduce architectural complexity only when justified by explicit quality drivers or non-functional requirements. Avoid distributed systems anti-patterns when a modular monolith satisfies the domain (KB §1.2, Principle 3; §7.4).
* **Application in FlowGuard:** FlowGuard is deployed as a Modular Monolith, eliminating network serialization, distributed transaction overhead, and eventual-consistency anomalies while maintaining clean internal module boundaries.

---

## 3. Engineering Guidelines & Coding Standards

### 3.1. Nomenclatura e Linguagem Ubíqua (Ubiquitous Language)
* All code identifiers, comments, commit messages, and documentation must be written strictly in **English** (KB §10.1).
* Domain classes must directly reflect the Ubiquitous Language defined in the domain model (e.g., `PlantSector`, `ConveyorLine`, `SensorNode`, `ThresholdRule`, `AnomalyAlert`). Vague technical suffixes like `ManagerImpl` or `DataHelper` are strictly prohibited.

### 3.2. Immutability & Value Objects
* Value Objects (`SensorSerialNumber`, `ThresholdBounds`, `AbstractStockQuantity`) must be immutable (`readonly` properties, private constructors, functional update methods). They encapsulate their own validation logic and throw descriptive domain exceptions upon invariant violation (KB §3.1, §3.2).

### 3.3. Conventional Commits & Git Workflow
* All version control activity must adhere to the Conventional Commits specification (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) (KB §16.2). Commits must be atomic, progressive, and tied directly to project milestones or roadmap tasks.