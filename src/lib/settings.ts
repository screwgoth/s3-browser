/**
 * Application settings backed by the `app_settings` table (JSONB key/value).
 */

import { query } from '@/lib/db';

export interface BrandingSettings {
  title: string;
  subtitle: string;
  footer: string;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  title: 'S3 Navigator',
  subtitle: 'Secure S3 bucket management',
  footer: 'Secure S3 Bucket Management',
};

const BRANDING_KEY = 'branding';

/**
 * Read the branding settings, falling back to defaults for any missing field.
 */
export async function getBranding(): Promise<BrandingSettings> {
  try {
    const res = await query<{ value: Partial<BrandingSettings> }>(
      'SELECT value FROM app_settings WHERE key = $1',
      [BRANDING_KEY]
    );
    const stored = res.rows[0]?.value ?? {};
    return { ...DEFAULT_BRANDING, ...stored };
  } catch (err) {
    console.error('[Settings] Failed to read branding:', err);
    return DEFAULT_BRANDING;
  }
}

/**
 * Upsert the branding settings. Empty fields fall back to defaults.
 */
export async function setBranding(
  branding: BrandingSettings,
  updatedBy?: number
): Promise<BrandingSettings> {
  const value: BrandingSettings = {
    title: branding.title?.trim() || DEFAULT_BRANDING.title,
    subtitle: branding.subtitle?.trim() || DEFAULT_BRANDING.subtitle,
    footer: branding.footer?.trim() || DEFAULT_BRANDING.footer,
  };

  await query(
    `INSERT INTO app_settings (key, value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
    [BRANDING_KEY, JSON.stringify(value), updatedBy ?? null]
  );

  return value;
}

// ---------------------------------------------------------------------------
// Logo — stored as base64 bytes in app_settings so it survives redeploys and
// works with `output: 'standalone'` (the public/ dir is a build-time snapshot).
// Served via the /api/logo route handler.
// ---------------------------------------------------------------------------

const LOGO_KEY = 'logo';

interface StoredLogo {
  contentType: string;
  data: string; // base64-encoded bytes
}

export interface LogoRecord {
  contentType: string;
  buffer: Buffer;
}

/** Read the stored logo, or null if none is set. */
export async function getLogoRecord(): Promise<LogoRecord | null> {
  try {
    const res = await query<{ value: StoredLogo }>(
      'SELECT value FROM app_settings WHERE key = $1',
      [LOGO_KEY]
    );
    const stored = res.rows[0]?.value;
    if (!stored?.data || !stored?.contentType) return null;
    return { contentType: stored.contentType, buffer: Buffer.from(stored.data, 'base64') };
  } catch (err) {
    console.error('[Settings] Failed to read logo:', err);
    return null;
  }
}

/** Upsert the stored logo. */
export async function setLogoRecord(
  contentType: string,
  buffer: Buffer,
  updatedBy?: number
): Promise<void> {
  const value: StoredLogo = { contentType, data: buffer.toString('base64') };
  await query(
    `INSERT INTO app_settings (key, value, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`,
    [LOGO_KEY, JSON.stringify(value), updatedBy ?? null]
  );
}

/** Remove the stored logo. */
export async function deleteLogoRecord(): Promise<void> {
  await query('DELETE FROM app_settings WHERE key = $1', [LOGO_KEY]);
}
