# FlowGuard

> **Industrial Line & Conveyor Telemetry & Anomaly Detection Engine**

## 📖 Overview
FlowGuard is a high-performance backend engine designed for manufacturing plants and commercial logistics hubs. It ingests real-time conveyor belt telemetry (vibration, velocity, temperature, optical counts) to monitor throughput bottlenecks and detect predictive mechanical anomalies before they cause costly factory downtime.

Built with strict **Clean Architecture** and **Domain-Driven Design (DDD)** principles, it utilizes in-memory sliding-window statistical analysis (Ring Buffers) for sub-millisecond anomaly detection, backed by a highly relational PostgreSQL database with ACID transactional guarantees.

## 🛠 Tech Stack
* **Runtime:** Node.js / TypeScript
* **Framework:** NestJS
* **Architecture:** Clean Architecture, Modular Monolith, CQRS (Light)
* **Database:** PostgreSQL (Strict constraints, ACID, Pessimistic Locking)
* **Testing:** Jest (144 Unit/Integration tests) + Bruno (78 Git-native E2E API tests)
* **API:** RESTful JSON API (Contract-First OpenAPI 3.0)

## 🤖 AI-Assisted Engineering Context
FlowGuard is designed to be developed with the assistance of AI coding agents. To ensure the AI strictly adheres to our architectural decisions (Clean Architecture, DDD, CQRS) without hallucinating or breaking domain invariants, this repository includes a comprehensive [Knowledge Base](./docs/ai-context/knowledge_base_flowguard.md).

This Knowledge Base acts as the **single source of truth** for the AI, providing it with:
- The 8 Architecture Decision Records (ADRs).
- The complete Domain Model and Ubiquitous Language Glossary.
- Database constraints, API contracts, and the 28-hour engineering roadmap.

## 📊 Engineering Reports
To demonstrate rigorous engineering governance and transparent development, the following reports are included:
- **[AI Usage & Governance Report](./docs/reports/ai-usage.md):** Details on how AI was safely integrated (human-in-the-loop) to build this project, ensuring strict adherence to domain invariants.
- **[Architectural Evolution & Contributions](./docs/reports/architectural-evolution.md):** A deep dive into the sequential, bottom-up development of the entire baseline (FG01-FG06).

## 🏗 Architecture & Documentation
The repository contains exhaustive architectural documentation located in the `docs/` directory, including:
- **Software Architecture Document (SAD):** C4 Model diagrams (Levels 1-3), domain models, and relational schemas.
- **Architecture Decision Records (ADRs):** Justifications for choosing NestJS, PostgreSQL, in-memory Ring Buffers, and Bruno for API testing.
- **OpenAPI 3.0 Specification:** Fully detailed API contracts.

## 🚀 Getting Started

### Prerequisites
* Docker & Docker Compose
* Node.js (v18+)

### Running the Application
1. Clone the repository:
   ```bash
   git clone https://github.com/1241244-PedroRibeiro/flow-guard-engine.git
   cd flow-guard-engine
   ```
2. Boot the infrastructure and database (runs migrations automatically):
   ```bash
   docker compose up -d
   ```
3. The API is now available at `http://localhost:3050/api/v1`
4. Access the OpenAPI documentation at `http://localhost:3050/api/docs`

## 🧪 Testing
FlowGuard employs a rigorous 4-layer testing strategy (Unit, Application, Integration, and Black-Box E2E):
```bash
# Run Jest Unit & Integration tests with coverage
cd backend
npm run test:coverage

# Run Git-native Bruno E2E API suites against the live server
npm run test:bruno
```

## 🗺 Roadmap & Future Work
FlowGuard is actively evolving. We are currently in the planning phase for 28+ hours of future enhancements, including:
* **High-Frequency Moving Median:** Implementing dual-heap algorithms for O(log W) statistical tracking and IQR outlier rejection.
* **Transactional Outbox:** Asynchronous webhook dispatching for external maintenance systems.
* **Observability:** OpenMetrics/Prometheus telemetry scraping endpoints.

Check out [ROADMAP.md](./ROADMAP.md) for the full breakdown.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.