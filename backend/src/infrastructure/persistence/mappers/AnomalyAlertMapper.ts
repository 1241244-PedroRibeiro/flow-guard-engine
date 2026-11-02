import { AlertSeverity } from '../../../domain/alert/AlertSeverity';
import { AlertStatus } from '../../../domain/alert/AlertStatus';
import { AnomalyAlert } from '../../../domain/alert/AnomalyAlert';

export interface AnomalyAlertRow {
  id: string;
  sensor_id: string;
  line_id: string;
  reading_id: string;
  severity: string;
  status: string;
  message: string;
  diagnostic_note: string | null;
  triggered_at: string | Date;
  acknowledged_at: string | Date | null;
  acknowledged_by: string | null;
  resolved_at: string | Date | null;
}

export class AnomalyAlertMapper {
  static toDomain(row: AnomalyAlertRow): AnomalyAlert {
    return AnomalyAlert.reconstitute({
      id: row.id,
      sensorId: row.sensor_id,
      lineId: row.line_id,
      readingId: row.reading_id,
      severity: row.severity as AlertSeverity,
      status: row.status as AlertStatus,
      message: row.message,
      diagnosticNote: row.diagnostic_note,
      triggeredAt: row.triggered_at instanceof Date ? row.triggered_at : new Date(row.triggered_at),
      acknowledgedAt: row.acknowledged_at
        ? row.acknowledged_at instanceof Date
          ? row.acknowledged_at
          : new Date(row.acknowledged_at)
        : null,
      acknowledgedBy: row.acknowledged_by,
      resolvedAt: row.resolved_at
        ? row.resolved_at instanceof Date
          ? row.resolved_at
          : new Date(row.resolved_at)
        : null,
    });
  }
}