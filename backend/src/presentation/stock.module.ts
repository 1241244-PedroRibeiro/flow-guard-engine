import { Module } from '@nestjs/common';
import { SparePartStockController } from './http/controllers/SparePartStockController';
import { SparePartsStockService } from '../application/stock/SparePartsStockService';
import { PostgresSparePartStockRepository } from '../infrastructure/persistence/repositories/PostgresSparePartStockRepository';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { pool } from '../infrastructure/persistence/connection';

@Module({
  controllers: [SparePartStockController],
  providers: [
    {
      provide: 'ITokenService',
      useFactory: () => new JwtTokenService(),
    },
    {
      provide: 'ISparePartStockRepository',
      useFactory: () => new PostgresSparePartStockRepository(pool),
    },
    {
      provide: SparePartsStockService,
      useFactory: (repo) => new SparePartsStockService(repo),
      inject: ['ISparePartStockRepository'],
    },
  ],
  exports: [SparePartsStockService],
})
export class StockModule {}