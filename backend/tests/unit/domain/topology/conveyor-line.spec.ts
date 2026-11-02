import { ConveyorLine } from '../../../../src/domain/topology/ConveyorLine';
import { LineStatus } from '../../../../src/domain/topology/LineStatus';
import { DomainError } from '../../../../src/domain/common/exceptions/DomainError';

describe('ConveyorLine Aggregate', () => {
  const validParams = { sectorId: 'uuid-123', lineCode: 'line-01', name: 'Main Belt' };

  it('starts RUNNING with version 1', () => {
    const line = ConveyorLine.create(validParams);
    expect(line.operationalStatus).toBe(LineStatus.RUNNING);
    expect(line.isActive).toBe(true);
    expect(line.version).toBe(1);
  });

  it('increments version and updates status on successful transition', () => {
    const line = ConveyorLine.create(validParams);
    line.updateStatus(LineStatus.MAINTENANCE, 1);
    expect(line.operationalStatus).toBe(LineStatus.MAINTENANCE);
    expect(line.version).toBe(2);
  });

  it('enforces optimistic concurrency check', () => {
    const line = ConveyorLine.create(validParams);
    expect(() => line.updateStatus(LineStatus.MAINTENANCE, 2)).toThrow(DomainError);
  });

  it('forces DEACTIVATED status when deactivated', () => {
    const line = ConveyorLine.create(validParams);
    line.updateStatus(LineStatus.DEACTIVATED, 1);
    expect(line.isActive).toBe(false);
    expect(line.operationalStatus).toBe(LineStatus.DEACTIVATED);
  });

  it('rejects inconsistent state (active but DEACTIVATED)', () => {
    expect(() => ConveyorLine.reconstitute({
      id: 'uuid', sectorId: 'uuid', lineCode: 'l', name: 'n',
      operationalStatus: LineStatus.DEACTIVATED, isActive: true, version: 1
    })).toThrow(DomainError);
  });
});