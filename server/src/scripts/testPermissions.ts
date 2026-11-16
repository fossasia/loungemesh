import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { verifyGrant, GrantError } from '../integration/grant.js';
import { capabilitiesFor, resolveMaxParticipants, EventyayRole, LoungeMeshRole, normalizeRole } from '../integration/roles.js';
import { sha256, randomToken, verifyPkceS256 } from '../oauth/crypto.js';

const TEST_SECRET = 'test_service_secret_32_chars_long_xyz';

function makeGrantToken(payload: Record<string, any>, secret = TEST_SECRET, options: jwt.SignOptions = {}) {
  const now = Math.floor(Date.now() / 1000);
  const base = {
    iss: 'eventyay',
    aud: 'loungemesh',
    jti: 'grant-uuid-' + randomToken(8),
    sub: 'usr-123',
    name: 'Test Participant',
    event: 'test-event',
    room: 'room-456',
    jitsi_room: 'lms-test-event-room-456',
    role: 'attendee',
    allowed: true,
    iat: now,
    nbf: now - 10,
    exp: now + 300,
    ...payload,
  };
  return jwt.sign(base, secret, { algorithm: 'HS256', ...options });
}

async function runTests() {
  console.log('🧪 Starting LoungeMesh Permissions & Security Test Suite...\n');

  // ==========================================
  // 1. Role Capabilities Matrix Verification
  // ==========================================
  console.log('--- 1. Testing Role Capabilities Matrix ---');
  const allRoles: EventyayRole[] = ['host', 'moderator', 'reviewer', 'speaker', 'attendee', 'guest'];

  for (const role of allRoles) {
    const caps = capabilitiesFor(role);
    console.log(`  Role [${role}]: ${JSON.stringify(caps)}`);
  }

  // Host capabilities
  const hostCaps = capabilitiesFor('host');
  assert(hostCaps.includes('settings'), 'Host must have settings capability');
  assert(hostCaps.includes('moderate'), 'Host must have moderate capability');
  assert(hostCaps.includes('poll_manage'), 'Host must have poll_manage capability');
  assert(hostCaps.includes('notes'), 'Host must have notes capability');
  assert(hostCaps.includes('whiteboard'), 'Host must have whiteboard capability');
  assert(hostCaps.includes('record'), 'Host must have record capability');
  assert(hostCaps.includes('review_panel'), 'Host must have review_panel capability');
  assert(hostCaps.includes('speak'), 'Host must have speak capability');

  // Moderator & Reviewer unified tier (has moderate, review_panel, notes, whiteboard, record, speak; no settings)
  const modCaps = capabilitiesFor('moderator');
  assert(modCaps.includes('moderate'), 'Moderator must have moderate capability');
  assert(modCaps.includes('poll_manage'), 'Moderator must have poll_manage capability');
  assert(modCaps.includes('notes'), 'Moderator must have notes capability');
  assert(modCaps.includes('whiteboard'), 'Moderator must have whiteboard capability');
  assert(modCaps.includes('record'), 'Moderator must have record capability');
  assert(modCaps.includes('review_panel'), 'Moderator must have review_panel capability');
  assert(modCaps.includes('speak'), 'Moderator must have speak capability');
  assert(!modCaps.includes('settings'), 'Moderator must NOT have settings capability');

  const revCaps = capabilitiesFor('reviewer');
  assert.deepEqual(revCaps, modCaps, 'Reviewer maps to same capabilities as moderator');

  // Speaker, Attendee, and Guest unified tier (has notes, whiteboard, speak; no moderate or settings)
  const attCaps = capabilitiesFor('attendee');
  assert(attCaps.includes('notes'), 'Attendee tier has notes capability');
  assert(attCaps.includes('whiteboard'), 'Attendee tier has whiteboard capability');
  assert(attCaps.includes('speak'), 'Attendee tier has speak capability');
  assert(!attCaps.includes('moderate'), 'Attendee tier must NOT have moderate capability');
  assert(!attCaps.includes('settings'), 'Attendee tier must NOT have settings capability');

  const spkCaps = capabilitiesFor('speaker');
  assert.deepEqual(spkCaps, attCaps, 'Speaker maps to same capabilities as attendee');

  const guestCaps = capabilitiesFor('guest');
  assert.deepEqual(guestCaps, attCaps, 'Guest maps to same capabilities as attendee');

  // Verify 1:1 canonical LoungeMesh role normalization
  assert.equal(normalizeRole('host'), 'host', 'Host maps 1:1 to host');
  assert.equal(normalizeRole('moderator'), 'moderator', 'Moderator maps 1:1 to moderator');
  assert.equal(normalizeRole('reviewer'), 'moderator', 'Reviewer maps 1:1 to moderator');
  assert.equal(normalizeRole('attendee'), 'attendee', 'Attendee maps 1:1 to attendee');
  assert.equal(normalizeRole('speaker'), 'attendee', 'Speaker maps 1:1 to attendee');
  assert.equal(normalizeRole('guest'), 'attendee', 'Guest maps 1:1 to attendee');
  console.log('✅ Role Capabilities Matrix & 1:1 Mapping passed!\n');

  // ==========================================
  // 2. Capacity Clamping Verification
  // ==========================================
  console.log('--- 2. Testing Capacity Clamping ---');
  process.env.LOUNGEMESH_MAX_PARTICIPANTS = '100';
  assert.equal(resolveMaxParticipants(50), 50, 'Allows valid participant limits');
  assert.equal(resolveMaxParticipants(150), 100, 'Clamps limit exceeding server max to 100');
  assert.equal(resolveMaxParticipants(0), 50, 'Defaults 0 to 50');
  assert.equal(resolveMaxParticipants(-10), 50, 'Defaults negative to 50');
  assert.equal(resolveMaxParticipants(undefined), 50, 'Defaults undefined to 50');
  console.log('✅ Capacity Clamping passed!\n');

  // ==========================================
  // 3. Grant Signature & Verification
  // ==========================================
  console.log('--- 3. Testing Grant Verification (Eventyay → LoungeMesh) ---');
  for (const role of allRoles) {
    const token = makeGrantToken({ role, name: `User ${role}`, allowed: true });
    const verified = verifyGrant(token, TEST_SECRET);
    assert.equal(verified.role, role, `Grant role must verify as ${role}`);
    assert.equal(verified.allowed, true);
    assert.equal(verified.jitsiRoom, 'lms-test-event-room-456');
    assert.equal(verified.event, 'test-event');
    assert.equal(verified.room, 'room-456');
    assert(verified.jti.startsWith('grant-uuid-'));
  }

  // Verification errors:
  // Tampered token
  const validToken = makeGrantToken({ role: 'host' });
  const parts = validToken.split('.');
  const tamperedSig = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
  assert.throws(() => verifyGrant(tampered, TEST_SECRET), (err: any) => err instanceof GrantError && err.code === 'grant_invalid');

  // Expired token
  const expiredToken = makeGrantToken({ exp: Math.floor(Date.now() / 1000) - 20 });
  assert.throws(() => verifyGrant(expiredToken, TEST_SECRET), (err: any) => err instanceof GrantError && err.code === 'grant_expired');

  // Wrong secret
  assert.throws(() => verifyGrant(validToken, 'completely_wrong_secret_key_1234567'), (err: any) => err instanceof GrantError && err.code === 'grant_invalid');

  // Missing secret on server
  assert.throws(() => verifyGrant(validToken, ''), (err: any) => err instanceof GrantError && err.code === 'integration_not_configured');

  // Invalid role in grant
  const invalidRoleToken = makeGrantToken({ role: 'super_admin_fake' });
  assert.throws(() => verifyGrant(invalidRoleToken, TEST_SECRET), (err: any) => err instanceof GrantError && err.code === 'grant_invalid');

  // Missing jti or room
  const missingFieldToken = makeGrantToken({ jti: undefined });
  assert.throws(() => verifyGrant(missingFieldToken, TEST_SECRET), (err: any) => err instanceof GrantError && err.code === 'grant_invalid');

  console.log('✅ Grant Verification and Security Rejection passed!\n');

  // ==========================================
  // 4. PKCE OAuth2 Verification
  // ==========================================
  console.log('--- 4. Testing PKCE S256 Crypto (Eventyay ↔ LoungeMesh) ---');
  const verifier = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const expectedChallenge = crypto.createHash('sha256').update(verifier).digest('base64url');

  assert.equal(verifyPkceS256(verifier, expectedChallenge), true, 'Valid code verifier matches challenge');
  assert.equal(verifyPkceS256('wrong_verifier_string', expectedChallenge), false, 'Wrong verifier fails');
  assert.equal(verifyPkceS256('', expectedChallenge), false, 'Empty verifier fails');
  assert.equal(verifyPkceS256(verifier, ''), false, 'Empty challenge fails');

  console.log('✅ PKCE S256 OAuth2 Verification passed!\n');

  // ==========================================
  // 5. Meeting PIN & Single-User Grant Checks
  // ==========================================
  console.log('--- 5. Testing Meeting PIN & Single-User Grants ---');
  const pinGrantToken = makeGrantToken({
    role: 'attendee',
    jti: 'single-user-jti-123',
    pin: '7890',
    single_user: true,
  });
  const verifiedPinGrant = verifyGrant(pinGrantToken, TEST_SECRET);
  assert.equal(verifiedPinGrant.pin, '7890', 'Verified grant preserves meeting PIN');
  assert.equal(verifiedPinGrant.singleUser, true, 'Verified grant enforces singleUser flag');
  assert.equal(verifiedPinGrant.jti, 'single-user-jti-123', 'Verified grant preserves unique jti');

  console.log('✅ Meeting PIN & Single-User Grant Verification passed!\n');

  console.log('🎉 ALL INTEGRATION PERMISSION & AUTH CHECKS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
