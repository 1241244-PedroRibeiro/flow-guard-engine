import { randomUUID } from 'node:crypto';
import { ResourceConflictException } from '../../domain/common/exceptions/ResourceConflictException';
import { EntityNotFoundException } from '../../domain/common/exceptions/EntityNotFoundException';
import { AbstractStockQuantity } from '../../domain/common/AbstractStockQuantity';
import { PartCode } from '../../domain/common/PartCode';
import { SparePartStock } from '../../domain/stock/SparePartStock';
import { ISparePartStockRepository, MovementType } from './ports/ISparePartStockRepository';
import { CreateSparePartCommand } from './dto/CreateSparePartCommand';
import { StockAdjustmentCommand } from './dto/StockAdjustmentCommand';
import { SparePartStockResponseDto } from './dto/SparePartStockResponseDto';

export class SparePartsStockService {
  constructor(private readonly repo: ISparePartStockRepository) {}

  async register(cmd: CreateSparePartCommand): Promise<SparePartStockResponseDto> {
    const partCode = PartCode.create(cmd.partCode);
    
    const existing = await this.repo.findByPartCode(partCode.value);
    if (existing) {
      throw new ResourceConflictException(`Spare part with code ${partCode.value} already exists.`);
    }

    const initialStock = AbstractStockQuantity.create(cmd.initialStockUnits);
    const part = SparePartStock.register(partCode, cmd.name, initialStock);

    await this.repo.save(part);
    return this.toDto(part);
  }

  async listAll(): Promise<SparePartStockResponseDto[]> {
    const parts = await this.repo.findAll();
    return parts.map(this.toDto);
  }

  async replenish(cmd: StockAdjustmentCommand): Promise<SparePartStockResponseDto> {
    const part = await this.repo.findById(cmd.partId);
    if (!part) throw new EntityNotFoundException(`SparePartStock ${cmd.partId} not found.`);

    const updatedPart = await this.repo.adjustStockWithLock(
      cmd.partId,
      'REPLENISHMENT',
      cmd.units,
      cmd.reason,
      cmd.userId,
    );
    return this.toDto(updatedPart);
  }

  async consume(cmd: StockAdjustmentCommand): Promise<SparePartStockResponseDto> {
    const part = await this.repo.findById(cmd.partId);
    if (!part) throw new EntityNotFoundException(`SparePartStock ${cmd.partId} not found.`);

    const updatedPart = await this.repo.adjustStockWithLock(
      cmd.partId,
      'CONSUMPTION',
      cmd.units,
      cmd.reason,
      cmd.userId,
    );
    return this.toDto(updatedPart);
  }

  private toDto(part: SparePartStock): SparePartStockResponseDto {
    return {
      id: part.id,
      partCode: part.partCode.value,
      name: part.name,
      stockUnits: part.stockUnits.value,
      updatedAt: part.updatedAt.toISOString(),
    };
  }
}