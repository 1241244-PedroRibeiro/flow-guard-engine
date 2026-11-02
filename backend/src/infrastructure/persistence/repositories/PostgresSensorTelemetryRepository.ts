import { Pool } from 'pg';
import { TelemetryValue } from '../../../domain/common/TelemetryValue';
import { SensorNode } from '../../../domain/sensor/SensorNode';
import { ThresholdRule } from '../../../domain/sensor/ThresholdRule';
import {
    ISensorTelemetryRepository,
    SensorFilter,
} from '../../../application/sensor/ports/ISensorTelemetryRepository';
import { SensorNodeMapper, SensorNodeRow } from '../mappers/SensorNodeMapper';

const SELECT_WITH_RULE = `
  SELECT
    sn.id, sn.line_id, sn.serial_number, sn.sensor_type,
    sn.is_active, sn.last_calibrated_at, sn.created_at, sn.updated_at,
    tr.id             AS tr_id,
    tr.warning_limit  AS tr_warning_limit,
    tr.critical_limit AS tr_critical_limit,
    tr.unit           AS tr_unit,
    tr.window_size_samples AS tr_window_size_samples,
    tr.version        AS tr_version
  FROM sensor_nodes sn
  LEFT JOIN threshold_rules tr ON tr.sensor_id = sn.id
`;

export class PostgresSensorTelemetryRepository implements ISensorTelemetryRepository {
    constructor(private readonly pool: Pool) {}

    async findById(id: string): Promise<SensorNode | null> {
        const result = await this.pool.query<SensorNodeRow>(
            `${SELECT_WITH_RULE} WHERE sn.id = $1`,
            [id],
        );
        return result.rowCount === 0 ? null : SensorNodeMapper.toDomain(result.rows[0]);
    }

    async findBySerialNumber(serialNumber: string): Promise<SensorNode | null> {
        const result = await this.pool.query<SensorNodeRow>(
            `${SELECT_WITH_RULE} WHERE UPPER(sn.serial_number) = UPPER($1)`,
            [serialNumber],
        );
        return result.rowCount === 0 ? null : SensorNodeMapper.toDomain(result.rows[0]);
    }

    async findByLineId(lineId: string): Promise<SensorNode[]> {
        const result = await this.pool.query<SensorNodeRow>(
            `${SELECT_WITH_RULE} WHERE sn.line_id = $1 ORDER BY sn.created_at ASC`,
            [lineId],
        );
        return result.rows.map(SensorNodeMapper.toDomain);
    }

    async findAll(filter?: SensorFilter): Promise<SensorNode[]> {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (filter?.lineId) {
            params.push(filter.lineId);
            conditions.push(`sn.line_id = $${params.length}`);
        }
        if (filter?.sensorType) {
            params.push(filter.sensorType);
            conditions.push(`sn.sensor_type = $${params.length}`);
        }
        if (filter?.isActive !== undefined) {
            params.push(filter.isActive);
            conditions.push(`sn.is_active = $${params.length}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await this.pool.query<SensorNodeRow>(
            `${SELECT_WITH_RULE} ${where} ORDER BY sn.created_at ASC`,
            params,
        );
        return result.rows.map(SensorNodeMapper.toDomain);
    }

    async lineExists(lineId: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM conveyor_lines WHERE id = $1 LIMIT 1',
            [lineId],
        );
        return (result.rowCount ?? 0) > 0;
    }

    async save(sensor: SensorNode): Promise<void> {
        const p = SensorNodeMapper.toPersistence(sensor);
        await this.pool.query(
            `INSERT INTO sensor_nodes
                (id, line_id, serial_number, sensor_type, is_active,
                 last_calibrated_at, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
                is_active = EXCLUDED.is_active,
                last_calibrated_at = EXCLUDED.last_calibrated_at,
                updated_at = EXCLUDED.updated_at`,
            [
                p.id, p.line_id, p.serial_number, p.sensor_type, p.is_active,
                p.last_calibrated_at, p.created_at, p.updated_at,
            ],
        );
    }

    async saveThresholdRule(rule: ThresholdRule): Promise<void> {
        const warning = rule.getWarningLimit();
        const critical = rule.getCriticalLimit();
        await this.pool.query(
            `INSERT INTO threshold_rules
                (id, sensor_id, warning_limit, critical_limit, unit,
                 window_size_samples, version, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (sensor_id) DO UPDATE SET
                warning_limit = EXCLUDED.warning_limit,
                critical_limit = EXCLUDED.critical_limit,
                unit = EXCLUDED.unit,
                window_size_samples = EXCLUDED.window_size_samples,
                version = threshold_rules.version + 1,
                updated_at = NOW()`,
            [
                rule.getId(),
                rule.getSensorId(),
                warning.getNumericValue(),
                critical.getNumericValue(),
                warning.getUnit(),
                rule.getWindowSizeSamples(),
                rule.getVersion(),
            ],
        );
    }

    async findThresholdRuleBySensorId(sensorId: string): Promise<ThresholdRule | null> {
        const result = await this.pool.query(
            `SELECT id, sensor_id, warning_limit, critical_limit, unit,
                    window_size_samples, version
             FROM threshold_rules WHERE sensor_id = $1`,
            [sensorId],
        );
        if (result.rowCount === 0) return null;
        const r = result.rows[0];
        return ThresholdRule.reconstitute(
            r.id,
            r.sensor_id,
            // CORREÇÃO #4 — cast explícito
            TelemetryValue.create(Number(r.warning_limit), r.unit),
            TelemetryValue.create(Number(r.critical_limit), r.unit),
            Number(r.window_size_samples),
            Number(r.version),
        );
    }
}