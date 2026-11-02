import { IPlantTopologyRepository, ConveyorLineHealthSummary } from '../../../src/application/topology/ports/IPlantTopologyRepository';
import { PlantSector } from '../../../src/domain/topology/PlantSector';
import { ConveyorLine } from '../../../src/domain/topology/ConveyorLine';
import { ResourceConflictException } from '../../../src/domain/common/exceptions/ResourceConflictException';

export class InMemoryPlantTopologyRepository implements IPlantTopologyRepository {
  private sectors = new Map<string, PlantSector>();
  private lines = new Map<string, ConveyorLine>();

  async findAllSectors(isActive?: boolean): Promise<PlantSector[]> {
    return Array.from(this.sectors.values()).filter(s => isActive === undefined || s.isActive === isActive);
  }
  async findSectorById(id: string): Promise<PlantSector | null> { return this.sectors.get(id) ?? null; }
  async saveSector(sector: PlantSector): Promise<void> {
    for (const s of this.sectors.values()) {
      if (s.sectorCode.value === sector.sectorCode.value && s.id !== sector.id) {
        throw new ResourceConflictException('Sector code exists');
      }
    }
    this.sectors.set(sector.id, sector);
  }
  async deleteSector(id: string): Promise<void> {
    for (const l of this.lines.values()) {
      if (l.sectorId === id) throw new ResourceConflictException('Referenced by lines');
    }
    this.sectors.delete(id);
  }

  async findLineById(id: string): Promise<ConveyorLine | null> { return this.lines.get(id) ?? null; }
  async saveLine(line: ConveyorLine): Promise<void> {
    this.lines.set(line.id, line);
  }
  async deleteLine(id: string): Promise<void> { this.lines.delete(id); }

  async findLineHealthSummaries(filters: any): Promise<ConveyorLineHealthSummary[]> {
    return Array.from(this.lines.values()).map(l => ({
      id: l.id, sectorId: l.sectorId, sectorCode: 'SEC', lineCode: l.lineCode.value,
      name: l.name.value, operationalStatus: l.operationalStatus, isActive: l.isActive,
      version: l.version, activeSensorCount: 0, openWarningAlertCount: 0,
      openCriticalAlertCount: 0, updatedAt: new Date().toISOString()
    }));
  }
  async findLineHealthSummaryById(id: string): Promise<ConveyorLineHealthSummary | null> {
    const summaries = await this.findLineHealthSummaries({});
    return summaries.find(s => s.id === id) ?? null;
  }
}