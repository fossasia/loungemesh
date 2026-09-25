import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import {
  MEDIA_DEVICE_PREFS_KEY,
  saveMediaDevicePrefs,
} from '@/utils/mediaDevicePrefs';
import DeviceSettingsPanel from './DeviceSettingsPanel.vue';

vi.mock('@/utils/deviceSettings', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/utils/deviceSettings')>();
  return {
    ...orig,
    supportsAudioOutput: () => mockSupportsOutput(),
  };
});

let mockSupportsOutput = () => true;

function fakeDevice(kind: MediaDeviceKind, deviceId: string, label = ''): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) } as MediaDeviceInfo;
}

describe('DeviceSettingsPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.removeItem(MEDIA_DEVICE_PREFS_KEY);
    mockSupportsOutput = () => true;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          fakeDevice('audioinput', 'm1', 'Mic One'),
          fakeDevice('videoinput', 'c1', 'Cam One'),
          fakeDevice('audiooutput', 's1', 'Speakers'),
        ]),
      },
    });
  });

  it('lists devices and switches camera, mic, and speaker', async () => {
    saveMediaDevicePrefs({ videoinput: 'c1', audioinput: 'm1', audiooutput: 's1' });
    const local = useLocalStore();
    const cam = vi.spyOn(local, 'switchVideoInput').mockResolvedValue(undefined);
    const mic = vi.spyOn(local, 'switchAudioInput').mockResolvedValue(undefined);
    const out = vi.spyOn(local, 'switchAudioOutput').mockResolvedValue(undefined);
    const { wrapper } = await mountWithApp(DeviceSettingsPanel);
    await flushPromises();
    expect(wrapper.find('[aria-label="Device settings"]').exists()).toBe(true);
    const rows = wrapper.findAll('button.deviceRow');
    expect(rows).toHaveLength(3);
    await rows[0].trigger('click');
    await rows[1].trigger('click');
    await rows[2].trigger('click');
    expect(cam).toHaveBeenCalledWith('c1');
    expect(mic).toHaveBeenCalledWith('m1');
    expect(out).toHaveBeenCalledWith('s1');
    wrapper.unmount();
  });

  it('shows empty-state copy when no devices are available', async () => {
    (navigator.mediaDevices.enumerateDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { wrapper } = await mountWithApp(DeviceSettingsPanel);
    await flushPromises();
    expect(wrapper.text()).toContain('No cameras found');
    expect(wrapper.text()).toContain('No microphones found');
    expect(wrapper.text()).toContain('No speakers found');
    wrapper.unmount();
  });

  it('hides speakers when setSinkId is unsupported', async () => {
    mockSupportsOutput = () => false;
    const { wrapper } = await mountWithApp(DeviceSettingsPanel);
    await flushPromises();
    expect(wrapper.text()).not.toContain('Speaker');
    wrapper.unmount();
  });

  it('closes from backdrop, close button, and Escape', async () => {
    const { wrapper } = await mountWithApp(DeviceSettingsPanel);
    await flushPromises();
    await wrapper.find('.deviceBackdrop').trigger('click');
    expect(wrapper.emitted('close')?.length).toBe(1);
    await wrapper.find('.closeRow').trigger('click');
    expect(wrapper.emitted('close')?.length).toBe(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(wrapper.emitted('close')?.length).toBe(3);
    wrapper.unmount();
  });
});
