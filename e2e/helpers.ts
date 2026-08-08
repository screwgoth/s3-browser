import { expect, type Page } from '@playwright/test';

/** Log in through the real login form and wait for the dashboard. */
export async function login(page: Page, user: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByPlaceholder('Enter username').fill(user.username);
  await page.getByPlaceholder('Enter password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // login page redirects via window.location after a ~1s toast delay
  await page.waitForURL('**/', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Bucket List' })).toBeVisible({ timeout: 15000 });
}

/** Log out by clearing the session cookie (HttpOnly — cleared at context level). */
export async function logout(page: Page) {
  await page.context().clearCookies();
}
