import { describe, expect, it, vi } from 'vitest';
import { getConnectionOptions } from './connectionOptions';

describe('getConnectionOptions', () => {
  it('uses wss for https public URLs', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', 'https://jitsi.example.com');
    vi.stubEnv('VITE_XMPP_DOMAIN', 'meet.jitsi');
    vi.stubEnv('VITE_XMPP_MUC_DOMAIN', '');
    const opts = getConnectionOptions();
    expect(String(opts.websocket)).toMatch(/^wss:/);
    expect(String(opts.bosh)).toMatch(/^https:/);
  });

  it('returns docker-jitsi-meet style options when public URL and domain are set', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', 'http://localhost:8000');
    vi.stubEnv('VITE_XMPP_DOMAIN', 'meet.jitsi');
    vi.stubEnv('VITE_XMPP_MUC_DOMAIN', 'muc.meet.jitsi');
    const opts = getConnectionOptions();
    expect(opts.hosts).toMatchObject({ domain: 'meet.jitsi', muc: 'muc.meet.jitsi' });
    expect(String(opts.websocket)).toContain('xmpp-websocket');
  });

  it('returns meet.jit.si defaults when no service URL', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', '');
    vi.stubEnv('VITE_XMPP_DOMAIN', '');
    vi.stubEnv('VITE_SERVICE_URL', '');
    const opts = getConnectionOptions();
    expect(opts.hosts).toMatchObject({ domain: 'meet.jit.si' });
  });

  it('returns legacy single-host options with websocket', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', '');
    vi.stubEnv('VITE_XMPP_DOMAIN', '');
    vi.stubEnv('VITE_SERVICE_URL', 'jitsi.example.com');
    vi.stubEnv('VITE_USE_WEBSOCKET', 'true');
    const opts = getConnectionOptions();
    expect(opts.hosts).toMatchObject({ domain: 'jitsi.example.com' });
    expect(String(opts.serviceUrl)).toContain('wss://');
  });

  it('returns legacy bosh when websocket is disabled', () => {
    vi.stubEnv('VITE_JITSI_PUBLIC_URL', '');
    vi.stubEnv('VITE_XMPP_DOMAIN', '');
    vi.stubEnv('VITE_SERVICE_URL', 'jitsi.example.com');
    vi.stubEnv('VITE_USE_WEBSOCKET', 'false');
    const opts = getConnectionOptions();
    expect(String(opts.serviceUrl)).toContain('http-bind');
  });
});
