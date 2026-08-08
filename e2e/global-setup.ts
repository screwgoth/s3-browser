/**
 * Global setup: provision deterministic test accounts so specs can log in
 * without going through the one-time forced-password-change flow (that flow
 * is not what these tests exercise).
 *
 *  - admin        : reset to a known password, must_change_password = false
 *  - E2E_VIEWER   : created/reset as a `viewer` (non-admin), password known,
 *                   must_change_password = false
 *
 * It also clears any leftover test buckets/assignments from prior runs so the
 * suite is idempotent.
 */
import bcrypt from 'bcrypt';
import { pool, closePool } from './db';
import { ADMIN, VIEWER, TEST_BUCKET_ALIAS } from './fixtures';

const SALT_ROUNDS = 10; // matches src/lib/auth.ts

async function upsertUser(username: string, password: string, role: string) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, true, false)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   role = EXCLUDED.role,
                   is_active = true,
                   must_change_password = false`,
    [username, hash, role]
  );
}

async function globalSetup() {
  // Clean up test buckets (and their assignments cascade) from previous runs.
  await pool.query('DELETE FROM buckets WHERE alias = $1', [TEST_BUCKET_ALIAS]);

  await upsertUser(ADMIN.username, ADMIN.password, 'admin');
  await upsertUser(VIEWER.username, VIEWER.password, 'viewer');

  await closePool();
}

export default globalSetup;
