/**
 * Database configuration and connection pool management (MySQL)
 * Requirements: NFR-1.3 (20 concurrent users), NFR-4.1 (auto-recovery within 30s)
 */

import mysql, { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { logger } from './logger';

// ----------------------------------------------------------------
// Pool configuration
// ----------------------------------------------------------------

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || 'localhost',
      port:               parseInt(process.env.DB_PORT || '3306', 10),
      database:           process.env.DB_NAME     || 'nova_salud',
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit:    parseInt(process.env.DB_POOL_MAX || '20', 10),
      queueLimit:         0,
      connectTimeout:     parseInt(process.env.DB_CONN_TIMEOUT || '5000', 10),
      timezone:           'Z',
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : undefined,
    });

    logger.info('MySQL connection pool created');
  }
  return pool;
}

// ----------------------------------------------------------------
// Health check
// ----------------------------------------------------------------

export async function checkDatabaseHealth(): Promise<boolean> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [rows] = await getPool().query<RowDataPacket[]>('SELECT 1 AS health_check');
      if (rows[0]?.health_check === 1) {
        logger.debug('Database health check passed');
        return true;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Database health check failed (attempt ${attempt}/${MAX_RETRIES})`, { error: message });
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }

  logger.error('Database health check failed after all retries');
  return false;
}

// ----------------------------------------------------------------
// Query helpers
// ----------------------------------------------------------------

export interface QueryResult<T = RowDataPacket> {
  rows: T[];
  rowCount: number;
}

/**
 * Executes a parameterised query.
 * Converts mysql2 result to a pg-compatible shape so existing services need minimal changes.
 */
export async function query<T extends RowDataPacket = RowDataPacket>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  // Convert PostgreSQL $1,$2 placeholders to MySQL ?
  const mysqlText = text.replace(/\$\d+/g, '?');
  try {
    const [rows, fields] = await getPool().query<T[]>(mysqlText, params);
    const duration = Date.now() - start;
    const rowCount = Array.isArray(rows) ? rows.length : 0;
    logger.debug('Query executed', { duration, rows: rowCount });
    void fields; // unused but destructured for clarity
    return { rows: Array.isArray(rows) ? rows : [], rowCount };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Query error', { text: mysqlText, error: message });
    throw err;
  }
}

export async function getClient(): Promise<PoolConnection> {
  return getPool().getConnection();
}

/**
 * Executes a callback inside a MySQL transaction.
 * Automatically commits on success and rolls back on error.
 * NFR-4.2: Transaction rollback on failure
 */
export async function withTransaction<T>(
  callback: (client: PoolConnection) => Promise<T>,
): Promise<T> {
  const client = await getClient();
  try {
    await client.beginTransaction();
    const result = await callback(client);
    await client.commit();
    return result;
  } catch (err) {
    await client.rollback();
    logger.error('Transaction rolled back', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------------------
// Graceful shutdown
// ----------------------------------------------------------------

export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing MySQL connection pool…');
    await pool.end();
    pool = null;
    logger.info('MySQL connection pool closed');
  }
}

// ----------------------------------------------------------------
// Utility
// ----------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PoolStats {
  totalCount:   number;
  idleCount:    number;
  waitingCount: number;
}

export function getPoolStats(): PoolStats {
  // mysql2 doesn't expose pool stats directly
  return { totalCount: 0, idleCount: 0, waitingCount: 0 };
}
