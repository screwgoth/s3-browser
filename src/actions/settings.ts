'use server';

import { getCurrentUserOptional } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { getBranding, setBranding, DEFAULT_BRANDING, type BrandingSettings } from '@/lib/settings';

/**
 * Public read — used by the login page and headers. Never throws.
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    return await getBranding();
  } catch {
    return DEFAULT_BRANDING;
  }
}

/**
 * Admin-only write. Re-checks authorization server-side (client gating is UX-only).
 */
export async function updateBrandingSettings(
  branding: BrandingSettings
): Promise<{ success: boolean; branding?: BrandingSettings; error?: string }> {
  const user = await getCurrentUserOptional();
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Not authorized' };
  }

  try {
    const saved = await setBranding(branding, user.id);
    await createAuditLog({
      user_id: user.id,
      username: user.username,
      action: 'settings.branding_update',
      resource_type: 'settings',
      details: saved,
      status: 'success',
    });
    return { success: true, branding: saved };
  } catch (err) {
    console.error('[Settings] Branding update failed:', err);
    return { success: false, error: 'Failed to save branding settings' };
  }
}
