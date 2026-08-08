import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers';
import { ADMIN, VIEWER, UPLOADER, RBAC_BUCKET_ALIAS } from './fixtures';
import {
  getUserByUsername,
  insertBucketWithoutCredentials,
  assignBucket,
  deleteBucketsByAlias,
  closePool,
} from './db';

/**
 * Role gating for the object-management controls: New Folder, Move, Delete.
 *
 * These assertions need no S3 access. The bucket has no stored credentials, so
 * listing fails and the browser shows its error state — but the toolbar renders
 * regardless, which is exactly what we are checking. Server-side enforcement is
 * covered by unit tests over `src/lib/s3-keys.ts` plus the role map in
 * `src/lib/s3-authz.ts`; the UI is only the first gate.
 */

const NEW_FOLDER = 'New Folder';
const MOVE = /Move Selected/;
const DELETE = /Delete Selected/;

let bucketId: number;

async function openBucket(page: Page) {
  await page.goto(`/buckets/${bucketId}`);
  // Wait for the browser card, not the list — the bucket fails to load its
  // contents by design here.
  await expect(page.getByRole('button', { name: 'Back' })).toBeVisible({ timeout: 20000 });
}

/** Select the first row's checkbox, if any rows rendered. */
async function selectFirstRow(page: Page) {
  const checkbox = page.getByRole('checkbox').nth(1);
  if (await checkbox.isVisible().catch(() => false)) {
    await checkbox.click();
  }
}

test.describe.serial('Object management role gating', () => {
  test.beforeAll(async () => {
    await deleteBucketsByAlias(RBAC_BUCKET_ALIAS);
    const admin = await getUserByUsername(ADMIN.username);
    const viewer = await getUserByUsername(VIEWER.username);
    const uploader = await getUserByUsername(UPLOADER.username);
    bucketId = await insertBucketWithoutCredentials(RBAC_BUCKET_ALIAS, admin!.id);
    await assignBucket(bucketId, viewer!.id, 'read');
    await assignBucket(bucketId, uploader!.id, 'write');
  });

  test.afterAll(async () => {
    await deleteBucketsByAlias(RBAC_BUCKET_ALIAS);
    await closePool();
  });

  test('viewer sees no New Folder control', async ({ page }) => {
    await login(page, VIEWER);
    await openBucket(page);

    await expect(page.getByRole('button', { name: NEW_FOLDER })).toHaveCount(0);
    await selectFirstRow(page);
    await expect(page.getByRole('button', { name: MOVE })).toHaveCount(0);
    await expect(page.getByRole('button', { name: DELETE })).toHaveCount(0);
  });

  test('uploader sees New Folder but not Delete', async ({ page }) => {
    await login(page, UPLOADER);
    await openBucket(page);

    await expect(page.getByRole('button', { name: NEW_FOLDER })).toBeVisible();
    await selectFirstRow(page);
    await expect(page.getByRole('button', { name: DELETE })).toHaveCount(0);
  });

  test('admin sees New Folder, and the New Folder dialog validates names', async ({ page }) => {
    await login(page, ADMIN);
    await openBucket(page);

    await expect(page.getByRole('button', { name: NEW_FOLDER })).toBeVisible();
    await page.getByRole('button', { name: NEW_FOLDER }).click();

    const input = page.getByLabel('Folder name');
    await expect(input).toBeVisible();

    // A name containing '/' is rejected client-side and blocks submission.
    await input.fill('bad/name');
    await expect(page.getByText('Folder name cannot contain "/".')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();

    // A valid name re-enables it.
    await input.fill('reports');
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toBeEnabled();
  });
});
