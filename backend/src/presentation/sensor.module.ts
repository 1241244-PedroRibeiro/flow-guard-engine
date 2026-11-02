import { Module } from '@nestjs/common';
import { SensorNodeController } from './http/controllers/SensorNodeController';
import { TelemetryIngestionController } from './http/controllers/TelemetryIngestionController';
import { SensorManagementService } from '../application/sensor/SensorManagementService';
import { TelemetryIngestionService } from '../application/sensor/TelemetryIngestionService';
import { TelemetryEvaluationEngine } from '../domain/sensor/TelemetryEvaluationEngine';
import { PostgresSensorTelemetryRepository } from '../infrastructure/persistence/repositories/PostgresSensorTelemetryRepository';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { pool } from '../infrastructure/persistence/connection';

@Module({
    controllers: [
        SensorNodeController,
        TelemetryIngestionController,
    ],
    providers: [
        {
            provide: 'ITokenService',
            useFactory: () => new JwtTokenService(),
        },
        {
            provide: 'ISensorTelemetryRepository',
            useFactory: () => new PostgresSensorTelemetryRepository(pool),
        },
        {
            // Stateful singleton — UMA instância por processo (ADR-0004 / §12 KB).
            // Warm-up is delegated to the repo's findRecentRawValues for deterministic
            // hydration across restarts (Milestone 1 will optimise to bootstrapWindowState).
            provide: TelemetryEvaluationEngine,
            useFactory: (repo: PostgresSensorTelemetryRepository) =>
                new TelemetryEvaluationEngine(async (sensorId, capacity) =>
                    repo.findRecentRawValues(sensorId, capacity),
                ),
            inject: ['ISensorTelemetryRepository'],
        },
        {
            provide: SensorManagementService,
            useFactory: (repo) => new SensorManagementService(repo),
            inject: ['ISensorTelemetryRepository'],
        },
        {
            provide: TelemetryIngestionService,
            useFactory: (repo, engine) => new TelemetryIngestionService(repo, engine),
            inject: ['ISensorTelemetryRepository', TelemetryEvaluationEngine],
        },
    ],
    exports: [SensorManagementService, TelemetryIngestionService],
})
export class SensorModule {}