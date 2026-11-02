import { AnomalyAlertService } from '../../../src/application/alert/AnomalyAlertService';
import { InMemoryAnomalyAlertRepository } from '../../helpers/fakes/InMemoryAnomalyAlertRepository';
import { AnomalyAlert } from '../../../src/domain/alert/AnomalyAlert';
import { AlertSeverity } from '../../../src/domain/alert/AlertSeverity';
import { AlertStatus } from '../../../src/domain/alert/AlertStatus';
import { EntityNotFoundException } from '../../../src/domain/common/exceptions/EntityNotFoundException';

const seedAlert = (repo: InMemoryAnomalyAlertRepository, id = 'a1') => {
  const alert = AnomalyAlert.create({
    id, sensorId: 's1', lineId: 'l1', readingId: 'r1',
    severity: AlertSeverity.CRITICAL, message: 'crit', triggeredAt: new Date(),
  });
  repo.alerts.set(alert.id, alert);
};

describe('AnomalyAlertService', () => {
  let repo: InMemoryAnomalyAlertRepository;
  let service: AnomalyAlertService;

  beforeEach(() => {
    repo = new InMemoryAnomalyAlertRepository();
    service = new AnomalyAlertService(repo);
  });

  it('AC2 — acknowledges alert and binds user', async () => {
    seedAlert(repo);
    const dto = await service.acknowledgeAlert({ alertId: 'a1', userId: 'u1', diagnosticNote: 'Fixing it' });
    expect(dto.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(dto.acknowledgedBy).toBe('u1');
    expect(dto.diagnosticNote).toBe('Fixing it');
  });

  it('AC3 — resolves alert after acknowledgement', async () => {
    seedAlert(repo);
    await service.acknowledgeAlert({ alertId: 'a1', userId: 'u1', diagnosticNote: 'Fixing it' });
    const dto = await service.resolveAlert('a1');
    expect(dto.status).toBe(AlertStatus.RESOLVED);
    expect(dto.resolvedAt).not.toBeNull();
  });

  it('throws 404 when alert is not found', async () => {
    await expect(service.acknowledgeAlert({ alertId: 'nope', userId: 'u1', diagnosticNote: 'Fixing it' }))
      .rejects.toThrow(EntityNotFoundException);
  });

  it('AC1 — paginates and filters alerts', async () => {
    seedAlert(repo, 'a1');
    seedAlert(repo, 'a2');
    seedAlert(repo, 'a3');
    const page = await service.getAlerts({ page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
  });
});