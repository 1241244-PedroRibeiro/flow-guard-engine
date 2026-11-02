import { SensorSerialNumber } from '../../../domain/common/SensorSerialNumber';
import { TelemetryValue } from '../../../domain/common/TelemetryValue';
import { SensorNode } from '../../../domain/sensor/SensorNode';
import { SensorType } from '../../../domain/sensor/SensorType';
import { ThresholdRule } from '../../../domain/sensor/ThresholdRule';

export interface SensorNodeRow {
    id: string;
    line_id: string;
    serial_number: string;
    sensor_type: string;
    is_active: boolean;
    last_calibrated_at: Date | null;
    created_at: Date;
    updated_at: Date;
    tr_id: string | null;
    tr_warning_limit: number | string | null;   // pg pode devolver string
    tr_critical_limit: number | string | null;  // pg pode devolver string
    tr_unit: string | null;
    tr_window_size_samples: number | string | null;
    tr_version: number | string | null;
}

export class SensorNodeMapper {
    static toDomain(row: SensorNodeRow): SensorNode {
        const thresholdRule =
            row.tr_id !== null && row.tr_id !== undefined
                ? ThresholdRule.reconstitute(
                      row.tr_id,
                      row.id,
                      // CORRECTION: Convert string values to numbers before creating TelemetryValue instances. This ensures that the domain model receives the correct numeric types.
                      TelemetryValue.create(Number(row.tr_warning_limit), row.tr_unit!),
                      TelemetryValue.create(Number(row.tr_critical_limit), row.tr_unit!),
                      Number(row.tr_window_size_samples),
                      Number(row.tr_version),
                  )
                : null;

        return SensorNode.reconstitute(
            row.id,
            row.line_id,
            SensorSerialNumber.create(row.serial_number),
            row.sensor_type as SensorType,
            row.is_active,
            row.last_calibrated_at,
            row.created_at,
            row.updated_at,
            thresholdRule,
        );
    }

    static toPersistence(sensor: SensorNode): {
        id: string;
        line_id: string;
        serial_number: string;
        sensor_type: string;
        is_active: boolean;
        last_calibrated_at: Date | null;
        created_at: Date;
        updated_at: Date;
    } {
        return {
            id: sensor.getId(),
            line_id: sensor.getLineId(),
            serial_number: sensor.getSerialNumber().getValue(),
            sensor_type: sensor.getSensorType(),
            is_active: sensor.getIsActive(),
            last_calibrated_at: sensor.getLastCalibratedAt(),
            created_at: sensor.getCreatedAt(),
            updated_at: sensor.getUpdatedAt(),
        };
    }
}