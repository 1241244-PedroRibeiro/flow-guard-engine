-- Migration 007: Functional Case-Insensitive Unique Indexes & Time-Series Indexes
BEGIN;

-- Case-insensitive uniqueness enforcement across natural business codes
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
    ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS uq_plant_sectors_code_upper
    ON plant_sectors (UPPER(sector_code));

CREATE UNIQUE INDEX IF NOT EXISTS uq_conveyor_lines_code_upper
    ON conveyor_lines (UPPER(line_code));

CREATE UNIQUE INDEX IF NOT EXISTS uq_sensor_nodes_serial_upper
    ON sensor_nodes (UPPER(serial_number));

CREATE UNIQUE INDEX IF NOT EXISTS uq_spare_part_code_upper
    ON spare_part_stock (UPPER(part_code));

-- Performance lookup indexes for foreign keys, time-series scans, and outbox polling
CREATE INDEX IF NOT EXISTS idx_conveyor_lines_sector_id
    ON conveyor_lines (sector_id);

CREATE INDEX IF NOT EXISTS idx_sensor_nodes_line_id
    ON sensor_nodes (line_id);

CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_recorded_desc
    ON telemetry_readings (sensor_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_line_status_severity
    ON anomaly_alerts (line_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_outbox_pending_created
    ON outbox_webhook_events (delivery_status, created_at ASC)
    WHERE delivery_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_spare_part_movements_part_recorded
    ON spare_part_movements (part_id, recorded_at DESC);

COMMIT;