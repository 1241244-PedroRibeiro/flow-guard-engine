import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { checkDatabaseHealth } from '../../../infrastructure/persistence/connection';
import { Public } from '../middlewares/decorators';

export interface HealthResponseDTO {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  database: 'connected' | 'in-memory-test' | 'unreachable';
}

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  public async getHealth(): Promise<HealthResponseDTO> {
    const isTestEnv = process.env.NODE_ENV === 'test' && process.env.TEST_USE_PG !== 'true';

    if (isTestEnv) {
      return {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: 'in-memory-test',
      };
    }

    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      throw new ServiceUnavailableException('PostgreSQL connection pool is unreachable.');
    }

    return {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      database: 'connected',
    };
  }
}