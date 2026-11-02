import { Pool } from 'pg';
import { IAnomalyAlertRepository } from '../../../application/alert/ports/IAnomalyAlertRepository';
import { QueryAnomalyAlertsQuery } from '../../../application/alert/dto/QueryAnomalyAlertsQuery';
import { AnomalyAlert } from '../../../domain/alert/AnomalyAlert';
import { AnomalyAlertMapper, AnomalyAlertRow } from '../mappers/AnomalyAlertMapper';

export class PostgresAnomalyAlertRepository implements IAnomalyAlertRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<AnomalyAlert | null> {
    const { rows } = await this.pool.query<AnomalyAlertRow>(
      `SELECT * FROM anomaly_alerts WHERE id = $1`,
      [id],
    );
    return rows.length === 0 ? null : AnomalyAlertMapper.toDomain(rows[0]);
  }

  async save(alert: AnomalyAlert): Promise<void> {
    await this.pool.query(
      `UPDATE anomaly_alerts
          SET status = $2,
              diagnostic_note = $3,
              acknowledged_at = $4,
              acknowledged_by = $5,
              resolved_at = $6
        WHERE id = $1`,
      [
        alert.id,
        alert.status,
        alert.diagnosticNote,
        alert.acknowledgedAt,
        alert.acknowledgedBy,
        alert.resolvedAt,
      ],
    );
  }

  async findAllPaginated(query: QueryAnomalyAlertsQuery): Promise<{ items: AnomalyAlert[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (query.severity) {
      params.push(query.severity);
      conditions.push(`severity = $${params.length}`);
    }
    if (query.lineId) {
      params.push(query.lineId);
      conditions.push(`line_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.pageSize;

    const [dataRes, countRes] = await Promise.all([
      this.pool.query<AnomalyAlertRow>(
        `SELECT * FROM anomaly_alerts ${where} ORDER BY triggered_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, query.pageSize, offset],
      ),
      this.pool.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM anomaly_alerts ${where}`,
        params,
      ),
    ]);

    return {
      items: dataRes.rows.map(AnomalyAlertMapper.toDomain),
      total: countRes.rows[0].total,
    };
  }
}