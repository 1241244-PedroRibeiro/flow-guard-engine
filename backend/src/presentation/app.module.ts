import { Module } from '@nestjs/common';
import { HealthController } from './http/controllers/HealthController';
import { AuthModule } from './auth.module';
import { UserModule } from './user.module';
import { TopologyModule } from './topology.module';
import { SensorModule } from './sensor.module';
import { AlertModule } from './alert.module';
import { StockModule } from './stock.module';

@Module({
  imports: [
    AuthModule,
    UserModule,
    TopologyModule,
    SensorModule,
    AlertModule,
    StockModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}