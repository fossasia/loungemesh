import { test, expect } from '@playwright/test';

test.describe('Routes and navigation', () => {
  test('home form navigates to a named session', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Session name').fill('e2e-room');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page).toHaveURL(/\/session\/e2e-room$/);
    await expect(page.getByRole('button', { name: 'Leave Call' })).toBeVisible();
  });

  test('enter lobby joins the session', async ({ page }) => {
    await page.goto('/enter/flowspace');
    await expect(page.getByText(/Move around the space/i)).toBeVisible();
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page).toHaveURL(/\/session\/flowspace$/);
    await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible();
  });

  test('session redirect from /session uses default room', async ({ page }) => {
    await page.goto('/session');
    await expect(page).toHaveURL(/\/session\/flowspace$/);
  });

  test('open-mode join redirects into the session', async ({ page }) => {
    await page.goto('/join/flowspace');
    await expect(page).toHaveURL(/\/session\/flowspace$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Leave Call' })).toBeVisible();
  });
});
