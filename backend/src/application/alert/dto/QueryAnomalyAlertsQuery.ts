import { AlertSeverity } from '../../../domain/alert/AlertSeverity';
import { AlertStatus } from '../../../domain/alert/AlertStatus';

export interface QueryAnomalyAlertsQuery {
  status?: AlertStatus;
  severity?: AlertSeverity;
  lineId?: string;
  page: number;
  pageSize: number;
}