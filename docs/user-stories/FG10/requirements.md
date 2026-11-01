# FG10 — Exhaustive Boundary Validation Pipes & Chained Bruno CLI Suites (Milestone 4 — 6.0h)

## 1. Requirements Engineering

### 1.1. User Story Description
As a System Architect, I want declarative Joi boundary validation pipes (`stripUnknown: true`) on all REST controllers and chained Git-native Bruno CLI (`.bru`) test suites, so that mass-assignment attacks are blocked at the perimeter and end-to-end industrial workflows are verified automatically.

### 1.2. Acceptance Criteria
- **AC1 — Perimeter Joi Validation Pipes:** Every `POST`, `PUT`, `PATCH`, and query endpoint validates input schemas at the NestJS perimeter with `stripUnknown: true` and `abortEarly: false`, returning structured field-level diagnostics on HTTP `400 Bad Request`.
- **AC2 — Chained Bruno (`.bru`) Collections:** The repository includes executable Bruno collections under `backend/tests/bruno/FlowGuard/` (`01-Auth_and_Users` through `06-Spare_Parts_Stock`) that dynamically extract JWT tokens (`bru.setEnvVar`) and verify `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, and `422` outcomes via `npx @usebruno/cli run`.