'use server';

import { getCurrentUserOptional } from '@/lib/session';
import { createAuditLog } from '@/lib/audit';
import { getLogoRecord, setLogoRecord, deleteLogoRecord } from '@/lib/settings';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

// Served by the /api/logo route handler (DB-backed).
const LOGO_PUBLIC_URL = '/api/logo';

export async function uploadLogo(
  formData: FormData,
  actor: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get('logo') as File;
    if (!file || file.size === 0) return { success: false, error: 'No file provided' };

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { success: false, error: 'Invalid file type. Use PNG, JPG, SVG or WebP.' };
    }
    if (file.size > MAX_SIZE) return { success: false, error: 'File too large. Max 2MB.' };

    const buffer = Buffer.from(await file.arrayBuffer());

    const user = await getCurrentUserOptional();
    await setLogoRecord(file.type, buffer, user?.id);

    await createAuditLog({
      user_id: user?.id,
      username: actor,
      action: 'settings.logo_upload',
      resource_type: 'settings',
      details: { content_type: file.type, size_kb: parseFloat((file.size / 1024).toFixed(1)) },
      status: 'success',
    });
    return { success: true, url: LOGO_PUBLIC_URL };
  } catch (err) {
    console.error('[Logo] Upload error:', err);
    return { success: false, error: 'Upload failed' };
  }
}

export async function getLogoUrl(): Promise<string | null> {
  try {
    const logo = await getLogoRecord();
    return logo ? LOGO_PUBLIC_URL : null;
  } catch {
    return null;
  }
}

export async function removeLogo(actor: string): Promise<void> {
  try {
    await deleteLogoRecord();
    const user = await getCurrentUserOptional();
    await createAuditLog({
      user_id: user?.id,
      username: actor,
      action: 'settings.logo_remove',
      resource_type: 'settings',
      status: 'success',
    });
  } catch (err) {
    console.error('[Logo] Remove error:', err);
  }
}
