/**
 * Test DB helper — connects to the same PostgreSQL the app uses so specs can
 * assert what actually landed in the `buckets` / `bucket_assignments` tables.
 *
 * This is what makes these tests catch the reported bugs:
 *  - "bucket not deleted from DB"  -> we assert is_active flips (soft delete)
 *  - "bucket not created on EC2"   -> we assert a row exists after create
 */
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Fall back to parsing .env (tests may run without Next's env loading).
  try {
    const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of envFile.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
      if (m) return m[1];
    }
  } catch {
    /* ignore */
  }
  throw new Error('DATABASE_URL not found in env or .env');
}

export const pool = new Pool({ connectionString: loadDatabaseUrl() });

export async function closePool() {
  await pool.end();
}

/** All rows for a bucket alias, regardless of is_active (so we can see soft-deletes). */
export async function getBucketRowsByAlias(alias: string) {
  const { rows } = await pool.query(
    'SELECT id, alias, bucket_name, region, user_id, is_active FROM buckets WHERE alias = $1 ORDER BY id',
    [alias]
  );
  return rows as Array<{
    id: number;
    alias: string;
    bucket_name: string;
    region: string;
    user_id: number;
    is_active: boolean;
  }>;
}

export async function getUserByUsername(username: string) {
  const { rows } = await pool.query(
    'SELECT id, username, role, is_active FROM users WHERE username = $1',
    [username]
  );
  return rows[0] as { id: number; username: string; role: string; is_active: boolean } | undefined;
}

export async function getAssignment(bucketId: number, userId: number) {
  const { rows } = await pool.query(
    'SELECT id, bucket_id, user_id, permission FROM bucket_assignments WHERE bucket_id = $1 AND user_id = $2',
    [bucketId, userId]
  );
  return rows[0] as { id: number; bucket_id: number; user_id: number; permission: string } | undefined;
}
