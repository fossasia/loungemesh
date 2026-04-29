import { test, expect } from '@playwright/test';

const baseURL = process.env.PREVIEW_URL ?? 'http://localhost:4173';

test.describe('Flowspace', () => {
  test('home page loads with Flowspace branding', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(baseURL);
    await expect(page).toHaveTitle(/Flowspace/i);
    await expect(page.getByRole('heading', { name: /^Flowspace$/i })).toBeVisible();
    await expect(page.getByText(/Spatial video lounges/i)).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('enter lobby route resolves', async ({ page }) => {
    await page.goto(`${baseURL}/enter/flowspace`);
    await expect(page.getByText(/Move around the space/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
  });
});
