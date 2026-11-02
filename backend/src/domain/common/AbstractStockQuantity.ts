import { DomainInvariantException } from './exceptions/DomainInvariantException';

export class AbstractStockQuantity {
  private constructor(private readonly units: number) {}

  static create(units: number): AbstractStockQuantity {
    if (!Number.isInteger(units) || units < 0) {
      throw new DomainInvariantException('AbstractStockQuantity must be a non-negative integer.');
    }
    return new AbstractStockQuantity(units);
  }

  get value(): number { return this.units; }

  add(other: AbstractStockQuantity): AbstractStockQuantity {
    return AbstractStockQuantity.create(this.units + other.value);
  }

  subtract(other: AbstractStockQuantity): AbstractStockQuantity {
    if (this.units < other.value) {
      throw new DomainInvariantException('Insufficient spare-part stock units available.');
    }
    return AbstractStockQuantity.create(this.units - other.value);
  }

  isGreaterThanOrEqual(other: AbstractStockQuantity): boolean {
    return this.units >= other.value;
  }
}