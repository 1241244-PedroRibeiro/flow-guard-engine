-- Migration 006: Read-Optimized CQRS SQL Views (Eliminates N+1 Queries)
BEGIN;

CREATE OR REPLACE VIEW v_conveyor_line_health_summary AS
SELECT
    cl.id,
    cl.sector_id,
    ps.sector_code,
    ps.name AS sector_name,
    cl.line_code,
    cl.name,
    cl.operational_status,
    cl.is_active,
    cl.version,
    cl.updated_at,
    COUNT(DISTINCT sn.id) FILTER (WHERE sn.is_active = TRUE)::INT AS active_sensor_count,
    COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'OPEN' AND aa.severity = 'WARNING')::INT AS open_warning_alert_count,
    COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'OPEN' AND aa.severity = 'CRITICAL')::INT AS open_critical_alert_count
FROM conveyor_lines cl
INNER JOIN plant_sectors ps ON cl.sector_id = ps.id
LEFT JOIN sensor_nodes sn ON sn.line_id = cl.id
LEFT JOIN anomaly_alerts aa ON aa.line_id = cl.id
GROUP BY cl.id, ps.sector_code, ps.name;

CREATE OR REPLACE VIEW v_sensor_latest_telemetry AS
SELECT DISTINCT ON (sn.id)
    sn.id AS sensor_id,
    sn.serial_number,
    sn.sensor_type,
    sn.line_id,
    sn.is_active,
    tr.warning_limit,
    tr.critical_limit,
    tr.unit AS threshold_unit,
    tr.window_size_samples,
    rd.id AS latest_reading_id,
    rd.raw_value AS latest_raw_value,
    rd.moving_average AS latest_moving_average,
    rd.moving_median AS latest_moving_median,
    rd.recorded_at AS latest_recorded_at
FROM sensor_nodes sn
LEFT JOIN threshold_rules tr ON tr.sensor_id = sn.id
LEFT JOIN telemetry_readings rd ON rd.sensor_id = sn.id
ORDER BY sn.id, rd.recorded_at DESC NULLS LAST;

COMMIT;