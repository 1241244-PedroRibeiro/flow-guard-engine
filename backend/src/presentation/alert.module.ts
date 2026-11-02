import { Module } from '@nestjs/common';
import { AnomalyAlertController } from './http/controllers/AnomalyAlertController';
import { AnomalyAlertService } from '../application/alert/AnomalyAlertService';
import { PostgresAnomalyAlertRepository } from '../infrastructure/persistence/repositories/PostgresAnomalyAlertRepository';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { pool } from '../infrastructure/persistence/connection';

@Module({
  controllers: [AnomalyAlertController],
  providers: [
    {
      provide: 'ITokenService',
      useFactory: () => new JwtTokenService(),
    },
    {
      provide: 'IAnomalyAlertRepository',
      useFactory: () => new PostgresAnomalyAlertRepository(pool),
    },
    {
      provide: AnomalyAlertService,
      useFactory: (repo) => new AnomalyAlertService(repo),
      inject: ['IAnomalyAlertRepository'],
    },
  ],
  exports: [AnomalyAlertService],
})
export class AlertModule {}