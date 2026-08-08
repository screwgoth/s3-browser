/**
 * Upload size limits. Client-safe — no DB or server-only imports so this can be
 * used from both Server Actions and client components.
 */

export const DEFAULT_MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Matches next.config.ts serverActions.bodySizeLimit (50mb). A per-bucket limit
// above this could never actually be uploaded, so admin input is clamped here.
export const MAX_CONFIGURABLE_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Resolve the effective per-file limit for a bucket (falls back to the default). */
export function effectiveMaxUploadSize(bucketMax?: number | null): number {
  return bucketMax && bucketMax > 0 ? bucketMax : DEFAULT_MAX_UPLOAD_SIZE;
}

/** Clamp an admin-provided limit (bytes) into the allowed range, or undefined to unset. */
export function clampUploadSize(bytes?: number | null): number | undefined {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes <= 0) {
    return undefined;
  }
  return Math.min(Math.floor(bytes), MAX_CONFIGURABLE_UPLOAD_SIZE);
}

/** Human-friendly MB label for a byte limit. */
export function formatMaxUploadSize(bytes?: number | null): string {
  const eff = effectiveMaxUploadSize(bytes);
  return `${(eff / (1024 * 1024)).toFixed(0)}MB`;
}
