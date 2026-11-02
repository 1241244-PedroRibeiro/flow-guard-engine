import { EntityNotFoundException } from '../../domain/common/exceptions/EntityNotFoundException';
import { AnomalyAlert } from '../../domain/alert/AnomalyAlert';
import { IAnomalyAlertRepository } from './ports/IAnomalyAlertRepository';
import { QueryAnomalyAlertsQuery } from './dto/QueryAnomalyAlertsQuery';
import { PaginatedAnomalyAlertsResponseDto } from './dto/PaginatedAnomalyAlertsResponseDto';
import { AcknowledgeAlertCommand } from './dto/AcknowledgeAlertCommand';
import { AnomalyAlertResponseDto } from './dto/AnomalyAlertResponseDto';

export class AnomalyAlertService {
  constructor(private readonly repo: IAnomalyAlertRepository) {}

  async getAlerts(query: QueryAnomalyAlertsQuery): Promise<PaginatedAnomalyAlertsResponseDto> {
    const { items, total } = await this.repo.findAllPaginated(query);
    return {
      items: items.map(this.toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async acknowledgeAlert(cmd: AcknowledgeAlertCommand): Promise<AnomalyAlertResponseDto> {
    const alert = await this.repo.findById(cmd.alertId);
    if (!alert) throw new EntityNotFoundException(`AnomalyAlert ${cmd.alertId} not found.`);

    alert.acknowledge(cmd.userId, cmd.diagnosticNote);
    await this.repo.save(alert);

    return this.toDto(alert);
  }

  async resolveAlert(alertId: string): Promise<AnomalyAlertResponseDto> {
    const alert = await this.repo.findById(alertId);
    if (!alert) throw new EntityNotFoundException(`AnomalyAlert ${alertId} not found.`);

    alert.resolve();
    await this.repo.save(alert);

    return this.toDto(alert);
  }

  private toDto(alert: AnomalyAlert): AnomalyAlertResponseDto {
    return {
      id: alert.id,
      sensorId: alert.sensorId,
      lineId: alert.lineId,
      readingId: alert.readingId,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      diagnosticNote: alert.diagnosticNote,
      triggeredAt: alert.triggeredAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt ? alert.acknowledgedAt.toISOString() : null,
      acknowledgedBy: alert.acknowledgedBy,
      resolvedAt: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
    };
  }
}