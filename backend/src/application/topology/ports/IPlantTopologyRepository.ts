import { PlantSector } from '../../../domain/topology/PlantSector';
import { ConveyorLine } from '../../../domain/topology/ConveyorLine';

export interface ConveyorLineHealthSummary {
  id: string;
  sectorId: string;
  sectorCode: string;
  lineCode: string;
  name: string;
  operationalStatus: string;
  isActive: boolean;
  version: number;
  activeSensorCount: number;
  openWarningAlertCount: number;
  openCriticalAlertCount: number;
  updatedAt: string;
}

export interface IPlantTopologyRepository {
  // Sectors
  findAllSectors(isActive?: boolean): Promise<PlantSector[]>;
  findSectorById(id: string): Promise<PlantSector | null>;
  saveSector(sector: PlantSector): Promise<void>;
  deleteSector(id: string): Promise<void>;

  // Lines
  findLineById(id: string): Promise<ConveyorLine | null>;
  saveLine(line: ConveyorLine): Promise<void>;
  deleteLine(id: string): Promise<void>;
  
  // CQRS View Queries
  findLineHealthSummaries(filters: { sectorId?: string; operationalStatus?: string }): Promise<ConveyorLineHealthSummary[]>;
  findLineHealthSummaryById(id: string): Promise<ConveyorLineHealthSummary | null>;
}