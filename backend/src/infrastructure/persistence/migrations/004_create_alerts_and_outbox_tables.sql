-- Migration 004: Anomaly Alerts & Transactional Outbox Webhook Events (FG-ALERT, Task 3)
BEGIN;

CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE RESTRICT,
    line_id UUID NOT NULL REFERENCES conveyor_lines(id) ON DELETE RESTRICT,
    reading_id UUID REFERENCES telemetry_readings(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL
        CHECK (severity IN ('WARNING', 'CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    message TEXT NOT NULL,
    diagnostic_note TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_alerts_ack_consistency CHECK (
        (status = 'OPEN' AND acknowledged_at IS NULL AND acknowledged_by IS NULL) OR
        (status IN ('ACKNOWLEDGED', 'RESOLVED') AND acknowledged_at IS NOT NULL AND acknowledged_by IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS outbox_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES anomaly_alerts(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (delivery_status IN ('PENDING', 'DISPATCHED', 'FAILED')),
    attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

COMMIT;