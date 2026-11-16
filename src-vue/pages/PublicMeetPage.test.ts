import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PublicMeetPage from './PublicMeetPage.vue';

let mockParams: Record<string, string> = {
  event: 'test-event',
  room: 'test-room',
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: mockParams,
  }),
}));

describe('PublicMeetPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
    mockParams = {
      event: 'test-event',
      room: 'test-room',
    };
  });

  it('handles empty route parameters gracefully', () => {
    mockParams = {};
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('Loading session information');
    wrapper.unmount();
  });

  it('renders loading state initially', () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('Loading session information');
    wrapper.unmount();
  });

  it('renders meet details when fetch succeeds', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        title: 'Design Workshop Lounge',
        is_full: false,
        capacity: 50,
        guest_link_enabled: false,
      }),
    } as unknown as Response);

    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Design Workshop Lounge');
    expect(wrapper.text()).toContain('50 participants');
    expect(wrapper.text()).toContain('Live Lounge');
    expect(wrapper.find('.join-btn').exists()).toBe(true);
    wrapper.unmount();
  });

  it('renders at capacity badge when is_full is true', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        title: 'Full Lounge',
        is_full: true,
        capacity: 30,
        guest_link_enabled: true,
      }),
    } as unknown as Response);

    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('At Capacity');
    wrapper.unmount();
  });

  it('renders 404 not found error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Lounge session not found');
    wrapper.unmount();
  });

  it('renders generic error for other non-ok status', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as unknown as Response);

    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Could not load session information');
    wrapper.unmount();
  });

  it('renders network error when fetch rejects', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const wrapper = mount(PublicMeetPage, {
      global: { plugins: [createPinia()] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Network error while checking session status');
    wrapper.unmount();
  });
});
