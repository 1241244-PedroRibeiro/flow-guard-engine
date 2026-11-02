import { Pool } from 'pg';
import { TelemetryValue } from '../../../domain/common/TelemetryValue';
import { SensorNode } from '../../../domain/sensor/SensorNode';
import { ThresholdRule } from '../../../domain/sensor/ThresholdRule';
import { TelemetryReading } from '../../../domain/sensor/TelemetryReading';
import { ConveyorLine } from '../../../domain/topology/ConveyorLine';
import { LineStatus } from '../../../domain/topology/LineStatus';
import {
    ISensorTelemetryRepository,
    SensorFilter,
    SensorIngestionContext,
    IngestTelemetryAtomicallyCommand,
} from '../../../application/sensor/ports/ISensorTelemetryRepository';
import { SensorNodeMapper, SensorNodeRow } from '../mappers/SensorNodeMapper';
import { TelemetryReadingMapper, TelemetryReadingRow } from '../mappers/TelemetryReadingMapper';

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

interface ConveyorLineRow {
    id: string;
    sector_id: string;
    line_code: string;
    name: string;
    operational_status: string;
    is_active: boolean;
    version: number;
}

export class PostgresSensorTelemetryRepository implements ISensorTelemetryRepository {
    constructor(private readonly pool: Pool) {}

    // --------------------------------------------------------------
    // EXISTING METHODS (FG03) — preservados sem alterações
    // --------------------------------------------------------------

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
            TelemetryValue.create(Number(r.warning_limit), r.unit),
            TelemetryValue.create(Number(r.critical_limit), r.unit),
            Number(r.window_size_samples),
            Number(r.version),
        );
    }

    // --------------------------------------------------------------
    // NEW FG04 METHODS
    // --------------------------------------------------------------

    /**
     * Filter 4 context loader.
     * Reuses SensorNodeMapper (which already understands `tr_*` aliases) to obtain
     * SensorNode + embedded ThresholdRule, then loads the parent ConveyorLine via
     * ConveyorLine.reconstitute to avoid column-name collision between `sensor_nodes`
     * (`is_active`, `created_at`, `updated_at`) and `conveyor_lines` (`is_active`,
     * `version`, `updated_at`).
     */
    async findIngestionContext(sensorId: string): Promise<SensorIngestionContext | null> {
        const sensorResult = await this.pool.query<SensorNodeRow>(
            `${SELECT_WITH_RULE} WHERE sn.id = $1`,
            [sensorId],
        );
        if (sensorResult.rowCount === 0) return null;

        const sensor = SensorNodeMapper.toDomain(sensorResult.rows[0]);

        const lineResult = await this.pool.query<ConveyorLineRow>(
            `SELECT id, sector_id, line_code, name, operational_status, is_active, version
               FROM conveyor_lines
              WHERE id = $1`,
            [sensor.getLineId()],
        );
        if (lineResult.rowCount === 0) return null;

        const lr = lineResult.rows[0];
        const line = ConveyorLine.reconstitute({
            id: lr.id,
            sectorId: lr.sector_id,
            lineCode: lr.line_code,
            name: lr.name,
            operationalStatus: lr.operational_status as LineStatus,
            isActive: lr.is_active,
            version: Number(lr.version),
        });

        return {
            sensor,
            thresholdRule: sensor.getThresholdRule(),
            line,
        };
    }

    /**
     * Returns up to `limit` most recent raw values for a sensor, in chronological
     * order (oldest → newest) so the caller can feed them into the Ring Buffer
     * deterministically.
     */
    async findRecentRawValues(sensorId: string, limit: number): Promise<number[]> {
        const { rows } = await this.pool.query(
            `SELECT raw_value
               FROM telemetry_readings
              WHERE sensor_id = $1
              ORDER BY recorded_at DESC
              LIMIT $2`,
            [sensorId, limit],
        );
        return rows.map((r) => Number(r.raw_value)).reverse();
    }

    /**
     * AC2 atomic ingestion — one BEGIN/COMMIT/ROLLBACK envelope guarantees that
     * reading + alert + line-status transition are all-or-nothing (KB §23.1).
     */
    async ingestTelemetryAtomically(cmd: IngestTelemetryAtomicallyCommand): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO telemetry_readings
                   (id, sensor_id, raw_value, moving_average, moving_median, unit, window_sample_count, recorded_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    cmd.reading.id,
                    cmd.reading.sensorId,
                    cmd.reading.rawValue,
                    cmd.reading.movingAverage,
                    cmd.reading.movingMedian,
                    cmd.reading.unit,
                    cmd.reading.windowSampleCount,
                    cmd.reading.recordedAt,
                ],
            );

            if (cmd.alert) {
                const a = cmd.alert;
                await client.query(
                    `INSERT INTO anomaly_alerts
                       (id, sensor_id, line_id, reading_id, severity, status, message, triggered_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [a.id, a.sensorId, a.lineId, a.readingId, a.severity, a.status, a.message, a.triggeredAt],
                );
            }

            if (cmd.alert && cmd.newLineStatusIfBreach) {
                await client.query(
                    `UPDATE conveyor_lines
                        SET operational_status = $1,
                            is_active = CASE WHEN $1 = 'DEACTIVATED' THEN FALSE ELSE is_active END,
                            version = version + 1,
                            updated_at = NOW()
                      WHERE id = $2
                        AND operational_status <> $1`,
                    [cmd.newLineStatusIfBreach, cmd.alert.lineId],
                );
                // rowCount === 0 → line already in target status; idempotent, safe to proceed
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async findReadingsBySensorIdPaginated(
        sensorId: string,
        page: number,
        pageSize: number,
    ): Promise<{ items: TelemetryReading[]; total: number }> {
        const offset = (page - 1) * pageSize;
        const [readingsRes, countRes] = await Promise.all([
            this.pool.query<TelemetryReadingRow>(
                `SELECT id, sensor_id, raw_value, moving_average, moving_median, unit, window_sample_count, recorded_at
                   FROM telemetry_readings
                  WHERE sensor_id = $1
                  ORDER BY recorded_at DESC
                  LIMIT $2 OFFSET $3`,
                [sensorId, pageSize, offset],
            ),
            this.pool.query<{ total: number }>(
                `SELECT COUNT(*)::int AS total FROM telemetry_readings WHERE sensor_id = $1`,
                [sensorId],
            ),
        ]);
        return {
            items: readingsRes.rows.map(TelemetryReadingMapper.toDomain),
            total: countRes.rows[0].total,
        };
    }
}