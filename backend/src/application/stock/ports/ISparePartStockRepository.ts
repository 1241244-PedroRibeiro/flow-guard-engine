import { SparePartStock } from '../../../domain/stock/SparePartStock';

export type MovementType = 'REPLENISHMENT' | 'CONSUMPTION';

export interface ISparePartStockRepository {
  findById(id: string): Promise<SparePartStock | null>;
  findByPartCode(partCode: string): Promise<SparePartStock | null>;
  findAll(): Promise<SparePartStock[]>;
  save(part: SparePartStock): Promise<void>;
  
  /**
   * AC2 & AC3: Atomic stock adjustment with pessimistic row locking.
   * Runs `SELECT ... FOR UPDATE`, applies domain mutation, updates balance, 
   * and inserts a spare_part_movements row in a single ACID transaction.
   */
  adjustStockWithLock(
    partId: string,
    type: MovementType,
    units: number,
    reason: string,
    userId: string,
  ): Promise<SparePartStock>;
}