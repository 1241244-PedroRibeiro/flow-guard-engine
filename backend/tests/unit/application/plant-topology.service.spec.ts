import { PlantTopologyService } from '../../../src/application/topology/PlantTopologyService';
import { InMemoryPlantTopologyRepository } from '../../helpers/fakes/InMemoryPlantTopologyRepository';
import { LineStatus } from '../../../src/domain/topology/LineStatus';
import { EntityNotFoundException } from '../../../src/domain/common/exceptions/EntityNotFoundException';
import { ResourceConflictException } from '../../../src/domain/common/exceptions/ResourceConflictException';

describe('PlantTopologyService', () => {
  let service: PlantTopologyService;
  let repo: InMemoryPlantTopologyRepository;

  beforeEach(() => {
    repo = new InMemoryPlantTopologyRepository();
    service = new PlantTopologyService(repo);
  });

  it('creates a sector and a line successfully', async () => {
    const sector = await service.createSector({ sectorCode: 'SEC-A', name: 'Sector A' });
    const line = await service.createConveyorLine({ sectorId: sector.id, lineCode: 'L-A', name: 'Line A' });
    expect(line.sectorId).toBe(sector.id);
    expect(line.operationalStatus).toBe(LineStatus.RUNNING);
  });

  it('rejects line creation if sector is missing', async () => {
    await expect(service.createConveyorLine({ sectorId: 'missing', lineCode: 'L-A', name: 'Line A' }))
      .rejects.toThrow(EntityNotFoundException);
  });

  it('prevents deleting a sector with lines', async () => {
    const sector = await service.createSector({ sectorCode: 'SEC-A', name: 'Sector A' });
    await service.createConveyorLine({ sectorId: sector.id, lineCode: 'L-A', name: 'Line A' });
    
    await expect(service.deleteSector(sector.id)).rejects.toThrow(ResourceConflictException);
  });
});