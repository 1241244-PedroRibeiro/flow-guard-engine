# FG11 — Expose Real-Time OpenMetrics / Prometheus Telemetry Scraper Endpoint (Milestone 5 — 4.5h)

## 1. Requirements Engineering

### 1.1. User Story Description
As a Site Reliability or Industrial Engineer, I want FlowGuard to expose real-time telemetry counters, sliding-window evaluation latencies, and active alert gauges at `GET /api/v1/metrics` in OpenMetrics text format, so that enterprise Prometheus servers can scrape operational metrics.

### 1.2. Acceptance Criteria
- **AC1 — OpenMetrics Exposition Format:** `GET /api/v1/metrics` returns HTTP `200 OK` with `Content-Type: text/plain; version=0.0.4; charset=utf-8` containing `# HELP` and `# TYPE` metadata lines.
- **AC2 — Live Operational Counters & Gauges:** Exports `flowguard_telemetry_readings_ingested_total{sensor_type}`, `flowguard_sliding_window_evaluation_duration_ms`, `flowguard_active_anomaly_alerts{severity}`, and `flowguard_conveyor_lines_total{status}`.