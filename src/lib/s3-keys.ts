/**
 * Pure key-safety helpers for S3 object mutations.
 *
 * Kept free of DB/session imports so they can be unit-tested directly. The
 * authorization layer that uses them lives in `s3-authz.ts`.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Max length of a single folder name segment. */
export const MAX_FOLDER_NAME_LENGTH = 255;

/**
 * Normalize a bucket's configured root folder to either '' (whole bucket) or a
 * prefix ending in '/'.
 */
export function normalizeRoot(root?: string | null): string {
  if (!root) return '';
  const trimmed = root.trim().replace(/^\/+/, '');
  if (trimmed === '') return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export type FolderNameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

/** Validate a single folder name (not a path). Returns the trimmed name. */
export function validateFolderName(name: string): FolderNameResult {
  const value = name.trim();
  if (value === '') {
    return { ok: false, message: 'Folder name cannot be empty.' };
  }
  if (value.includes('/')) {
    return { ok: false, message: 'Folder name cannot contain "/".' };
  }
  if (value === '.' || value === '..') {
    return { ok: false, message: 'Folder name cannot be "." or "..".' };
  }
  if (CONTROL_CHARS.test(value)) {
    return { ok: false, message: 'Folder name cannot contain control characters.' };
  }
  if (value.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      ok: false,
      message: `Folder name cannot exceed ${MAX_FOLDER_NAME_LENGTH} characters.`,
    };
  }
  return { ok: true, value };
}

/** Thrown when a key fails validation or escapes the bucket's root folder. */
export class UnsafeKeyError extends Error {
  constructor(message = 'Invalid object key.') {
    super(message);
    this.name = 'UnsafeKeyError';
  }
}

/**
 * Validate an object key and confirm it stays inside the bucket's root folder.
 * Returns the key unchanged on success; throws `UnsafeKeyError` otherwise.
 *
 * Every key reaching an AWS mutation call must pass through here.
 */
export function assertWithinRoot(root: string | null | undefined, key: string): string {
  if (typeof key !== 'string' || key === '') {
    throw new UnsafeKeyError();
  }
  if (CONTROL_CHARS.test(key)) {
    throw new UnsafeKeyError();
  }
  if (key.startsWith('/')) {
    throw new UnsafeKeyError();
  }

  // A folder key legitimately ends in '/', which would otherwise read as a
  // trailing empty segment.
  const forSegments = key.endsWith('/') ? key.slice(0, -1) : key;
  for (const segment of forSegments.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new UnsafeKeyError();
    }
  }

  const normalizedRoot = normalizeRoot(root);
  if (normalizedRoot && !key.startsWith(normalizedRoot)) {
    throw new UnsafeKeyError();
  }

  return key;
}

/** The file name portion of an object key. */
export function basename(key: string): string {
  const parts = key.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

/** Where `sourceKey` lands when moved into `destinationPrefix`. */
export function destinationKeyFor(sourceKey: string, destinationPrefix: string): string {
  const prefix = destinationPrefix === '' || destinationPrefix.endsWith('/')
    ? destinationPrefix
    : `${destinationPrefix}/`;
  return `${prefix}${basename(sourceKey)}`;
}

/**
 * True when `prefix` names the bucket root rather than a folder inside it.
 * Deleting such a prefix would empty the bucket, so callers must refuse it.
 */
export function isRootPrefix(root: string | null | undefined, prefix: string): boolean {
  const normalizedRoot = normalizeRoot(root);
  const candidate = prefix.trim();
  if (candidate === '' || candidate === '/') return true;
  const normalizedCandidate = candidate.endsWith('/') ? candidate : `${candidate}/`;
  return normalizedCandidate === normalizedRoot;
}
