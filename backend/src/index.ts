import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { createApp } from './presentation';
import { closeDatabasePool, getDatabasePool } from './infrastructure/persistence/connection';

dotenv.config();

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);

  // Initialize PostgreSQL connection pool
  getDatabasePool();

  const app = await createApp();
  await app.enableShutdownHooks();
  await app.listen(port);

  console.log(`[FlowGuard Engine] REST API listening on http://localhost:${port}/api/v1`);

  const shutdown = async (signal: string) => {
    console.log(`[FlowGuard Engine] Received ${signal}. Closing HTTP server and DB pool...`);
    await app.close();
    await closeDatabasePool();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

if (require.main === module) {
  bootstrap().catch((err: Error) => {
    console.error('[FlowGuard Engine] Fatal bootstrap failure:', err);
    process.exit(1);
  });
}