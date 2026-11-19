import { test, expect, type Page } from '@playwright/test';

const EVENTYAY_BASE_URL = 'http://localhost:8000';
const ATTENDEE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhbnkiLCJhdWQiOiJldmVudHlheSIsImlhdCI6MTc5NTA4OTYyMSwiZXhwIjoxNzk1MTc2MDIxLCJ1aWQiOiJhdHRlbmRlZS1hbGljZSIsInRyYWl0cyI6WyJhdHRlbmRlZSJdfQ.jW4NuvPKhlxa9Clokbh92HlRJvSRZ8cvYk93DqWB5z4';
const SMILE_ATTENDEE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhbnkiLCJhdWQiOiJldmVudHlheSIsImlhdCI6MTc5NTA5MDcwNSwiZXhwIjoxODI2NjI2NzA1LCJ1aWQiOiJhdHRlbmRlZS1ib2IiLCJ0cmFpdHMiOlsiYXR0ZW5kZWUiXX0.fBzDFnjov5whS-1o33aAaTQRtX8OmvUK7apBok2T9cI';
const FUTURE_ATTENDEE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhbnkiLCJhdWQiOiJldmVudHlheSIsImlhdCI6MTc5NTA5MDczMywiZXhwIjoxODI2NjI2NzMzLCJ1aWQiOiJhdHRlbmRlZS1jaGFybGllIiwidHJhaXRzIjpbImF0dGVuZGVlIl19.eWl9QZ_FJKmpPJeRJWakbD7Uj1kUQTQUbW7ghViWQmc';

async function handleProfileGreeting(page: Page, name = 'Attendee') {
  while (true) {
    const greetingPrompt = page.locator('.c-profile-greeting-prompt');
    if (!await greetingPrompt.isVisible()) break;
    const nameInput = page.locator('input[name="displayName"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(name);
    }
    const continueBtn = page.locator('#btn-continue');
    const finishBtn = page.locator('#btn-finish');
    if (await continueBtn.isVisible()) {
      await continueBtn.click();
      await page.waitForTimeout(800);
    } else if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(800);
      break;
    } else {
      break;
    }
  }
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--allow-file-access',
    ],
  },
});

test.describe('Eventyay Video Platform Embedded LoungeMesh Suite', () => {

  test('1. Public Attendee View: Strict Role Isolation, Media Controls & Permissions Inside Eventyay', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);

    // Visit Eventyay video platform with attendee token
    await page.goto(`${EVENTYAY_BASE_URL}/demo-org/perf-summit-2026/video/#token=${ATTENDEE_TOKEN}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Complete profile greeting if prompted
    await handleProfileGreeting(page, 'Attendee Alice');

    // Navigate to Room 20 (LoungeMesh Networking Lounge)
    const loungeLink = page.locator('a:has-text("LoungeMesh"), button:has-text("LoungeMesh")');
    if (await loungeLink.count() > 0 && await loungeLink.first().isVisible()) {
      await loungeLink.first().click();
    } else {
      await page.evaluate(() => (window as any).vapp?.$router?.push('/rooms/20'));
    }

    // Verify LoungeMesh iframe is created in DOM
    const iframeEl = page.locator('iframe.iframe-media-source, iframe.call-iframe');
    await expect(iframeEl).toBeVisible({ timeout: 20000 });

    const iframeLocator = page.frameLocator('iframe');

    // Wait for LoungeMesh footer controls inside the iframe
    const footer = iframeLocator.locator('.footer, [data-testid="footer-bar"]');
    await expect(footer.first()).toBeVisible({ timeout: 20000 });

    // Verify Attendee role isolation: NO Host or Moderator badge
    const roleBadge = iframeLocator.getByTestId('header-role-badge');
    if (await roleBadge.count() > 0) {
      await expect(roleBadge).not.toContainText('Host');
      await expect(roleBadge).not.toContainText('Moderator');
    }

    // Host-only quick actions must NOT be visible to attendee
    await expect(iframeLocator.getByTestId('quick-add-attendee-btn')).not.toBeVisible();
    await expect(iframeLocator.getByTestId('quick-share-link-btn')).not.toBeVisible();

    // Moderator/Host controls button must NOT be visible to attendee (Zero privilege leak)
    await expect(footer.getByRole('button', { name: 'Moderator' })).not.toBeVisible();

    // Test WebRTC Media Controls: Camera Toggle inside iframe
    const camBtn = footer.getByRole('button', { name: /camera/i });
    await expect(camBtn).toBeVisible();
    await camBtn.click();
    await page.waitForTimeout(300);
    await camBtn.click();

    // Test WebRTC Media Controls: Microphone Toggle inside iframe
    const micBtn = footer.getByRole('button', { name: /Mute|Unmute/i });
    await expect(micBtn).toBeVisible();
    await micBtn.click();
    await page.waitForTimeout(300);
    await micBtn.click();

    await page.screenshot({ path: 'test-results/01-eventyay-public-attendee-view.png' });
  });

  test('2. Organizer Video View: Host Role, Host Settings Drawer & Screenshare Inside Eventyay', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);

    // Log in as organizer
    await page.goto(`${EVENTYAY_BASE_URL}/login/?next=/video/event/demo-org/perf-summit-2026/rooms/20`);
    await page.locator('#id_email').fill('admin@eventyay.com');
    await page.locator('#id_password').fill('AdminPass123!');
    await page.locator('button[type="submit"]').click();

    // Handle sudo mode prompt if required
    const startSessionBtn = page.locator('button:has-text("Start session"), [name="action"][value="start"]');
    if (await startSessionBtn.isVisible()) {
      await startSessionBtn.click();
    }

    // Ensure we are in the organizer video view at room 20
    await page.waitForURL(/\/video\/event\/demo-org\/perf-summit-2026\/rooms\/20/, { timeout: 20000 });

    // Target iframe
    const iframeEl = page.locator('iframe.iframe-media-source, iframe.call-iframe');
    await expect(iframeEl).toBeVisible({ timeout: 20000 });

    const iframeLocator = page.frameLocator('iframe');

    // Wait for LoungeMesh footer controls
    const footer = iframeLocator.locator('.footer, [data-testid="footer-bar"]');
    await expect(footer.first()).toBeVisible({ timeout: 20000 });

    // Verify Host role badge inside iframe
    const roleBadge = iframeLocator.getByTestId('header-role-badge');
    await expect(roleBadge).toContainText('Host', { timeout: 15000 });

    // Host quick action buttons ARE visible to host
    await expect(iframeLocator.getByTestId('quick-add-attendee-btn')).toBeVisible();
    await expect(iframeLocator.getByTestId('quick-share-link-btn')).toBeVisible();

    // Moderator/Host controls button IS visible to host
    const modBtn = footer.getByRole('button', { name: 'Moderator' });
    await expect(modBtn).toBeVisible();

    // Test WebRTC Media Controls: Camera Toggle inside iframe
    const camBtn = footer.getByRole('button', { name: /camera/i });
    await expect(camBtn).toBeVisible();
    await camBtn.click();
    await page.waitForTimeout(300);
    await camBtn.click();

    // Test WebRTC Media Controls: Mic Toggle inside iframe
    const micBtn = footer.getByRole('button', { name: /Mute|Unmute/i });
    await expect(micBtn).toBeVisible();
    await micBtn.click();
    await page.waitForTimeout(300);
    await micBtn.click();

    // Test Screenshare button presence and clickability inside iframe
    const screenshareBtn = footer.getByRole('button', { name: /Screenshare/i });
    await expect(screenshareBtn).toBeVisible();

    // Open Host Controls & Settings drawer inside iframe
    await modBtn.click();
    await expect(iframeLocator.getByText('Host Controls & Settings')).toBeVisible();
    await expect(iframeLocator.getByText('Room appearance')).toBeVisible();
    await expect(iframeLocator.getByText('Feature access')).toBeVisible();

    await page.screenshot({ path: 'test-results/02-eventyay-organizer-host-view.png' });
  });

  test('3. Event Timing Access Control: Attendee Restricted Outside Event Hours', async ({ page }) => {
    // 1) Past event 'smile' under organizer 'evil-dead' (ended Oct 2026, room 12)
    // Non-host attendees entering after event end date are rejected with event_ended
    await page.goto(`${EVENTYAY_BASE_URL}/evil-dead/smile/video/#token=${SMILE_ATTENDEE_TOKEN}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await handleProfileGreeting(page, 'Attendee Bob');

    // Navigate to Room 12
    const loungeLinkSmile = page.locator('a:has-text("LoungeMesh"), button:has-text("LoungeMesh")');
    if (await loungeLinkSmile.count() > 0 && await loungeLinkSmile.first().isVisible()) {
      await loungeLinkSmile.first().click();
    } else {
      await page.evaluate(() => (window as any).vapp?.$router?.push('/rooms/12'));
    }

    // Verify in UI: Error state is displayed and iframe is NOT loaded
    const errorCard = page.locator('.iframe-error .error-card, .c-iframe-call-frame .error-state');
    await expect(errorCard).toBeVisible({ timeout: 15000 });
    await expect(errorCard).toContainText(/ended|Connection Failed/i);

    const callIframe = page.locator('iframe.call-iframe, iframe.iframe-media-source');
    await expect(callIframe).not.toBeVisible();

    // Also verify directly via API
    const pastResult = await page.evaluate(async () => {
      const win = window as any;
      const api = win.api || win.__eventyay_api;
      if (!api) return { error: 'no_api', success: false, code: '', message: '' };
      try {
        await api.call('loungemesh.room_url', { room: 12 });
        return { success: true, code: '', message: '' };
      } catch (err: unknown) {
        const error = err as any;
        return { success: false, code: error.apiError?.code || '', message: error.message || '' };
      }
    });
    console.log('Past event timing access result for attendee:', pastResult);
    if (!pastResult.error) {
      expect(pastResult.success).toBe(false);
      expect(pastResult.code + pastResult.message).toMatch(/event_ended|ended/i);
    }

    // 2) Future event 'zlh9fx' under organizer 'demo-org' (starts Jan 2027, room 22)
    // Non-host attendees entering before start date are rejected with event_not_started
    await page.goto(`${EVENTYAY_BASE_URL}/demo-org/zlh9fx/video/#token=${FUTURE_ATTENDEE_TOKEN}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await handleProfileGreeting(page, 'Attendee Charlie');

    // Navigate to Room 22
    const loungeLinkFuture = page.locator('a:has-text("Future"), button:has-text("Future")');
    if (await loungeLinkFuture.count() > 0 && await loungeLinkFuture.first().isVisible()) {
      await loungeLinkFuture.first().click();
    } else {
      await page.evaluate(() => (window as any).vapp?.$router?.push('/rooms/22'));
    }

    const futureErrorCard = page.locator('.iframe-error .error-card, .c-iframe-call-frame .error-state');
    await expect(futureErrorCard).toBeVisible({ timeout: 15000 });
    await expect(futureErrorCard).toContainText(/not started|scheduled event hours|Connection Failed/i);
    await expect(page.locator('iframe.call-iframe, iframe.iframe-media-source')).not.toBeVisible();

    const futureResult = await page.evaluate(async () => {
      const win = window as any;
      const api = win.api || win.__eventyay_api;
      if (!api) return { error: 'no_api', success: false, code: '', message: '' };
      try {
        await api.call('loungemesh.room_url', { room: 22 });
        return { success: true, code: '', message: '' };
      } catch (err: unknown) {
        const error = err as any;
        return { success: false, code: error.apiError?.code || '', message: error.message || '' };
      }
    });
    console.log('Future event timing access result for attendee:', futureResult);
    if (!futureResult.error) {
      expect(futureResult.success).toBe(false);
      expect(futureResult.code + futureResult.message).toMatch(/event_not_started|not started/i);
    }

    await page.screenshot({ path: 'test-results/03-timing-access-restriction.png' });
  });

  test('4. Event Timing Access Control: Host Retains Full Access Anytime', async ({ page }) => {
    // Log in as organizer and visit past event 'smile' under organizer 'evil-dead' room 12
    await page.goto(`${EVENTYAY_BASE_URL}/login/?next=/video/event/evil-dead/smile/rooms/12`);
    await page.locator('#id_email').fill('admin@eventyay.com');
    await page.locator('#id_password').fill('AdminPass123!');
    await page.locator('button[type="submit"]').click();

    const startSessionBtn = page.locator('button:has-text("Start session"), [name="action"][value="start"]');
    if (await startSessionBtn.isVisible()) {
      await startSessionBtn.click();
    }

    await page.waitForURL(/\/video\/event\/evil-dead\/smile\/rooms\/12/, { timeout: 20000 });

    // Host should NOT be blocked even though event 'smile' ended in Oct 2026
    const iframeEl = page.locator('iframe.iframe-media-source, iframe.call-iframe');
    await expect(iframeEl).toBeVisible({ timeout: 20000 });

    const iframeLocator = page.frameLocator('iframe');

    // Wait for LoungeMesh footer controls
    const footer = iframeLocator.locator('.footer, [data-testid="footer-bar"]');
    await expect(footer.first()).toBeVisible({ timeout: 20000 });

    // Verify Host role badge inside iframe
    const roleBadge = iframeLocator.getByTestId('header-role-badge');
    await expect(roleBadge).toContainText('Host', { timeout: 15000 });

    // Host quick action buttons ARE visible to host
    await expect(iframeLocator.getByTestId('quick-add-attendee-btn')).toBeVisible();

    // Verify via direct API call as well
    const hostResult = await page.evaluate(async () => {
      const win = window as any;
      const api = win.api || win.__eventyay_api;
      if (!api) return { error: 'no_api', success: false, role: '', url: '' };
      try {
        const res = await api.call('loungemesh.room_url', { room: 12 });
        return { success: true, role: res.role, url: res.url };
      } catch (err: unknown) {
        const error = err as any;
        return { success: false, code: error.code || error.message, role: '', url: '' };
      }
    });
    console.log('Past event host access result:', hostResult);
    if (!hostResult.error) {
      expect(hostResult.success).toBe(true);
      expect(hostResult.role).toBe('host');
      expect(hostResult.url).toContain('/join/lms-smile-12');
    }

    await page.screenshot({ path: 'test-results/04-host-anytime-access.png' });
  });

});
