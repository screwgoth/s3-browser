import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';
import { ADMIN, VIEWER, TEST_BUCKET, TEST_BUCKET_ALIAS } from './fixtures';
import {
  getBucketRowsByAlias,
  getUserByUsername,
  getAssignment,
  closePool,
} from './db';

/**
 * End-to-end: admin creates a bucket, assigns it to a non-admin (viewer),
 * and the viewer can see the assigned bucket.
 *
 * Each step asserts BOTH the UI and the database row, so the suite directly
 * covers the two reported production bugs:
 *   1. deleting a bucket didn't remove it from the DB   -> confirmed as an
 *      intentional soft-delete (is_active=false); asserted in the last test.
 *   2. creating a bucket didn't persist to the DB (EC2) -> asserted by reading
 *      the `buckets` table right after the UI create.
 *
 * Serial: the tests share one bucket row and must run in order.
 */
test.describe.serial('Bucket create / assign / visibility', () => {
  test.afterAll(async () => {
    await closePool();
  });

  test('admin can create a bucket and it persists in the database', async ({ page }) => {
    await login(page, ADMIN);

    await page.getByRole('button', { name: 'Add S3 Bucket' }).first().click();

    // Fill the credentials form (placeholders are unique per field).
    await page.getByPlaceholder('My Work Bucket').fill(TEST_BUCKET.alias);
    await page.getByPlaceholder('my-awesome-bucket').fill(TEST_BUCKET.bucketName);
    await page.getByPlaceholder('us-east-1').fill(TEST_BUCKET.region);
    await page.getByPlaceholder('AKIA...').fill(TEST_BUCKET.accessKeyId);
    await page.getByPlaceholder('Your secret key').fill(TEST_BUCKET.secretAccessKey);

    await page.getByRole('button', { name: 'Add Bucket' }).click();

    // UI: the new bucket appears in the list.
    await expect(page.getByText(TEST_BUCKET_ALIAS, { exact: true })).toBeVisible({ timeout: 15000 });

    // DB: exactly one active row was created with the right owner.
    await expect
      .poll(async () => (await getBucketRowsByAlias(TEST_BUCKET_ALIAS)).length, { timeout: 10000 })
      .toBe(1);

    const [row] = await getBucketRowsByAlias(TEST_BUCKET_ALIAS);
    expect(row.is_active).toBe(true);
    expect(row.bucket_name).toBe(TEST_BUCKET.bucketName);
    expect(row.region).toBe(TEST_BUCKET.region);

    const adminUser = await getUserByUsername(ADMIN.username);
    expect(row.user_id).toBe(adminUser!.id);
  });

  test('admin can assign the bucket to a non-admin user', async ({ page }) => {
    await login(page, ADMIN);
    await page.goto('/bucket-assignments');

    // Select the bucket.
    await page.getByRole('combobox').filter({ hasText: 'Choose bucket' }).click();
    await page.getByRole('option', { name: TEST_BUCKET_ALIAS }).click();

    // Select the viewer user.
    await page.getByRole('combobox').filter({ hasText: 'Choose user' }).click();
    await page.getByRole('option', { name: new RegExp(VIEWER.username) }).click();

    await page.getByRole('button', { name: 'Assign User' }).click();

    // UI: the viewer now shows up under the bucket's current assignments.
    await expect(page.getByText(VIEWER.username).first()).toBeVisible({ timeout: 15000 });

    // DB: the assignment row exists.
    const [bucket] = await getBucketRowsByAlias(TEST_BUCKET_ALIAS);
    const viewer = await getUserByUsername(VIEWER.username);
    await expect
      .poll(async () => !!(await getAssignment(bucket.id, viewer!.id)), { timeout: 10000 })
      .toBe(true);
  });

  test('non-admin user can see the bucket assigned to them', async ({ page }) => {
    await logout(page);
    await login(page, VIEWER);

    // Substring match (not exact): the viewer's card title also contains an
    // "R/W" permission badge alongside the alias.
    const bucket = page.getByText(TEST_BUCKET_ALIAS).first();

    // No reload workaround: the page now gates on AuthContext + bucket loading
    // state (single source of truth), so the assigned bucket must appear on
    // first load.
    await expect(bucket).toBeVisible({ timeout: 15000 });
    // ...and marked as shared (not owned by the viewer).
    await expect(page.getByText(/Shared by/i).first()).toBeVisible();
  });

  test('deleting a bucket as admin is a soft delete (row stays, is_active=false)', async ({ page }) => {
    await login(page, ADMIN);

    await expect(page.getByText(TEST_BUCKET_ALIAS, { exact: true })).toBeVisible({ timeout: 15000 });

    // The delete (trash) button is an icon-only button with the destructive
    // class inside the bucket's card — target it via its lucide-trash icon.
    await page.locator('button.text-destructive:has(svg.lucide-trash)').first().click();
    // Confirm in the AlertDialog.
    await page.getByRole('button', { name: 'Delete' }).click();

    // UI: the bucket disappears from the admin's list.
    await expect(page.getByText(TEST_BUCKET_ALIAS, { exact: true })).toHaveCount(0, { timeout: 15000 });

    // DB: the row is NOT hard-deleted — it remains with is_active = false.
    // This documents the reported "not deleted from DB" behaviour as intended.
    const rows = await getBucketRowsByAlias(TEST_BUCKET_ALIAS);
    expect(rows.length).toBe(1);
    expect(rows[0].is_active).toBe(false);
  });
});
