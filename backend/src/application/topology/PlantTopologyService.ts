import { IPlantTopologyRepository, ConveyorLineHealthSummary } from './ports/IPlantTopologyRepository';
import { PlantSector } from '../../domain/topology/PlantSector';
import { ConveyorLine } from '../../domain/topology/ConveyorLine';
import { CreatePlantSectorCommand } from './dto/CreatePlantSectorCommand';
import { CreateConveyorLineCommand } from './dto/CreateConveyorLineCommand';
import { UpdateLineOperationalStatusCommand } from './dto/UpdateLineOperationalStatusCommand';
import { UpdatePlantSectorCommand } from './dto/UpdatePlantSectorCommand';
import { PlantSectorResponseDto, toPlantSectorResponseDto } from './dto/PlantSectorResponseDto';
import { EntityNotFoundException } from '../../domain/common/exceptions/EntityNotFoundException';
import { DomainError } from '../../domain/common/exceptions/DomainError';

export class PlantTopologyService {
  constructor(private readonly topologyRepo: IPlantTopologyRepository) {}

  // ================= SECTORS =================

  async createSector(command: CreatePlantSectorCommand): Promise<PlantSectorResponseDto> {
    const sector = PlantSector.create({
      sectorCode: command.sectorCode,
      name: command.name,
      description: command.description,
    });
    
    await this.topologyRepo.saveSector(sector);
    return toPlantSectorResponseDto(sector);
  }

  async findAllSectors(isActive?: boolean): Promise<PlantSectorResponseDto[]> {
    const sectors = await this.topologyRepo.findAllSectors(isActive);
    return sectors.map(toPlantSectorResponseDto);
  }

  async findSectorById(id: string): Promise<PlantSectorResponseDto> {
    const sector = await this.topologyRepo.findSectorById(id);
    if (!sector) {
      throw new EntityNotFoundException('Plant Sector not found');
    }
    return toPlantSectorResponseDto(sector);
  }

  async updateSector(id: string, command: UpdatePlantSectorCommand): Promise<PlantSectorResponseDto> {
    const sector = await this.topologyRepo.findSectorById(id);
    if (!sector) {
      throw new EntityNotFoundException('Plant Sector not found');
    }

    sector.updateDetails(command.name, command.description);
    await this.topologyRepo.saveSector(sector);
    return toPlantSectorResponseDto(sector);
  }

  async deleteSector(id: string): Promise<void> {
    const sector = await this.topologyRepo.findSectorById(id);
    if (!sector) {
      throw new EntityNotFoundException('Plant Sector not found');
    }
    await this.topologyRepo.deleteSector(id);
  }

  // ================= CONVEYOR LINES =================

  async createConveyorLine(command: CreateConveyorLineCommand): Promise<ConveyorLineHealthSummary> {
    const sector = await this.topologyRepo.findSectorById(command.sectorId);
    if (!sector) {
      throw new EntityNotFoundException('Plant Sector not found');
    }

    const line = ConveyorLine.create({
      sectorId: sector.id,
      lineCode: command.lineCode,
      name: command.name,
    });

    await this.topologyRepo.saveLine(line);
    
    const summary = await this.topologyRepo.findLineHealthSummaryById(line.id);
    if (!summary) {
      throw new DomainError('Failed to retrieve health summary for newly created line');
    }
    return summary;
  }

  async findLineHealthSummaries(filters: { sectorId?: string; operationalStatus?: string }): Promise<ConveyorLineHealthSummary[]> {
    return this.topologyRepo.findLineHealthSummaries(filters);
  }

  async findLineSummaryById(id: string): Promise<ConveyorLineHealthSummary> {
    const summary = await this.topologyRepo.findLineHealthSummaryById(id);
    if (!summary) {
      throw new EntityNotFoundException('Conveyor Line not found');
    }
    return summary;
  }

  async updateLineStatus(id: string, command: UpdateLineOperationalStatusCommand): Promise<ConveyorLineHealthSummary> {
    const line = await this.topologyRepo.findLineById(id);
    if (!line) {
      throw new EntityNotFoundException('Conveyor Line not found');
    }

    line.updateStatus(command.operationalStatus, command.expectedVersion);
    await this.topologyRepo.saveLine(line);

    const updatedSummary = await this.topologyRepo.findLineHealthSummaryById(line.id);
    if (!updatedSummary) {
      throw new DomainError('Failed to retrieve health summary for updated line');
    }
    return updatedSummary;
  }

  async deleteLine(id: string): Promise<void> {
    const line = await this.topologyRepo.findLineById(id);
    if (!line) {
      throw new EntityNotFoundException('Conveyor Line not found');
    }
    await this.topologyRepo.deleteLine(id);
  }
}