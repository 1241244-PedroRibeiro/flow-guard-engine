import { ConveyorLineHealthSummary } from '../ports/IPlantTopologyRepository';

// Usa diretamente a interface do port, pois a resposta HTTP espelha a View CQRS
export type ConveyorLineResponseDto = ConveyorLineHealthSummary;