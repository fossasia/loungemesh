import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { JitsiTrack } from '@/types/jitsi';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import {
  clampPan,
  clampScale,
  computeRoomBounds,
  defaultScale,
  initialPanCenterOnUser,
  spreadInitialUserPosition,
  type PanVec,
  type RoomBounds,
} from '@/constants/pan';

function initialLocalViewport(): { pos: PanVec; pan: PanVec; scale: number; roomBounds: RoomBounds } {
  const pos = spreadInitialUserPosition([]);
  const roomBounds = computeRoomBounds([pos]);
  return {
    pos,
    pan: initialPanCenterOnUser(pos, defaultScale),
    scale: defaultScale,
    roomBounds,
  };
}
import { isOnScreen } from '@/utils/vector';
import { conferenceOptions } from '@/config/jitsiOptions';
import { buildReceiverConstraints } from '@/utils/receiverConstraints';
import { disposeJitsiTrack } from '@/utils/disposeJitsiTrack';
import { releaseLocalMediaTracks } from '@/utils/releaseLocalMedia';
import { publishLocalTrackToConference } from '@/utils/conferenceLocalTracks';
import { mediaDebug } from '@/utils/mediaDebug';
import { useConferenceStore } from './conferenceStore';

export type Vector2 = { x: number; y: number };

export type LocalState = {
  id: string;
  mute: boolean;
  cameraOff: boolean;
  speaking: boolean;
  pos: Vector2;
  pan: Vector2;
  scale: number;
  roomBounds: RoomBounds;
  audio?: JitsiTrack;
  video?: JitsiTrack;
  videoType?: 'camera' | 'desktop';
  onStage: boolean;
  stageVisible: boolean;
  stageMute: boolean;
  visibleUsers: string[];
  usersOnStage: string[];
  selectedUsersOnStage: string[];
};

export const useLocalStore = defineStore('local', {
  state: (): LocalState => {
    const { pos, pan, scale, roomBounds } = initialLocalViewport();
    return {
    id: '',
    mute: false,
    cameraOff: false,
    speaking: false,
    pos,
    pan,
    scale,
    roomBounds,
    audio: undefined,
    video: undefined,
    videoType: 'camera',
    onStage: false,
    stageVisible: true,
    stageMute: false,
    visibleUsers: [],
    usersOnStage: [],
    selectedUsersOnStage: [],
  };
  },
  actions: {
    setMyID(id: string) {
      this.id = id;
    },
    setLocalPosition(pos: Vector2) {
      this.pos = pos;
      this.ensureRoomBounds();
    },
    ensureRoomBounds() {
      const conference = useConferenceStore();
      const positions = [
        this.pos,
        ...Object.values(conference.users).map((u) => u.pos),
      ];
      this.roomBounds = computeRoomBounds(positions, this.roomBounds);
    },
    setPanZoom(payload: { pan: Vector2; scale: number }) {
      this.ensureRoomBounds();
      const scale = clampScale(payload.scale);
      this.scale = scale;
      this.pan = clampPan(payload.pan, scale, this.roomBounds);
    },
    resetViewportForRoom() {
      const conference = useConferenceStore();
      const existing = Object.values(conference.users).map((u) => u.pos);
      this.setLocalPosition(spreadInitialUserPosition(existing));
      const centerNow = () => {
        if (window.innerWidth < 200 || window.innerHeight < 200) return;
        const pan = initialPanCenterOnUser(this.pos, defaultScale);
        this.setPanZoom({ pan, scale: defaultScale });
        this.calculateUsersOnScreen();
      };
      centerNow();
      requestAnimationFrame(centerNow);
      window.setTimeout(centerNow, 150);
      window.setTimeout(centerNow, 400);
    },
    publishLocalPosition() {
      const id = this.id;
      if (!id) return;
      getMediaEngineInstance().sendCommand('pos', JSON.stringify({ ...this.pos, id }));
    },
    setLocalTracks(tracks: JitsiTrack[]) {
      const audioTrack = tracks.find((t) => t.getType?.() === 'audio');
      const videoTrack = tracks.find((t) => t.getType?.() === 'video');
      if (audioTrack) this.audio = markRaw(audioTrack);
      if (videoTrack) {
        this.video = markRaw(videoTrack);
        this.videoType = videoTrack.videoType === 'desktop' ? 'desktop' : 'camera';
      }
    },
    setOnStage(v: boolean) {
      this.onStage = v;
    },
    toggleStage() {
      this.stageVisible = !this.stageVisible;
    },
    toggleStageMute() {
      this.stageMute = !this.stageMute;
    },
    setSelectedUserOnStage(id: string) {
      if (this.selectedUsersOnStage[0] === id) this.selectedUsersOnStage = [];
      else this.selectedUsersOnStage = [id];
    },
    calculateUsersOnScreen() {
      const engine = getMediaEngineInstance();
      const conference = engine.getConference();
      const users = useConferenceStore().users;
      const visibleUserIds: string[] = [];
      const stageIds: string[] = [];

      const onStageProp = (v: unknown) => v === true || v === 'true';

      document.querySelectorAll('.userContainer').forEach((el) => {
        const htmlEl = el as HTMLElement;
        const uid = htmlEl.id;
        if (!uid) return;
        const user = users[uid];
        if (user && onStageProp(user.properties?.onStage)) {
          stageIds.push(uid);
        }
        const rect = htmlEl.getBoundingClientRect();
        if (isOnScreen({ x: rect.x, y: rect.y }, rect.width, rect.height)) {
          visibleUserIds.push(uid);
        }
      });

      if (this.onStage && this.id && !stageIds.includes(this.id)) {
        stageIds.push(this.id);
      }

      this.visibleUsers = [...new Set(visibleUserIds)];
      this.usersOnStage = [...new Set(stageIds)];

      mediaDebug('localStore', 'calculateUsersOnScreen', {
        visibleUserIds: this.visibleUsers,
        usersOnStage: this.usersOnStage,
        domUserContainers: document.querySelectorAll('.userContainer').length,
        openBridgeChannel: conferenceOptions.openBridgeChannel,
      });

      if (conferenceOptions.openBridgeChannel) {
        const constraints = buildReceiverConstraints({
          localId: this.id,
          remoteUserIds: Object.keys(users),
          visibleUserIds: this.visibleUsers,
          stageIds: this.usersOnStage,
        });
        if (constraints) {
          mediaDebug('localStore', 'setReceiverConstraints', {
            selectedSources: constraints.selectedSources,
            lastN: constraints.lastN,
            onStageSources: constraints.onStageSources,
          });
          engine.setReceiverConstraints(constraints);
        }
      }
      void conference;
    },
    async toggleMute() {
      const engine = getMediaEngineInstance();
      let audioTrack = this.audio;
      let createdNewTrack = false;
      if (!audioTrack) {
        try {
          const tracks = await engine.createLocalTracks(['audio']);
          const created = tracks.find((t) => t.getType() === 'audio');
          if (!created) return;
          this.audio = markRaw(created);
          audioTrack = created;
          createdNewTrack = true;
          if (engine.isJoined()) {
            try {
              await engine.addLocalTrack(created);
            } catch {
              /* already added */
            }
          }
        } catch {
          return;
        }
      }
      if (createdNewTrack) {
        if (audioTrack.isMuted()) {
          await audioTrack.unmute();
        }
        this.mute = false;
        return;
      }
      if (audioTrack.isMuted()) {
        await audioTrack.unmute();
        this.mute = false;
      } else {
        await audioTrack.mute();
        this.mute = true;
      }
    },
    async toggleCamera() {
      if (this.cameraOff) {
        await this.enableCamera();
        return;
      }
      await this.disableCamera();
    },
    async enableCamera() {
      const engine = getMediaEngineInstance();
      if (this.video && this.videoType === 'camera') {
        this.cameraOff = false;
        if (this.video.isMuted()) await this.video.unmute();
        return;
      }
      try {
        const tracks = await engine.createLocalTracks(['video']);
        const created = tracks.find((t) => t.getType() === 'video');
        if (!created) return;
        disposeJitsiTrack(this.video);
        this.video = markRaw(created);
        this.videoType = 'camera';
        this.cameraOff = false;
        if (engine.isJoined()) {
          const conf = engine.getConference();
          if (conf) {
            try {
              await publishLocalTrackToConference(
                conf,
                created,
                (t) => engine.addLocalTrack(t),
                (oldTrack, nextTrack) => engine.replaceLocalTrack(oldTrack, nextTrack),
              );
            } catch {
              /* conference not ready */
            }
          }
        }
      } catch {
        /* user denied or device unavailable */
      }
    },
    async disableCamera() {
      const engine = getMediaEngineInstance();
      const track = this.video;
      this.cameraOff = true;
      if (!track) return;
      await releaseLocalMediaTracks([track], engine.getConference());
      this.video = undefined;
      this.videoType = 'camera';
    },
    async stopAllLocalMedia() {
      const engine = getMediaEngineInstance();
      await releaseLocalMediaTracks([this.audio, this.video], engine.getConference());
      this.audio = undefined;
      this.video = undefined;
      this.videoType = 'camera';
      this.speaking = false;
      this.cameraOff = true;
      this.mute = true;
    },
  },
});
