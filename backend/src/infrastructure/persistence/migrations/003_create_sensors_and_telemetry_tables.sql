-- Migration 003: Sensor Nodes, Threshold Rules & Enriched Telemetry Stream (FG-SENS, FG-INGEST)
BEGIN;

CREATE TABLE IF NOT EXISTS sensor_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID NOT NULL REFERENCES conveyor_lines(id) ON DELETE RESTRICT,
    serial_number VARCHAR(40) NOT NULL CHECK (length(btrim(serial_number)) >= 3),
    sensor_type VARCHAR(30) NOT NULL
        CHECK (sensor_type IN ('BELT_VELOCITY', 'MOTOR_VIBRATION', 'BEARING_TEMPERATURE', 'OPTICAL_COUNTER')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_calibrated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threshold_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL UNIQUE REFERENCES sensor_nodes(id) ON DELETE CASCADE,
    warning_limit DOUBLE PRECISION NOT NULL,
    critical_limit DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL CHECK (length(btrim(unit)) > 0),
    window_size_samples INT NOT NULL DEFAULT 32
        CHECK (window_size_samples BETWEEN 3 AND 128),
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_threshold_rules_bounds CHECK (critical_limit > warning_limit)
);

CREATE TABLE IF NOT EXISTS telemetry_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sensor_id UUID NOT NULL REFERENCES sensor_nodes(id) ON DELETE RESTRICT,
    raw_value DOUBLE PRECISION NOT NULL,
    moving_average DOUBLE PRECISION NOT NULL,
    moving_median DOUBLE PRECISION NOT NULL,
    unit VARCHAR(20) NOT NULL,
    window_sample_count INT NOT NULL DEFAULT 1 CHECK (window_sample_count >= 1),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;