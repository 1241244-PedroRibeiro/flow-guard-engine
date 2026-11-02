import { TelemetryReading } from '../../../domain/sensor/TelemetryReading';

export interface TelemetryReadingRow {
  id: string;
  sensor_id: string;
  raw_value: string | number;
  moving_average: string | number;
  moving_median: string | number;
  unit: string;
  window_sample_count: number;
  recorded_at: string | Date;
}

export class TelemetryReadingMapper {
  static toDomain(row: TelemetryReadingRow): TelemetryReading {
    return TelemetryReading.create({
      id: row.id,
      sensorId: row.sensor_id,
      rawValue: Number(row.raw_value),
      movingAverage: Number(row.moving_average),
      movingMedian: Number(row.moving_median),
      unit: row.unit,
      windowSampleCount: Number(row.window_sample_count),
      recordedAt: row.recorded_at instanceof Date ? row.recorded_at : new Date(row.recorded_at),
    });
  }
}