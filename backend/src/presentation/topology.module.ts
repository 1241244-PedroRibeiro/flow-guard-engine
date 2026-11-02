import { Module } from '@nestjs/common';
import { PlantTopologyService } from '../application/topology/PlantTopologyService';
import { PostgresPlantTopologyRepository } from '../infrastructure/persistence/repositories/PostgresPlantTopologyRepository';
import { PlantSectorController } from './http/controllers/PlantSectorController';
import { ConveyorLineController } from './http/controllers/ConveyorLineController';
import { pool } from '../infrastructure/persistence/connection';

@Module({
  controllers: [PlantSectorController, ConveyorLineController],
  providers: [
    {
      provide: 'IPlantTopologyRepository',
      useFactory: () => new PostgresPlantTopologyRepository(pool),
    },
    {
      provide: PlantTopologyService,
      useFactory: (repo) => new PlantTopologyService(repo),
      inject: ['IPlantTopologyRepository'],
    }
  ],
})
export class TopologyModule {}