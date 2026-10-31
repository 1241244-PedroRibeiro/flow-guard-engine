# FlowGuard

> Industrial Line & Conveyor Telemetry & Anomaly Detection Engine

## Overview
FlowGuard is a lightweight backend engine designed for manufacturing plants and commercial logistics hubs to ingest real-time conveyor belt telemetry, monitor throughput bottlenecks, and detect predictive anomalies using sliding-window statistical analysis. 

## Tech Stack
* **Runtime:** Node.js / TypeScript
* **Architecture:** Clean Architecture / Layered Domain Services
* **Persistence:** PostgreSQL (with strict transactional constraints)
* **API:** RESTful JSON API (Contract-First design)

## Getting Started
1. Clone the repository.
2. Copy `.env.example` to `.env` and configure your database URI.
3. Run `npm install` and `npm run dev`.
