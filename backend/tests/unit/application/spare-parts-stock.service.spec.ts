import { SparePartsStockService } from '../../../src/application/stock/SparePartsStockService';
import { InMemorySparePartStockRepository } from '../../helpers/fakes/InMemorySparePartStockRepository';
import { SparePartStock } from '../../../src/domain/stock/SparePartStock';
import { PartCode } from '../../../src/domain/common/PartCode';
import { AbstractStockQuantity } from '../../../src/domain/common/AbstractStockQuantity';
import { ResourceConflictException } from '../../../src/domain/common/exceptions/ResourceConflictException';
import { DomainInvariantException } from '../../../src/domain/common/exceptions/DomainInvariantException';

describe('SparePartsStockService', () => {
  let repo: InMemorySparePartStockRepository;
  let service: SparePartsStockService;

  beforeEach(() => {
    repo = new InMemorySparePartStockRepository();
    service = new SparePartsStockService(repo);
  });

  const seed = () => {
    const part = SparePartStock.register(PartCode.create('PRT-BRG-6204'), 'Bearing', AbstractStockQuantity.create(10));
    repo.parts.set(part.id, part);
    return part;
  };

  it('AC1 — registers a new spare part', async () => {
    const dto = await service.register({ partCode: 'PRT-NEW', name: 'New part', initialStockUnits: 5 });
    expect(dto.partCode).toBe('PRT-NEW');
    expect(dto.stockUnits).toBe(5);
  });

  it('AC1 — throws 409 on duplicate partCode', async () => {
    seed();
    await expect(service.register({ partCode: 'PRT-BRG-6204', name: 'Dup', initialStockUnits: 5 }))
      .rejects.toThrow(ResourceConflictException);
  });

  it('AC2 — rejects consumption when stock is insufficient', async () => {
    const part = seed(); // 10 units
    await expect(service.consume({ partId: part.id, units: 15, reason: 'Test', userId: 'u1' }))
      .rejects.toThrow(DomainInvariantException);
  });

  it('AC3 — replenishes stock and logs movement', async () => {
    const part = seed();
    const dto = await service.replenish({ partId: part.id, units: 5, reason: 'Restock', userId: 'u1' });
    expect(dto.stockUnits).toBe(15);
    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].type).toBe('REPLENISHMENT');
  });

  it('AC3 — consumes stock and logs movement', async () => {
    const part = seed();
    const dto = await service.consume({ partId: part.id, units: 2, reason: 'Repair', userId: 'u1' });
    expect(dto.stockUnits).toBe(8);
    expect(repo.movements).toHaveLength(1);
    expect(repo.movements[0].type).toBe('CONSUMPTION');
  });
});