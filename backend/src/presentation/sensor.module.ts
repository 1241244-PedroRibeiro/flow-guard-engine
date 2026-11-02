import { Module } from '@nestjs/common';
import { SensorNodeController } from './http/controllers/SensorNodeController';
import { SensorManagementService } from '../application/sensor/SensorManagementService';
import { PostgresSensorTelemetryRepository } from '../infrastructure/persistence/repositories/PostgresSensorTelemetryRepository';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { pool } from '../infrastructure/persistence/connection';

@Module({
    controllers: [SensorNodeController],
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
            provide: SensorManagementService,
            useFactory: (repo) => new SensorManagementService(repo),
            inject: ['ISensorTelemetryRepository'],
        },
    ],
    exports: [SensorManagementService],
})
export class SensorModule {}