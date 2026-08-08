import { describe, it, expect } from 'vitest';
import {
  normalizeRoot,
  validateFolderName,
  assertWithinRoot,
  UnsafeKeyError,
  basename,
  destinationKeyFor,
  isRootPrefix,
} from './s3-keys';

describe('normalizeRoot', () => {
  it('treats missing/empty roots as the whole bucket', () => {
    expect(normalizeRoot(undefined)).toBe('');
    expect(normalizeRoot(null)).toBe('');
    expect(normalizeRoot('')).toBe('');
    expect(normalizeRoot('   ')).toBe('');
    expect(normalizeRoot('/')).toBe('');
  });

  it('appends a trailing slash and strips leading slashes', () => {
    expect(normalizeRoot('team')).toBe('team/');
    expect(normalizeRoot('team/')).toBe('team/');
    expect(normalizeRoot('/team/docs')).toBe('team/docs/');
  });
});

describe('validateFolderName', () => {
  it('accepts and trims an ordinary name', () => {
    expect(validateFolderName('  reports ')).toEqual({ ok: true, value: 'reports' });
  });

  it('rejects empty, slashed, dot, and over-long names', () => {
    expect(validateFolderName('   ').ok).toBe(false);
    expect(validateFolderName('a/b').ok).toBe(false);
    expect(validateFolderName('.').ok).toBe(false);
    expect(validateFolderName('..').ok).toBe(false);
    expect(validateFolderName('x'.repeat(256)).ok).toBe(false);
    expect(validateFolderName('x'.repeat(255)).ok).toBe(true);
  });

  it('rejects control characters', () => {
    expect(validateFolderName('bad\u0000name').ok).toBe(false);
    expect(validateFolderName('bad\nname').ok).toBe(false);
  });
});

describe('assertWithinRoot', () => {
  it('accepts keys inside the root', () => {
    expect(assertWithinRoot('team/', 'team/docs/a.txt')).toBe('team/docs/a.txt');
    expect(assertWithinRoot('team', 'team/docs/')).toBe('team/docs/');
    expect(assertWithinRoot('', 'anything/a.txt')).toBe('anything/a.txt');
  });

  it('rejects keys outside the root', () => {
    expect(() => assertWithinRoot('team/', 'other/a.txt')).toThrow(UnsafeKeyError);
    expect(() => assertWithinRoot('team/', 'a.txt')).toThrow(UnsafeKeyError);
  });

  it('rejects traversal segments even when the prefix matches', () => {
    expect(() => assertWithinRoot('team/', 'team/../other/a.txt')).toThrow(UnsafeKeyError);
    expect(() => assertWithinRoot('team/', 'team/./a.txt')).toThrow(UnsafeKeyError);
  });

  it('rejects empty keys, leading slashes, doubled slashes, and control chars', () => {
    expect(() => assertWithinRoot('', '')).toThrow(UnsafeKeyError);
    expect(() => assertWithinRoot('', '/a.txt')).toThrow(UnsafeKeyError);
    expect(() => assertWithinRoot('', 'a//b.txt')).toThrow(UnsafeKeyError);
    expect(() => assertWithinRoot('', 'a\u0007b.txt')).toThrow(UnsafeKeyError);
  });
});

describe('destinationKeyFor', () => {
  it('moves a file under the destination prefix', () => {
    expect(destinationKeyFor('team/a/report.pdf', 'team/b/')).toBe('team/b/report.pdf');
  });

  it('adds a missing trailing slash to the prefix', () => {
    expect(destinationKeyFor('team/a/report.pdf', 'team/b')).toBe('team/b/report.pdf');
  });

  it('supports the bucket root as a destination', () => {
    expect(destinationKeyFor('team/a/report.pdf', '')).toBe('report.pdf');
  });

  it('is a no-op when the destination is the current folder', () => {
    const key = 'team/a/report.pdf';
    expect(destinationKeyFor(key, 'team/a/')).toBe(key);
  });

  it('extracts the file name', () => {
    expect(basename('a/b/c.txt')).toBe('c.txt');
    expect(basename('c.txt')).toBe('c.txt');
  });
});

describe('isRootPrefix', () => {
  it('flags the bucket root', () => {
    expect(isRootPrefix('team/', 'team/')).toBe(true);
    expect(isRootPrefix('team/', 'team')).toBe(true);
    expect(isRootPrefix('', '')).toBe(true);
    expect(isRootPrefix('team/', '')).toBe(true);
    expect(isRootPrefix('team/', '/')).toBe(true);
  });

  it('allows folders inside the root', () => {
    expect(isRootPrefix('team/', 'team/docs/')).toBe(false);
    expect(isRootPrefix('', 'docs/')).toBe(false);
  });
});
