import { PlantSector } from '../../../../src/domain/topology/PlantSector';
import { DomainError } from '../../../../src/domain/common/exceptions/DomainError';

describe('PlantSector Aggregate', () => {
  const validParams = { sectorCode: 'sec-log-01', name: 'Logistics A', description: 'Main sector' };

  it('normalizes sectorCode to uppercase and starts active', () => {
    const sector = PlantSector.create(validParams);
    expect(sector.sectorCode.value).toBe('SEC-LOG-01');
    expect(sector.isActive).toBe(true);
  });

  it('rejects invalid sectorCode length', () => {
    expect(() => PlantSector.create({ ...validParams, sectorCode: 'A' })).toThrow(DomainError);
    expect(() => PlantSector.create({ ...validParams, sectorCode: 'A'.repeat(31) })).toThrow(DomainError);
  });

  it('updates details', () => {
    const sector = PlantSector.create(validParams);
    sector.updateDetails('New Name', 'New Desc');
    expect(sector.name.value).toBe('New Name');
    expect(sector.description).toBe('New Desc');
  });

  it('handles lifecycle transitions', () => {
    const sector = PlantSector.create(validParams);
    sector.deactivate();
    expect(sector.isActive).toBe(false);
    sector.activate();
    expect(sector.isActive).toBe(true);
  });
});