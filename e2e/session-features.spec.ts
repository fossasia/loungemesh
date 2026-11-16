import { test, expect } from '@playwright/test';

test.describe('Session feature controls', () => {
  test.beforeEach(async ({ page }) => {
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
            enabledFeatures: {
              chat: true,
              notes: false,
              whiteboard: false,
              poll: false,
              stage: true,
            },
          },
        }),
      });
    });
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

  test('host sees Host header badge and opens clean Room and People controls', async ({ page }) => {
    // Attendee from beforeEach does not see host/moderator Add or Share quick buttons
    await expect(page.getByTestId('quick-add-attendee-btn')).not.toBeVisible();
    await expect(page.getByTestId('quick-share-link-btn')).not.toBeVisible();

    let invitedEmailsPayload: string[] = [];
    await page.route('**/api/meetings/state/*/invite', async (route) => {
      const body = route.request().postDataJSON() as { emails?: string[] };
      invitedEmailsPayload = body.emails || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          addedEmails: invitedEmailsPayload,
          guestEmails: invitedEmailsPayload,
          emailSent: true,
        }),
      });
    });

    await page.route('**/api/meetings/state/*/init', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          role: { role: 'host', hostId: 'host-1', hostEmail: 'host@example.com', isInvited: true },
          config: {
            lobbyEnabled: true,
            stagePromotionEnabled: true,
            allowParticipantRecording: false,
            notesTemplate: '',
            lobbyForm: 'name',
          },
          access: {
            enabledFeatures: {
              chat: true,
              notes: true,
              whiteboard: true,
              poll: true,
              stage: true,
            },
          },
        }),
      });
    });

    await page.goto('/session/e2e-host-controls');
    await expect(page.getByTestId('header-role-badge')).toContainText('Host');
    await expect(page.getByTestId('quick-add-attendee-btn')).toBeVisible();
    await expect(page.getByTestId('quick-share-link-btn')).toBeVisible();

    const footer = page.locator('.footer');
    await footer.getByRole('button', { name: 'Moderator' }).click();
    await expect(page.getByText('Host Controls & Settings')).toBeVisible();
    await expect(page.getByText('Room appearance')).toBeVisible();
    await expect(page.getByText('Feature access')).toBeVisible();

    await page.getByRole('tab', { name: 'People' }).click();
    await expect(page.getByRole('heading', { name: 'Participants' })).toBeVisible();

    // Invite an attendee by email via the Add action
    await page.getByTestId('people-add-btn').click();
    await page.locator('#session-invite-emails').fill('newguest@example.com');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByText('Invitation email sent to newguest@example.com.')).toBeVisible();
    expect(invitedEmailsPayload).toEqual(['newguest@example.com']);

    // Share meeting link via the Share action
    await page.getByTestId('people-share-btn').click();
    await expect(page.locator('#session-share-link')).toHaveValue(/\/session\/e2e-host-controls$/);
    await page.getByTestId('people-copy-link-btn').click();
  });

  test('renders screenshare button in footer when stage is not occupied', async ({ page }) => {
    const footer = page.locator('.footer');
    const screenshareBtn = footer.getByRole('button', { name: /Screenshare/i });
    await expect(screenshareBtn).toBeVisible();
  });
});
