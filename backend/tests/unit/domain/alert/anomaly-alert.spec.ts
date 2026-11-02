import { AnomalyAlert } from '../../../../src/domain/alert/AnomalyAlert';
import { AlertSeverity } from '../../../../src/domain/alert/AlertSeverity';
import { AlertStatus } from '../../../../src/domain/alert/AlertStatus';
import { DomainInvariantException } from '../../../../src/domain/common/exceptions/DomainInvariantException';

const make = () =>
  AnomalyAlert.create({
    id: 'a1', sensorId: 's1', lineId: 'l1', readingId: 'r1',
    severity: AlertSeverity.WARNING, message: 'warn',
    triggeredAt: new Date(),
  });

describe('AnomalyAlert', () => {
  it('starts OPEN with no acknowledgement', () => {
    const a = make();
    expect(a.status).toBe(AlertStatus.OPEN);
    expect(a.acknowledgedAt).toBeNull();
    expect(a.acknowledgedBy).toBeNull();
  });

  it('acknowledge() sets status and user', () => {
    const a = make();
    a.acknowledge('u1', 'checked');
    expect(a.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(a.acknowledgedBy).toBe('u1');
    expect(a.diagnosticNote).toBe('checked');
  });

  it('rejects resolve without acknowledgement', () => {
    const a = make();
    expect(() => a.resolve()).toThrow(DomainInvariantException);
  });

  it('resolve() after acknowledge reaches RESOLVED', () => {
    const a = make();
    a.acknowledge('u1', 'ok');
    a.resolve();
    expect(a.status).toBe(AlertStatus.RESOLVED);
    expect(a.resolvedAt).not.toBeNull();
  });

  it('rejects acknowledge on already-acknowledged alert', () => {
    const a = make();
    a.acknowledge('u1', 'ok');
    expect(() => a.acknowledge('u2', 'again')).toThrow(DomainInvariantException);
  });
});