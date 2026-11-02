import { AbstractStockQuantity } from '../../../domain/common/AbstractStockQuantity';
import { PartCode } from '../../../domain/common/PartCode';
import { SparePartStock } from '../../../domain/stock/SparePartStock';

export interface SparePartStockRow {
  id: string;
  part_code: string;
  name: string;
  stock_units: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export class SparePartStockMapper {
  static toDomain(row: SparePartStockRow): SparePartStock {
    return SparePartStock.reconstitute({
      id: row.id,
      partCode: PartCode.create(row.part_code),
      name: row.name,
      stockUnits: AbstractStockQuantity.create(Number(row.stock_units)),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
    });
  }

  static toPersistence(part: SparePartStock): any {
    return {
      id: part.id,
      part_code: part.partCode.value,
      name: part.name,
      stock_units: part.stockUnits.value,
      updated_at: part.updatedAt,
    };
  }
}