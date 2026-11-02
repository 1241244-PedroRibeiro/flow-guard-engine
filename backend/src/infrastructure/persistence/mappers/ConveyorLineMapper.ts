import { ConveyorLine } from '../../../domain/topology/ConveyorLine';
import { LineStatus } from '../../../domain/topology/LineStatus';

export interface ConveyorLineRow {
  id: string;
  sector_id: string;
  line_code: string;
  name: string;
  operational_status: string;
  is_active: boolean;
  version: number;
}

export class ConveyorLineMapper {
  static toDomain(row: ConveyorLineRow): ConveyorLine {
    return ConveyorLine.reconstitute({
      id: row.id,
      sectorId: row.sector_id,
      lineCode: row.line_code,
      name: row.name,
      operationalStatus: row.operational_status as LineStatus,
      isActive: row.is_active,
      version: row.version,
    });
  }

  static toPersistence(line: ConveyorLine): any {
    return {
      id: line.id,
      sector_id: line.sectorId,
      line_code: line.lineCode.value,
      name: line.name.value,
      operational_status: line.operationalStatus,
      is_active: line.isActive,
      version: line.version,
    };
  }
}