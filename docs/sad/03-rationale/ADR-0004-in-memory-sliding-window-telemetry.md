# ADR-0004: In-Memory Sliding-Window Telemetry Processing & Anomaly Detection Pipeline

- **Status:** Accepted

- **Context:**
In industrial manufacturing plants and commercial sorting hubs, physical sensors mounted on conveyor belts (measuring vibration in $\text{mm/s}$, motor temperature in $^{\circ}\text{C}$, belt velocity in $\text{m/s}$, and optical package counts) emit continuous telemetry streams (`01-problem-statement.md`, §2.1). Raw industrial sensor signals are notoriously noisy: transient mechanical vibrations (e.g., a heavy parcel dropping onto a belt) or momentary electrical interference frequently cause single-sample spikes that do not represent genuine equipment failure.

Conversely, subtle progressive degradation—such as a steady rise in moving-median vibration or a sustained 15% drop in belt velocity over a 60-second window—indicates an imminent mechanical jam or bearing seizure (`01-problem-statement.md`, §1, §2.1).

If FlowGuard were to execute a SQL `AVG()`, `PERCENTILE_CONT(0.5)` (median), or `STDDEV()` query over millions of historical rows in PostgreSQL on every incoming HTTP telemetry packet:
1. Database CPU and disk I/O would saturate immediately under high-frequency ingestion bursts.
2. Ingestion latency would spike from milliseconds to seconds, failing real-time anomaly detection requirements (KB §2.2, Performance & Reliability).

Conversely, if FlowGuard only evaluated single raw readings against static thresholds without temporal smoothing, operators would be flooded with false-positive alerts (alarm fatigue). We need a deterministic, low-latency architectural pattern to filter noise, compute sliding-window statistics, and evaluate anomaly rules in real time.

- **Decision:**
We implement a **Pipes-and-Filters In-Memory Sliding-Window Telemetry Engine** encapsulated as a stateless Domain Service (`TelemetryEvaluationEngine`) backed by bounded **Circular Ring Buffers** per active sensor stream (KB §7.2, §7.5):

1. **Bounded Per-Sensor Sliding Window Buffer:**
   - For each active `SensorNode`, the engine maintains a bounded in-memory sliding window $W$ holding the most recent $N$ readings (or readings within a configurable time horizon $\Delta t$, e.g., $N \le 128$ samples or $\Delta t = 60\text{ s}$).
   - Memory consumption is strictly bounded at $O(S \times N)$, where $S$ is the number of active sensors and $N$ is the maximum window capacity, preventing unbounded heap growth or memory leaks in the Node.js process (KB §2.2, §9.1).

2. **Pipes-and-Filters Ingestion Pipeline (KB §7.5):**
   Every incoming telemetry payload passes sequentially through four decoupled domain processing stages before persistence:
   - **Filter 1 — Boundary & Physical Plausibility Sanitizer:** Validates that the reading timestamp, unit of measure, and physical range (e.g., belt velocity $\ge 0$, temperature within hardware transducer limits) satisfy domain Value Object preconditions (`TelemetryValue`, KB §3.1, §4.1).
   - **Filter 2 — Sliding-Window Statistical Aggregator:** Appends the reading to the sensor's sliding window and computes real-time statistical metrics in memory:
     - **Moving Average ($\mu_W$):**
       $$\mu_W = \frac{1}{|W|} \sum_{i=1}^{|W|} x_i$$
     - **Moving Median ($\tilde{x}_W$) *(Baseline interface established; full high-frequency optimization scheduled in Roadmap Task 1)*:** Sorts or maintains dual-heap order statistics over $W$ to reject transient single-sample impulse spikes:
       $$\tilde{x}_W = \operatorname{median}(x_1, x_2, \dots, x_{|W|})$$
     - **Sample Standard Deviation ($\sigma_W$) & Z-Score:** Quantifies signal volatility across the active window.
   - **Filter 3 — Threshold & Invariant Evaluator:** Compares the smoothed window metric ($\mu_W$ or $\tilde{x}_W$) against the sensor's active `ThresholdRule` (`WARNING` and `CRITICAL` bounds).
   - **Filter 4 — State Transition & Persistence Dispatcher:** Persists the enriched `TelemetryReading` (including both raw value and computed window metrics) to PostgreSQL. If a threshold breach is confirmed, it atomically generates an `AnomalyAlert` and transitions the parent `ConveyorLine` operational state (`OPERATIONAL` $\rightarrow$ `DEGRADED_WARNING` or `FAULT_HALTED`) (`01-problem-statement.md`, §2.1, §2.4).

3. **Explicit Roadmap Separation (Baseline vs. 20-Hour Future Work):**
   - **Current Baseline Implementation:** Provides the bounded sliding-window buffer, moving-average ($\mu_W$) calculation, static threshold comparison, and synchronous database persistence.
   - **Planned 20-Hour Roadmap Extensions (`01-problem-statement.md`, §4):**
     - *Task 1:* Implement high-frequency **Moving Median ($\tilde{x}_W$)** and IQR outlier rejection filters for vibration transducers.
     - *Task 3:* Implement the asynchronous **Rule-Based Webhook Alert Dispatcher** (using an Event-Driven / Outbox approach, KB §7.5, §17.2) to notify external maintenance systems without blocking the HTTP ingestion response.

- **Considered Alternatives:**

  ### 1. Database-Only Window Functions (`OVER (PARTITION BY sensor_id ORDER BY recorded_at)`)
  - *Description:* Inserting raw readings directly into PostgreSQL and running a `SELECT AVG(val), PERCENTILE_CONT(0.5) ...` query across the `telemetry_readings` table on every ingestion request.
  - *Pros:* Stateless application tier; zero in-memory buffer management.
  - *Cons:* Catastrophic I/O and CPU bottleneck under continuous industrial sensor streams. Executing ordered-set aggregates (`PERCENTILE_CONT`) over disk-backed tables on every HTTP `POST` degrades response times as table cardinality grows (KB §4.2, §11.2).

  ### 2. External Distributed Stream Processor (Apache Kafka + Apache Flink / Spark Streaming)
  - *Description:* Routing sensor telemetry through a Kafka cluster into a distributed JVM stream-processing cluster (Flink) before writing results back to PostgreSQL.
  - *Pros:* Horizontal scalability to millions of events per second across multi-node clusters.
  - *Cons:* Massive operational complexity and infrastructure footprint (ZooKeeper/KRaft, JVM clusters, network serialization). Violates KB §1.2 (Principle 3: *Less is More*) and KB §7.4 (*"Do not distribute"*) for a plant-level telemetry engine where a bounded in-memory ring buffer handles thousands of readings per second in microseconds.

  ### 3. Naive Unfiltered Thresholding (Single-Sample Comparison)
  - *Description:* Triggering an `AnomalyAlert` immediately whenever a single raw sensor sample $x_t$ exceeds a threshold $T$, without maintaining any historical window $W$.
  - *Pros:* Trivial $O(1)$ implementation with zero state.
  - *Cons:* Fails to solve the core industrial problem (`01-problem-statement.md`, §2.1). Industrial vibration and optical sensors exhibit natural transient spikes; unfiltered single-sample evaluation floods operators with false alarms and misses gradual moving-average drift.

- **Consequences:**

  ### Positive
  - **Sub-Millisecond Statistical Evaluation:** Computing moving averages and medians over a bounded in-memory window ($N \le 128$) executes in microseconds in V8 memory, keeping telemetry ingestion latency minimal and predictable (KB §9.1).
  - **Dramatic Reduction in False-Positive Alerts:** Smoothing transient impulse noise via sliding windows ensures that `AnomalyAlert` records and conveyor line halts reflect genuine mechanical anomalies (`01-problem-statement.md`, §2.1).
  - **Pure Domain Testability:** Because the `TelemetryEvaluationEngine` and `SlidingWindowBuffer` are pure TypeScript domain classes with zero I/O dependencies (`ADR-0001`), complex statistical edge cases (window warm-up, spike rejection, boundary rollovers) can be 100% unit-tested deterministically with Jest (KB §14.1, §14.2).
  - **Database Offloading:** PostgreSQL only performs append-only `INSERT` operations for enriched telemetry records and indexed primary-key updates for line status, avoiding expensive real-time analytical scans on the write path.

  ### Negative / Trade-offs
  - **In-Memory Window Warm-Up on Process Restart:** Because the active sliding window buffer resides in process memory for speed, restarting the Node.js server starts windows cold (or requires a one-time bootstrap query loading the last $N$ readings per active sensor from PostgreSQL on startup, KB §4.2).
  - **Single-Node State Affinity:** If FlowGuard is scaled horizontally behind a Load Balancer in the future (KB §7.4), telemetry for a given `sensor_id` must either be routed consistently (sticky hashing) or the window state must be externalized to a shared low-latency store (Redis).

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial architectural decision defining the in-memory sliding-window pipeline and roadmap boundaries. |