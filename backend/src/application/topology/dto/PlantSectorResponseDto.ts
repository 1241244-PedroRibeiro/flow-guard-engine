import { PlantSector } from '../../../domain/topology/PlantSector';

export interface PlantSectorResponseDto {
  id: string;
  sectorCode: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export function toPlantSectorResponseDto(sector: PlantSector): PlantSectorResponseDto {
  return {
    id: sector.id,
    sectorCode: sector.sectorCode.value,
    name: sector.name.value,
    description: sector.description,
    isActive: sector.isActive,
  };
}