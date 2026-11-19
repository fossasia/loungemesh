import { test, expect } from '@playwright/test';

// Direct and Tunnel URLs
const EVENTYAY_BASE_URL = 'http://localhost:8000';
const LOUNGEMESH_DIRECT_URL = 'http://localhost:8780';
const LOUNGEMESH_TUNNEL_URL = 'https://recipients-procurement-proceeds-clause.trycloudflare.com';
const SERVICE_SECRET = '9f53a6cabe817870266f7f03422864b302d1bd021b448e7b3f6cbf70361337c5';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let jwt: any;
try {
  jwt = require('../server/node_modules/jsonwebtoken');
} catch {
  // Optional in environments where server dependencies are not installed
}

function makeGrant(options: {
  role: 'host' | 'moderator' | 'attendee';
  eventSlug: string;
  room: string | number;
  userName?: string;
  sub?: string;
  isPast?: boolean;
  isFuture?: boolean;
}) {
  const now = Math.floor(Date.now() / 1000);
  let nbf = now - 10;
  let exp = now + 7200;
  if (options.isPast) {
    nbf = now - 7200;
    exp = now - 60;
  }
  if (options.isFuture) {
    nbf = now + 3600;
    exp = now + 7200;
  }
  return jwt.sign(
    {
      iss: 'eventyay',
      aud: 'loungemesh',
      jti: 'e2e-' + Math.random().toString(36).slice(2),
      sub: options.sub || '1',
      name: options.userName || (options.role === 'host' ? 'Host User' : options.role === 'moderator' ? 'Mod User' : 'Attendee User'),
      event: options.eventSlug,
      room: String(options.room),
      jitsi_room: `lms-${options.eventSlug}-${options.room}`,
      role: options.role,
      features: { notes: true, whiteboard: true, spatial_chat: true },
      allowed: true,
      iat: now,
      nbf: nbf,
      exp: exp,
    },
    SERVICE_SECRET,
    { algorithm: 'HS256' }
  );
}

test.describe('End-to-End Live UI and Permissions Verification', () => {

  test('1. Eventyay Admin: Test LoungeMesh Server Connection via Cloudflare Tunnel', async ({ page }) => {
    // Navigate to Eventyay login
    await page.goto(`${EVENTYAY_BASE_URL}/login/?next=/admin/video/loungemesh/new/`);
    await page.locator('#id_email').fill('admin@eventyay.com');
    await page.locator('#id_password').fill('AdminPass123!');
    await page.locator('button[type="submit"]').click();

    // Wait for either the form #id_url or the "Start session" admin mode button
    const startSessionBtn = page.getByRole('button', { name: 'Start session' });
    const urlInput = page.locator('#id_url');

    await Promise.race([
      startSessionBtn.waitFor({ state: 'visible', timeout: 8000 }),
      urlInput.waitFor({ state: 'visible', timeout: 8000 }),
    ]).catch(() => {});

    if (await startSessionBtn.isVisible()) {
      await startSessionBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Confirm navigation to add form
    await expect(page.locator('#id_url')).toBeVisible({ timeout: 15000 });

    // Fill server URL with Cloudflare tunnel and service secret
    await page.locator('#id_url').fill(LOUNGEMESH_TUNNEL_URL);
    await page.locator('#id_api_secret').fill(SERVICE_SECRET);

    // Click Test Connection button
    const testBtn = page.locator('[data-loungemesh-test-btn]');
    await expect(testBtn).toBeVisible();
    await testBtn.click();

    // Verify success alert
    const resultAlert = page.locator('[data-loungemesh-test-result]');
    await expect(resultAlert).toBeVisible({ timeout: 15000 });
    await expect(resultAlert).toHaveClass(/alert-success/);
    await expect(resultAlert).toContainText('Connection successful');

    await page.screenshot({ path: 'test-results/01-eventyay-admin-test-connection.png' });
  });

  test('2. LoungeMesh UI: Host Join, Role Badge, Quick Actions, and Media Toggles', async ({ page, context }) => {
    // Grant permissions for camera, microphone, and notifications
    await context.grantPermissions(['camera', 'microphone']);

    const hostGrant = makeGrant({
      role: 'host',
      eventSlug: 'perf-summit-2026',
      room: '20',
      userName: 'Dr. Host Organizer',
      sub: '1',
    });

    const joinUrl = `${LOUNGEMESH_DIRECT_URL}/join/lms-perf-summit-2026-20?grant=${hostGrant}`;
    await page.goto(joinUrl);

    // Wait for redirect into session
    await expect(page).toHaveURL(/\/session\/lms-perf-summit-2026-20$/, { timeout: 20000 });

    // Verify Host role badge
    const roleBadge = page.getByTestId('header-role-badge');
    await expect(roleBadge).toContainText('Host', { timeout: 10000 });

    // Verify Host quick action buttons
    await expect(page.getByTestId('quick-add-attendee-btn')).toBeVisible();
    await expect(page.getByTestId('quick-share-link-btn')).toBeVisible();

    // Verify footer bar is rendered
    const footer = page.locator('.footer, [data-testid="footer-bar"]');
    await expect(footer.first()).toBeVisible();

    // Verify Host controls button
    const modBtn = footer.getByRole('button', { name: 'Moderator' });
    await expect(modBtn).toBeVisible();

    // Test WebRTC Media Controls: Camera Toggle
    const camBtn = footer.getByRole('button', { name: /camera/i });
    await expect(camBtn).toBeVisible();
    await camBtn.click();
    await page.waitForTimeout(300);
    await camBtn.click();

    // Test WebRTC Media Controls: Mic Toggle
    const micBtn = footer.getByRole('button', { name: /Mute|Unmute/i });
    await expect(micBtn).toBeVisible();
    await micBtn.click();
    await page.waitForTimeout(300);
    await micBtn.click();

    // Test Screenshare button presence and clickability
    const screenshareBtn = footer.getByRole('button', { name: /Screenshare/i });
    await expect(screenshareBtn).toBeVisible();

    // Verify Host Controls drawer opens
    await modBtn.click();
    await expect(page.getByText('Host Controls & Settings')).toBeVisible();
    await expect(page.getByText('Room appearance')).toBeVisible();
    await expect(page.getByText('Feature access')).toBeVisible();

    await page.screenshot({ path: 'test-results/02-host-controls-and-video.png' });
  });

  test('3. LoungeMesh UI: Moderator Join and Permissions', async ({ page }) => {
    const modGrant = makeGrant({
      role: 'moderator',
      eventSlug: 'perf-summit-2026',
      room: '20',
      userName: 'Alice Moderator',
      sub: '5',
    });

    const joinUrl = `${LOUNGEMESH_DIRECT_URL}/join/lms-perf-summit-2026-20?grant=${modGrant}`;
    await page.goto(joinUrl);

    await expect(page).toHaveURL(/\/session\/lms-perf-summit-2026-20$/, { timeout: 20000 });

    const roleBadge = page.getByTestId('header-role-badge');
    await expect(roleBadge).toContainText('Moderator', { timeout: 10000 });

    const footer = page.locator('.footer, [data-testid="footer-bar"]');
    await expect(footer.getByRole('button', { name: 'Moderator' })).toBeVisible();

    await page.screenshot({ path: 'test-results/03-moderator-controls.png' });
  });

  test('4. LoungeMesh UI: Attendee Join and Strict Permission Isolation (No Spill)', async ({ page, context }) => {
    await context.grantPermissions(['camera', 'microphone']);

    const attendeeGrant = makeGrant({
      role: 'attendee',
      eventSlug: 'perf-summit-2026',
      room: '20',
      userName: 'Bob Attendee',
      sub: '42',
    });

    const joinUrl = `${LOUNGEMESH_DIRECT_URL}/join/lms-perf-summit-2026-20?grant=${attendeeGrant}`;
    await page.goto(joinUrl);

    await expect(page).toHaveURL(/\/session\/lms-perf-summit-2026-20$/, { timeout: 20000 });

    // Attendee must NOT have Host or Moderator badge
    const roleBadge = page.getByTestId('header-role-badge');
    await expect(roleBadge).not.toContainText('Host');
    await expect(roleBadge).not.toContainText('Moderator');

    // Host-only quick buttons must NOT be visible
    await expect(page.getByTestId('quick-add-attendee-btn')).not.toBeVisible();
    await expect(page.getByTestId('quick-share-link-btn')).not.toBeVisible();

    const footer = page.locator('.footer, [data-testid="footer-bar"]');
    // Moderator / Host Controls button must NOT be visible to attendee
    await expect(footer.getByRole('button', { name: 'Moderator' })).not.toBeVisible();

    // Standard media controls are present and functional
    const camBtn = footer.getByRole('button', { name: /camera/i });
    await expect(camBtn).toBeVisible();
    await camBtn.click();

    const micBtn = footer.getByRole('button', { name: /Mute|Unmute/i });
    await expect(micBtn).toBeVisible();
    await micBtn.click();

    await page.screenshot({ path: 'test-results/04-attendee-isolation.png' });
  });

  test('5. Event Timing: Attendee Access Blocked for Past / Future Events', async ({ page }) => {
    // 5a. Past event (smile) with expired grant -> rejected by LoungeMesh
    const pastGrant = makeGrant({
      role: 'attendee',
      eventSlug: 'smile',
      room: '12',
      isPast: true,
    });
    await page.goto(`${LOUNGEMESH_DIRECT_URL}/join/lms-smile-12?grant=${pastGrant}`);
    // Should show Lounge Not Available / Access to this lounge is restricted
    await expect(page.getByRole('heading', { name: /Lounge Not Available|Access Denied/i })).toBeVisible({ timeout: 10000 });
    await expect(page).not.toHaveURL(/\/session\//);

    // 5b. Future event (zlh9fx) with future nbf grant -> rejected by LoungeMesh
    const futureGrant = makeGrant({
      role: 'attendee',
      eventSlug: 'zlh9fx',
      room: '22',
      isFuture: true,
    });
    await page.goto(`${LOUNGEMESH_DIRECT_URL}/join/lms-zlh9fx-22?grant=${futureGrant}`);
    await expect(page.getByRole('heading', { name: /Lounge Not Available|Access Denied/i })).toBeVisible({ timeout: 10000 });
    await expect(page).not.toHaveURL(/\/session\//);

    // 5c. Host can access past event
    const hostPastGrant = makeGrant({
      role: 'host',
      eventSlug: 'smile',
      room: '12',
      isPast: false, // Host grant valid anytime
    });
    await page.goto(`${LOUNGEMESH_DIRECT_URL}/join/lms-smile-12?grant=${hostPastGrant}`);
    await expect(page).toHaveURL(/\/session\/lms-smile-12$/, { timeout: 20000 });
    await expect(page.getByTestId('header-role-badge')).toContainText('Host');

    await page.screenshot({ path: 'test-results/05-timing-access-control.png' });
  });

});
