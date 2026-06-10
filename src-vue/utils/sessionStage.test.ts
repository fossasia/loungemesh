import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import {
  STAGE_OCCUPIED_MESSAGE,
  applyStagePromote,
  applyStageInvite,
  broadcastStageLayout,
  canDemoteFromStage,
  canPromoteToStage,
  clearStageIfParticipantLeft,
  demoteFromStage,
  isStageModeActive,
  promoteToStage,
  resetStageLayout,
  shouldAllowScreenshare,
} from './sessionStage';

describe('sessionStage', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('detects stage mode and screenshare eligibility', () => {
    expect(isStageModeActive('')).toBe(false);
    expect(isStageModeActive('u1')).toBe(true);
    expect(shouldAllowScreenshare('u1', '')).toBe(true);
    expect(shouldAllowScreenshare('u1', 'u2')).toBe(false);
    expect(shouldAllowScreenshare('u2', 'u2')).toBe(true);
  });

  it('guards promotion and demotion', () => {
    const local = useLocalStore();
    local.setMyID('u1');
    expect(canPromoteToStage(false, true, '', 'u2')).toEqual({
      ok: false,
      message: 'Only the host can promote to stage.',
    });
    expect(canPromoteToStage(true, false, '', 'u2')).toEqual({
      ok: false,
      message: 'Stage promotion is disabled.',
    });
    expect(canPromoteToStage(true, true, 'u1', 'u2')).toEqual({
      ok: false,
      message: STAGE_OCCUPIED_MESSAGE,
    });
    expect(canPromoteToStage(true, true, '', 'u2')).toEqual({ ok: true });
    
    // Host demoting occupant
    expect(canDemoteFromStage(true, 'u1', 'u1')).toBe(true);
    expect(canDemoteFromStage(true, 'u1', 'u2')).toBe(false);

    // Non-host self-demotion
    expect(canDemoteFromStage(false, 'u1', 'u1')).toBe(true);

    // Non-host demoting another user
    expect(canDemoteFromStage(false, 'u1', 'u2')).toBe(false);

    // Host canceling invitation for invited guest
    const features = useSessionFeaturesStore();
    features.invitedStageUserId = 'u2';
    expect(canDemoteFromStage(true, '', 'u2')).toBe(true);

    // Guest declining/canceling self-invite
    local.setMyID('u2');
    features.stageInvitationPending = true;
    expect(canDemoteFromStage(false, '', 'u2')).toBe(true);
  });

  it('notifies the local occupant when promoted to stage', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('guest');
    applyStagePromote('guest');
    expect(features.stageOccupantId).toBe('guest');
    expect(local.onStage).toBe(true);
    expect(features.stageMessage).toContain('You are on stage');
  });

  it('promotes and demotes through the engine', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    local.setMyID('host');
    features.setHost('host');
    features.stagePromotionEnabled = true;
    const cmdSpy = vi.spyOn(engine, 'sendCommand');

    const promote = promoteToStage(engine, 'guest');
    expect(promote).toEqual({ ok: true });
    expect(features.invitedStageUserId).toBe('guest');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"invite"'));

    applyStagePromote('guest');
    expect(features.stageOccupantId).toBe('guest');

    demoteFromStage(engine, 'guest');
    expect(features.stageOccupantId).toBe('');
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"action":"demote"'));
  });

  it('broadcasts layout updates only for the stage occupant', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    const cmdSpy = vi.spyOn(engine, 'sendCommand');

    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    broadcastStageLayout(engine, { scale: 1.1, expanded: true });
    expect(features.stageLayout.scale).toBe(1.1);
    expect(features.stageLayout.expanded).toBe(true);
    expect(cmdSpy).toHaveBeenCalledWith('stage', expect.stringContaining('"layout"'));

    local.setMyID('viewer');
    broadcastStageLayout(engine, { scale: 0.8 });
    expect(features.stageLayout.scale).toBe(1.1);
  });

  it('resets the stage layout through the engine', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    local.setMyID('presenter');
    features.stageOccupantId = 'presenter';
    features.stageLayout = { ...features.stageLayout, scale: 1.3, expanded: true };
    resetStageLayout(engine);
    expect(features.stageLayout.scale).toBe(1);
    expect(features.stageLayout.expanded).toBe(false);
  });

  it('clears stage when occupant leaves', () => {
    const features = useSessionFeaturesStore();
    features.stageOccupantId = 'u1';
    clearStageIfParticipantLeft('u1');
    expect(features.stageOccupantId).toBe('');
    clearStageIfParticipantLeft('u2');
    expect(features.stageOccupantId).toBe('');
  });

  it('handles applyStageInvite for remote users', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    local.setMyID('host');
    
    applyStageInvite(engine, 'guest');
    expect(features.invitedStageUserId).toBe('guest');
    expect(features.stageInvitationPending).toBe(false);
  });

  it('handles promoting self to stage', () => {
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    const engine = getMediaEngineInstance();
    local.setMyID('host');
    features.setHost('host');
    features.stagePromotionEnabled = true;

    promoteToStage(engine, 'host');
    expect(features.stageInvitationPending).toBe(true);
  });
});
