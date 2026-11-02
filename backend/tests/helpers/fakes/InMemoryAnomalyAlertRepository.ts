import { IAnomalyAlertRepository } from '../../../src/application/alert/ports/IAnomalyAlertRepository';
import { QueryAnomalyAlertsQuery } from '../../../src/application/alert/dto/QueryAnomalyAlertsQuery';
import { AnomalyAlert } from '../../../src/domain/alert/AnomalyAlert';

export class InMemoryAnomalyAlertRepository implements IAnomalyAlertRepository {
  public alerts = new Map<string, AnomalyAlert>();

  async findById(id: string): Promise<AnomalyAlert | null> {
    return this.alerts.get(id) ?? null;
  }

  async save(alert: AnomalyAlert): Promise<void> {
    this.alerts.set(alert.id, alert);
  }

  async findAllPaginated(query: QueryAnomalyAlertsQuery): Promise<{ items: AnomalyAlert[]; total: number }> {
    let all = Array.from(this.alerts.values());

    if (query.status) all = all.filter((a) => a.status === query.status);
    if (query.severity) all = all.filter((a) => a.severity === query.severity);
    if (query.lineId) all = all.filter((a) => a.lineId === query.lineId);

    all.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());

    const offset = (query.page - 1) * query.pageSize;
    return {
      items: all.slice(offset, offset + query.pageSize),
      total: all.length,
    };
  }
}