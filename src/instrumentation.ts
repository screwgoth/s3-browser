/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Ensures required DB tables exist without requiring a manual migration step.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { query } = await import('./lib/db');

      await query(`
        CREATE TABLE IF NOT EXISTS bucket_assignments (
          id SERIAL PRIMARY KEY,
          bucket_id INTEGER NOT NULL REFERENCES buckets(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          permission VARCHAR(20) NOT NULL DEFAULT 'read',
          assigned_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(bucket_id, user_id)
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_bucket_assignments_bucket_id
        ON bucket_assignments(bucket_id)
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_bucket_assignments_user_id
        ON bucket_assignments(user_id)
      `);

      console.log('[DB] bucket_assignments schema ready');
    } catch (e) {
      console.error('[DB] Schema migration warning (bucket_assignments):', e);
    }
  }
}
