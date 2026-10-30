import { test, expect, type Page } from '@playwright/test';

async function stubOpenRoomInit(page: Page) {
  await page.route('**/api/meetings/state/*/init', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        role: { role: 'attendee', hostId: 'host-1', isInvited: true },
        config: {
          lobbyEnabled: false,
          stagePromotionEnabled: true,
          allowParticipantRecording: false,
          notesTemplate: '',
          lobbyForm: 'name',
        },
        access: {
          enabledFeatures: { chat: true, notes: true, whiteboard: true, poll: true, stage: true },
        },
      }),
    });
  });
}

test.describe('Routes and navigation', () => {
  test('default uninvited room shows In lobby header status and lobby entry form', async ({ page }) => {
    await page.goto('/session/lobby-default-room');
    await expect(page.getByTestId('header-role-badge')).toContainText('In lobby');
    await expect(page.getByRole('heading', { name: 'Request Entry' })).toBeVisible();
  });

  test('home form navigates to a named session', async ({ page }) => {
    await stubOpenRoomInit(page);
    await page.goto('/');
    await page.getByPlaceholder('e.g. Alex').fill('Alex');
    await page.getByLabel('Session name').fill('e2e-room');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page).toHaveURL(/\/session\/e2e-room$/);
    await expect(page.getByRole('button', { name: 'Leave Call' })).toBeVisible();
    await expect(page.getByTestId('header-role-badge')).toHaveCount(0);
  });

  test('enter lobby joins the session', async ({ page }) => {
    await stubOpenRoomInit(page);
    await page.goto('/enter/loungemesh');
    await expect(page.getByText(/Move around the space/i)).toBeVisible();
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page).toHaveURL(/\/session\/loungemesh$/);
    await expect(page.getByRole('button', { name: /Mute|Unmute/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible();
  });

  test('session redirect from /session uses default room', async ({ page }) => {
    await page.goto('/session');
    await expect(page).toHaveURL(/\/session\/loungemesh$/);
  });

  test('open-mode join redirects into the session', async ({ page }) => {
    await stubOpenRoomInit(page);
    await page.goto('/join/loungemesh');
    await expect(page).toHaveURL(/\/session\/loungemesh$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Leave Call' })).toBeVisible();
  });
});
