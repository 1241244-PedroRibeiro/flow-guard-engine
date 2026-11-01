# FG07 — High-Frequency Moving Median (Dual-Heap) & IQR Outlier Rejection (Milestone 1 — 6.0h)

## 1. Requirements Engineering

### 1.1. User Story Description
As an Industrial Engineer, I want the in-memory sliding-window engine to compute $O(\log W)$ dual-heap Moving Medians ($\tilde{x}_W$), filter single-sample Interquartile Range ($IQR$) spikes, and warm up buffers from PostgreSQL on startup, so that transient mechanical impacts do not trigger false-positive conveyor line halts.

### 1.2. Acceptance Criteria
- **AC1 — Dual-Heap Order Statistics ($O(\log W)$):** `SlidingWindowBuffer` maintains balanced Max-Heap (lower half) and Min-Heap (upper half) structures with lazy eviction over the circular ring buffer ($3 \le W \le 128$), computing $\tilde{x}_W$ in $O(\log W)$ time without full-array sorting on every ingested sample.
- **AC2 — IQR Impulse Spike Rejection:** For `MOTOR_VIBRATION` and `OPTICAL_COUNTER` sensors with at least 8 samples in the active window, samples exceeding $Q_3 + 1.5 \times IQR$ (or below $Q_1 - 1.5 \times IQR$) are flagged as transient outliers; threshold breach evaluation uses the robust Moving Median $\tilde{x}_W$ rather than the raw spike.
- **AC3 — Startup Buffer Warm-Up (`bootstrapWindowState`):** On application startup, `TelemetryIngestionService` queries the most recent $W$ readings per active sensor (`idx_telemetry_sensor_recorded_desc`) to pre-populate in-memory ring buffers so sliding windows do not start cold after a deployment or restart.