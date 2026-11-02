import { randomUUID } from 'node:crypto';
import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';
import { AbstractStockQuantity } from '../common/AbstractStockQuantity';
import { PartCode } from '../common/PartCode';

export interface SparePartStockProps {
  id: string;
  partCode: PartCode;
  name: string;
  stockUnits: AbstractStockQuantity;
  updatedAt: Date;
}

export class SparePartStock {
  private constructor(private readonly props: SparePartStockProps) {}

  static register(partCode: PartCode, name: string, initialStockUnits: AbstractStockQuantity): SparePartStock {
    if (!name || name.trim().length === 0) {
      throw new DomainInvariantException('SparePartStock name must be non-empty.');
    }
    return new SparePartStock({
      id: randomUUID(),
      partCode,
      name: name.trim(),
      stockUnits: initialStockUnits,
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: SparePartStockProps): SparePartStock {
    return new SparePartStock(props);
  }

  get id(): string { return this.props.id; }
  get partCode(): PartCode { return this.props.partCode; }
  get name(): string { return this.props.name; }
  get stockUnits(): AbstractStockQuantity { return this.props.stockUnits; }
  get updatedAt(): Date { return this.props.updatedAt; }

  replenish(amount: AbstractStockQuantity): void {
    if (amount.value <= 0) {
      throw new DomainInvariantException('Replenishment amount must be greater than zero.');
    }
    this.props.stockUnits = this.props.stockUnits.add(amount);
    this.touch();
  }

  consume(amount: AbstractStockQuantity): void {
    if (amount.value <= 0) {
      throw new DomainInvariantException('Consumption amount must be greater than zero.');
    }
    // AbstractStockQuantity.subtract throws if units > current balance
    this.props.stockUnits = this.props.stockUnits.subtract(amount);
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}