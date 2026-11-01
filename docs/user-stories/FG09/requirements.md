# FG09 — Transactional Outbox Pattern & Asynchronous Webhook Alert Dispatcher (Milestone 3 — 6.5h)

## 1. Requirements Engineering

### 1.1. User Story Description
As an Industrial Engineer, I want anomaly alerts to persist transactional outbox events in PostgreSQL and dispatch HMAC-SHA256 signed webhooks asynchronously with exponential backoff retries, so that external maintenance systems are notified reliably without blocking HTTP telemetry ingestion.

### 1.2. Acceptance Criteria
- **AC1 — Atomic Outbox Persistence:** Whenever `FG04` creates a `WARNING` or `CRITICAL` `AnomalyAlert`, it inserts a `PENDING` row into `outbox_webhook_events` (`payload JSONB`) within the exact same database transaction.
- **AC2 — Non-Blocking Relay Worker (`FOR UPDATE SKIP LOCKED`):** A background relay polls `idx_outbox_pending_created`, locks pending rows with `FOR UPDATE SKIP LOCKED`, and dispatches `POST` requests via `HttpWebhookDispatcherAdapter` signed with `X-FlowGuard-Signature: sha256=<hmac>`.
- **AC3 — Retry & Failure Governance:** Successful deliveries (`2xx`) mark the outbox event `DISPATCHED` with `processed_at = NOW()`. Transient network/5xx errors increment `attempt_count` with exponential backoff up to 5 attempts before marking `FAILED`.