import { AnomalyAlert } from '../../../domain/alert/AnomalyAlert';
import { QueryAnomalyAlertsQuery } from '../dto/QueryAnomalyAlertsQuery';

export interface IAnomalyAlertRepository {
  findById(id: string): Promise<AnomalyAlert | null>;
  save(alert: AnomalyAlert): Promise<void>;
  findAllPaginated(query: QueryAnomalyAlertsQuery): Promise<{ items: AnomalyAlert[]; total: number }>;
}