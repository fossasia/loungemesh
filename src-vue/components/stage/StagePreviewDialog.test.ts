import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import StagePreviewDialog from './StagePreviewDialog.vue';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';

async function mountPreviewDialog() {
  return mountWithApp(StagePreviewDialog);
}

describe('StagePreviewDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders invitation prompt when stageInvitationPending is true', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;

    const { wrapper } = await mountPreviewDialog();
    expect(wrapper.text()).toContain('Stage Setup');
    expect(wrapper.text()).toContain('You are asked to go on stage');
    wrapper.unmount();
  });

  it('allows going live when clicking Go Live button', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    const { wrapper } = await mountPreviewDialog();
    await wrapper.find('.actionBtn.primary').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"promote"'));
    expect(features.stageOccupantId).toBe('me');
    expect(local.onStage).toBe(true);
    wrapper.unmount();
  });

  it('declines invitation when clicking Decline button', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    features.stageInvitationPending = true;

    const { wrapper } = await mountPreviewDialog();
    await wrapper.find('.actionBtn.secondary').trigger('click');
    expect(features.stageInvitationPending).toBe(false);
    wrapper.unmount();
  });

  it('allows leaving stage when user is occupant', async () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('me');
    local.setOnStage(true);
    features.stageOccupantId = 'me';
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');

    const { wrapper } = await mountPreviewDialog();
    expect(wrapper.text()).toContain('You are live on stage');
    await wrapper.find('.actionBtn.warn').trigger('click');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"demote"'));
    wrapper.unmount();
  });
});
