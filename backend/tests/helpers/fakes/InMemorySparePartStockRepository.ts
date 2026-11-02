import { ISparePartStockRepository, MovementType } from '../../../src/application/stock/ports/ISparePartStockRepository';
import { SparePartStock } from '../../../src/domain/stock/SparePartStock';
import { AbstractStockQuantity } from '../../../src/domain/common/AbstractStockQuantity';
import { EntityNotFoundException } from '../../../src/domain/common/exceptions/EntityNotFoundException';

export class InMemorySparePartStockRepository implements ISparePartStockRepository {
  public parts = new Map<string, SparePartStock>();
  public movements: any[] = [];
  public adjustmentCount = 0;

  async findById(id: string): Promise<SparePartStock | null> {
    return this.parts.get(id) ?? null;
  }

  async findByPartCode(partCode: string): Promise<SparePartStock | null> {
    const all = Array.from(this.parts.values());
    return all.find(p => p.partCode.value === partCode.toUpperCase()) ?? null;
  }

  async findAll(): Promise<SparePartStock[]> {
    return Array.from(this.parts.values());
  }

  async save(part: SparePartStock): Promise<void> {
    this.parts.set(part.id, part);
  }

  async adjustStockWithLock(
    partId: string, type: MovementType, units: number, reason: string, userId: string
  ): Promise<SparePartStock> {
    const part = this.parts.get(partId);
    if (!part) throw new EntityNotFoundException(`SparePartStock ${partId} not found.`);

    this.adjustmentCount++;
    const amount = AbstractStockQuantity.create(units);

    if (type === 'REPLENISHMENT') part.replenish(amount);
    else part.consume(amount); // Throws DomainInvariantException if insufficient

    this.movements.push({ partId, type, units, reason, userId });
    return part;
  }
}