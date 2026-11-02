import { PlantSector } from '../../../domain/topology/PlantSector';

export interface PlantSectorRow {
  id: string;
  sector_code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export class PlantSectorMapper {
  static toDomain(row: PlantSectorRow): PlantSector {
    return PlantSector.reconstitute({
      id: row.id,
      sectorCode: row.sector_code,
      name: row.name,
      description: row.description,
      isActive: row.is_active,
    });
  }

  static toPersistence(sector: PlantSector): any {
    return {
      id: sector.id,
      sector_code: sector.sectorCode.value,
      name: sector.name.value,
      description: sector.description,
      is_active: sector.isActive,
    };
  }
}