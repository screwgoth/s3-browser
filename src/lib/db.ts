/**
 * Database connection pool and query utilities
 */

import { Pool, PoolClient, QueryResult } from 'pg';

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Execute a query with the pool
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn('Slow query detected:', {
        text,
        duration: `${duration}ms`,
        rows: res.rowCount,
      });
    }
    
    return res;
  } catch (error) {
    console.error('Database query error:', {
      text,
      params,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
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
 * Close the pool (for graceful shutdown)
 */
export async function close(): Promise<void> {
  await pool.end();
}

/**
 * Check database connection
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Export the pool for advanced use cases
export { pool };

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing database pool');
    await close();
  });
  
  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing database pool');
    await close();
  });
}
