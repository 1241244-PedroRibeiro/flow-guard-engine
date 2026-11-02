import { AnomalyAlert } from '../../../../src/domain/alert/AnomalyAlert';
import { AlertSeverity } from '../../../../src/domain/alert/AlertSeverity';
import { AlertStatus } from '../../../../src/domain/alert/AlertStatus';
import { ResourceConflictException } from '../../../../src/domain/common/exceptions/ResourceConflictException';
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
    a.acknowledge('u1', 'Checking motor');
    expect(a.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(a.acknowledgedBy).toBe('u1');
    expect(a.diagnosticNote).toBe('Checking motor');
  });

  it('rejects diagnostic note shorter than 3 chars', () => {
    const a = make();
    expect(() => a.acknowledge('u1', 'ok')).toThrow(DomainInvariantException);
  });

  it('rejects acknowledge on already-acknowledged alert (409 Conflict)', () => {
    const a = make();
    a.acknowledge('u1', 'Checked');
    expect(() => a.acknowledge('u2', 'Checking again')).toThrow(ResourceConflictException);
  });

  it('rejects resolve without acknowledgement (409 Conflict)', () => {
    const a = make();
    expect(() => a.resolve()).toThrow(ResourceConflictException);
  });

  it('resolve() after acknowledge reaches RESOLVED', () => {
    const a = make();
    a.acknowledge('u1', 'Checked');
    a.resolve();
    expect(a.status).toBe(AlertStatus.RESOLVED);
    expect(a.resolvedAt).not.toBeNull();
  });

  it('rejects resolve on already-resolved alert (409 Conflict)', () => {
    const a = make();
    a.acknowledge('u1', 'Checked');
    a.resolve();
    expect(() => a.resolve()).toThrow(ResourceConflictException);
  });
});