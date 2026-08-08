/**
 * Tracks malware-scan outcomes for uploaded objects:
 *   - `unscanned_objects`: uploaded WITHOUT a successful scan (fail-open).
 *   - `scanned_clean_objects`: scanned and confirmed clean.
 *
 * The two are mutually exclusive per object (a re-upload flips one to the
 * other). Absence from BOTH means "unknown" — e.g. uploaded before scanning
 * existed or while it was disabled — and the UI shows no scan icon.
 */

import { query } from './db';

/** Flag an object as uploaded-but-unscanned (upsert). */
export async function markObjectUnscanned(
  bucketId: number,
  objectKey: string,
  reason?: string
): Promise<void> {
  await query(
    `INSERT INTO unscanned_objects (bucket_id, object_key, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (bucket_id, object_key)
     DO UPDATE SET reason = EXCLUDED.reason, created_at = CURRENT_TIMESTAMP`,
    [bucketId, objectKey, reason ?? null]
  );
}

/** Clear any unscanned flag for an object (e.g. after a clean re-upload). */
export async function clearUnscannedFlag(bucketId: number, objectKey: string): Promise<void> {
  await query(
    'DELETE FROM unscanned_objects WHERE bucket_id = $1 AND object_key = $2',
    [bucketId, objectKey]
  );
}

/** Return the subset of the given keys that are flagged unscanned for this bucket. */
export async function getUnscannedKeys(
  bucketId: number,
  keys: string[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const result = await query<{ object_key: string }>(
    `SELECT object_key FROM unscanned_objects
     WHERE bucket_id = $1 AND object_key = ANY($2::text[])`,
    [bucketId, keys]
  );
  return new Set(result.rows.map((r) => r.object_key));
}

/** Record an object as scanned and clean (upsert). */
export async function markObjectClean(
  bucketId: number,
  objectKey: string
): Promise<void> {
  await query(
    `INSERT INTO scanned_clean_objects (bucket_id, object_key)
     VALUES ($1, $2)
     ON CONFLICT (bucket_id, object_key)
     DO UPDATE SET created_at = CURRENT_TIMESTAMP`,
    [bucketId, objectKey]
  );
}

/** Clear any clean flag for an object (e.g. after an unscanned re-upload). */
export async function clearCleanFlag(bucketId: number, objectKey: string): Promise<void> {
  await query(
    'DELETE FROM scanned_clean_objects WHERE bucket_id = $1 AND object_key = $2',
    [bucketId, objectKey]
  );
}

/** Return the subset of the given keys that are recorded scanned-clean for this bucket. */
export async function getCleanKeys(
  bucketId: number,
  keys: string[]
): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const result = await query<{ object_key: string }>(
    `SELECT object_key FROM scanned_clean_objects
     WHERE bucket_id = $1 AND object_key = ANY($2::text[])`,
    [bucketId, keys]
  );
  return new Set(result.rows.map((r) => r.object_key));
}
