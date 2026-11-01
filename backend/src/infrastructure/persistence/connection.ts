import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

let sharedPool: Pool | null = null;

export function buildPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 5000),
    };
  }

  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'flowguard_user',
    password: process.env.DB_PASSWORD ?? 'flowguard_password',
    database: process.env.DB_NAME ?? 'flowguard_db',
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS ?? 5000),
  };
}

/**
 * Returns the singleton PostgreSQL connection pool (ADR-0003).
 */
export function getDatabasePool(): Pool {
  if (!sharedPool) {
    sharedPool = new Pool(buildPoolConfig());

    sharedPool.on('error', (err: Error) => {
      console.error('[FlowGuard DB Pool] Unexpected error on idle PostgreSQL client:', err.message);
    });
  }

  return sharedPool;
}

/**
 * Executes a parameterized SQL query directly on the shared pool.
 */
export async function executeQuery<T extends QueryResultRow = any>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const pool = getDatabasePool();
  return pool.query<T>(sql, params);
}

/**
 * Executes an atomic callback within an explicit ACID transaction (BEGIN ... COMMIT / ROLLBACK).
 * Used for multi-table telemetry breach alerts and row-locked stock adjustments (SELECT ... FOR UPDATE).
 */
export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifies database connectivity for the /api/v1/health readiness probe.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const pool = getDatabasePool();
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully closes the connection pool during application shutdown or test teardown.
 */
export async function closeDatabasePool(): Promise<void> {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

// Exportação explícita da instância para injeção no NestJS (AppModule)
export const pool = getDatabasePool();