import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import StageButton from './StageButton.vue';

describe('StageButton', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('toggles onStage and clears on unmount', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('u1');
    features.setRoomDefault('stage', true);
    const setStage = vi.spyOn(getMediaEngineInstance(), 'setLocalParticipantProperty');

    const { wrapper } = await mountWithApp(StageButton);
    expect(local.onStage).toBe(false);
    await wrapper.find('button.ibtn').trigger('click');
    expect(local.onStage).toBe(true);
    expect(setStage).toHaveBeenCalledWith('onStage', true);
    wrapper.unmount();
    expect(local.onStage).toBe(false);
  });

  it('does not enter stage without permission', async () => {
    const local = useLocalStore();
    const features = useSessionFeaturesStore();
    local.setMyID('u1');
    features.setHost('host');
    features.roomDefaults = { notes: false, whiteboard: false, poll: false, stage: false };
    const { wrapper } = await mountWithApp(StageButton);
    await wrapper.find('button.ibtn').trigger('click');
    expect(local.onStage).toBe(false);
    wrapper.unmount();
  });
});
