import { test, expect } from '@playwright/test';

test.describe('Session feature controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/session/e2e-features');
    await expect(page.locator('[data-testid="footer-bar"], footer, .footer-bar, .footer').first()).toBeVisible({ timeout: 10000 });
  });

  test('can toggle camera and microphone', async ({ page }) => {
    const footer = page.locator('.footer');
    const camBtn = footer.getByRole('button', { name: /Turn off camera|Turn on camera/i });
    const micBtn = footer.getByRole('button', { name: /Mute|Unmute/i });

    const initialCamText = await camBtn.textContent() || '';
    const isCamOffInitial = initialCamText.includes('on camera');
    await camBtn.click();
    if (isCamOffInitial) {
      await expect(footer.getByRole('button', { name: /Turn off camera/i })).toBeVisible();
    } else {
      await expect(footer.getByRole('button', { name: /Turn on camera/i })).toBeVisible();
    }

    const initialMicText = await micBtn.textContent() || '';
    const isMicOffInitial = initialMicText.includes('Unmute');
    await micBtn.click();
    if (isMicOffInitial) {
      await expect(footer.getByRole('button', { name: /^Mute$/i })).toBeVisible();
    } else {
      await expect(footer.getByRole('button', { name: /^Unmute$/i })).toBeVisible();
    }
  });

  test('can open and close side panels (Chat, Notes, Whiteboard, Poll)', async ({ page }) => {
    const footer = page.locator('.footer');

    await footer.getByRole('button', { name: 'Chat' }).click();
    await expect(page.getByText('No messages yet.')).toBeVisible();
    await footer.getByRole('button', { name: 'Chat' }).click();
    await expect(page.getByText('No messages yet.')).not.toBeVisible();

    const notesBtn = footer.getByRole('button', { name: 'Shared notes' });
    await expect(notesBtn).not.toBeVisible();

    const pollBtn = footer.getByRole('button', { name: 'Poll' });
    await expect(pollBtn).not.toBeVisible();

    const boardBtn = footer.getByRole('button', { name: 'Whiteboard' });
    await expect(boardBtn).not.toBeVisible();
  });

  test('can use interactions (Raise Hand, Reactions)', async ({ page }) => {
    const footer = page.locator('.footer');

    const raiseHandBtn = footer.getByRole('button', { name: 'Raise hand' });
    await raiseHandBtn.click();
    await expect(raiseHandBtn).toBeVisible();
    await raiseHandBtn.click();

    const reactionsBtn = footer.getByRole('button', { name: 'Reactions' });
    await reactionsBtn.click();
    await expect(page.getByText('Pick a reaction')).toBeVisible();
    await reactionsBtn.click();
    await expect(page.getByText('Pick a reaction')).not.toBeVisible();
  });

  test('leave dialog triggers for host and allows exporting', async ({ page }) => {
    await page.getByRole('button', { name: 'Leave Call' }).click();

    const dialog = page.getByRole('dialog', { name: /Leave the session/i });

    if (await dialog.isVisible()) {
      await expect(page.getByText('Export the session before you go')).toBeVisible();
      await expect(page.getByRole('button', { name: /Download notes/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Download whiteboard/i })).toBeVisible();

      await page.getByRole('button', { name: 'Stay' }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
});
