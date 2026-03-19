import { defineStore } from 'pinia';
import type { JitsiTrackLike } from '@/types/jitsi';
import {
  clampPan,
  clampScale,
  defaultScale,
  initialPanCenterOnUser,
  randomInitialUserPosition,
} from '@/constants/pan';
import { isOnScreen } from '@/utils/vector';
import { useConferenceStore } from './conferenceStore';
import { useConnectionStore } from './connectionStore';

export type Vector2 = { x: number; y: number };

export type LocalState = {
  id: string;
  mute: boolean;
  pos: Vector2;
  pan: Vector2;
  scale: number;
  audio?: JitsiTrackLike;
  video?: JitsiTrackLike;
  videoType?: 'camera' | 'desktop';
  onStage: boolean;
  stageVisible: boolean;
  stageMute: boolean;
  visibleUsers: string[];
  usersOnStage: string[];
  selectedUsersOnStage: string[];
};

export const useLocalStore = defineStore('local', {
  state: (): LocalState => ({
    id: '',
    mute: false,
    pos: randomInitialUserPosition(),
    pan: { x: 0, y: 0 },
    scale: 1,
    audio: undefined,
    video: undefined,
    videoType: 'camera',
    onStage: false,
    stageVisible: true,
    stageMute: false,
    visibleUsers: [],
    usersOnStage: [],
    selectedUsersOnStage: [],
  }),
  actions: {
    setMyID(id: string) {
      this.id = id;
    },
    setLocalPosition(pos: Vector2) {
      this.pos = pos;
    },
    setPanZoom(payload: { pan: Vector2; scale: number }) {
      const scale = clampScale(payload.scale);
      this.scale = scale;
      this.pan = clampPan(payload.pan, scale);
    },
    /** Called when `PanWrapper` mounts — matches legacy TransformWrapper initial pan + random user tile. */
    resetViewportForRoom() {
      this.setLocalPosition(randomInitialUserPosition());
      // Centering depends on `window.innerWidth/Height` which can be wrong during initial layout
      // (fonts, browser UI, etc). Re-run a few times to avoid landing “in a corner”.
      const centerNow = () => {
        if (window.innerWidth < 200 || window.innerHeight < 200) return;
        const pan = initialPanCenterOnUser(this.pos, defaultScale);
        this.setPanZoom({ pan, scale: defaultScale });
      };
      centerNow();
      requestAnimationFrame(centerNow);
      window.setTimeout(centerNow, 150);
    },
    setLocalTracks(tracks: any[]) {
      const audioTrack = tracks.find((t) => t.getType?.() === 'audio');
      const videoTrack = tracks.find((t) => t.getType?.() === 'video');
      if (audioTrack) this.audio = audioTrack;
      if (videoTrack) {
        this.video = videoTrack;
        this.videoType = videoTrack?.videoType === 'desktop' ? 'desktop' : 'camera';
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
      const conference = useConferenceStore().conferenceObject;
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

      const selectedEndpoints = [...this.visibleUsers, ...this.usersOnStage];
      conference?.setReceiverConstraints?.({
        colibriClass: 'SelectedEndpointsChangedEvent',
        selectedEndpoints,
        lastN: selectedEndpoints.length,
        onStageEndpoints: [...this.usersOnStage],
        defaultConstraints: { maxHeight: 200 },
        constraints: {},
      });
    },
    async toggleMute() {
      let audioTrack = this.audio;
      if (!audioTrack) {
        const jsMeet = useConnectionStore().jsMeet;
        if (!jsMeet) return;
        try {
          const tracks = (await jsMeet.createLocalTracks({ devices: ['audio'] })) as any[];
          const created = tracks.find((t) => t.getType?.() === 'audio');
          if (!created) return;
          this.audio = created;
          audioTrack = created;
          const conf = useConferenceStore().conferenceObject;
          if (conf) {
            try {
              await conf.addTrack?.(created);
            } catch {
              /* already added or unsupported */
            }
          }
        } catch {
          return;
        }
      }
      if (!audioTrack) return;
      if (audioTrack.isMuted?.()) {
        audioTrack.unmute?.();
        this.mute = false;
      } else {
        audioTrack.mute?.();
        this.mute = true;
      }
    },
  },
});

