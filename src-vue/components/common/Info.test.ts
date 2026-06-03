import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useInfoStore } from '@/stores/infoStore';
import Info from './Info.vue';

describe('Info', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('dismisses managed info via close button', async () => {
    const info = useInfoStore();
    info.show = true;
    const { wrapper } = await mountWithApp(Info, { props: { managed: true } });
    await wrapper.find('.close').trigger('click');
    expect(info.show).toBe(false);
    wrapper.unmount();
  });

  it('calls onDismiss when unmanaged', async () => {
    const onDismiss = vi.fn();
    const { wrapper } = await mountWithApp(Info, {
      props: { managed: false },
      attrs: { onDismiss },
    });
    await wrapper.find('.wrap').trigger('click');
    wrapper.unmount();
  });
});
