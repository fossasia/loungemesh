<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useConferenceStore } from '@/stores/conferenceStore';
import { useLocalStore } from '@/stores/localStore';
import ScreenshareVideo from './ScreenshareVideo.vue';
import ExpandedScreenshare from './ExpandedScreenshare.vue';
import AppIcon from '../ui/AppIcon.vue';

const conference = useConferenceStore();
const local = useLocalStore();

const isCollapsed = ref(false);
const poppedOutIds = ref<string[]>([]);
const showLocalPreview = ref(true);

const screenshares = computed(() => {
  // Access usersEpoch to reactivity trigger on remote user updates
  conference.usersEpoch;
  const list = [];

  if (local.screenshare) {
    list.push({
      id: local.id || 'local',
      name: 'You',
      track: local.screenshare,
    });
  }

  for (const [id, user] of Object.entries(conference.users)) {
    if (user.screenshare) {
      list.push({
        id,
        name: user.user?._displayName || 'Friendly Sphere',
        track: user.screenshare,
      });
    }
  }

  return list;
});

// Sync and clean up poppedOutIds if the track goes away
watch(
  screenshares,
  (newVal) => {
    const activeIds = new Set(newVal.map((item) => item.id));
    poppedOutIds.value = poppedOutIds.value.filter((id) => activeIds.has(id));
  },
  { deep: true },
);

const visibleScreenshares = computed(() => {
  return screenshares.value.filter((item) => !poppedOutIds.value.includes(item.id));
});

const poppedOutScreenshares = computed(() => {
  return screenshares.value.filter((item) => poppedOutIds.value.includes(item.id));
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const popOut = (id: string) => {
  poppedOutIds.value = [...new Set([...poppedOutIds.value, id])];
};

const popIn = (id: string) => {
  poppedOutIds.value = poppedOutIds.value.filter((x) => x !== id);
};
</script>

<template>
  <Transition name="panel-slide">
    <div
      v-if="screenshares.length > 0"
      class="sharedScreensBox"
      :class="{ collapsed: isCollapsed }"
    >
      <div class="boxHeader" @click="toggleCollapse">
        <div class="headerLeft">
          <span class="boxTitle">Shared Screens</span>
          <span class="badge">{{ screenshares.length }}</span>
        </div>
        <button class="collapseButton" type="button" aria-label="Toggle collapse">
          <AppIcon :name="isCollapsed ? 'chevron-down' : 'chevron-up'" :size="16" />
        </button>
      </div>
      <Transition name="collapse">
        <div v-if="!isCollapsed" class="boxContent">
          <div v-if="visibleScreenshares.length === 0" class="emptyState">
            All screens expanded
          </div>
          <TransitionGroup name="screen-item" tag="div" class="screenshareList">
            <div
              v-for="item in visibleScreenshares"
              :key="item.id"
              class="screenshareItem"
              :class="{ 'is-local': item.id === 'local' || item.id === local.id || item.name === 'You' }"
            >
              <div class="itemHeader">
                <span class="itemName">
                  {{ (item.id === 'local' || item.id === local.id || item.name === 'You') ? 'Your Screen' : `${item.name}'s Screen` }}
                  <span v-if="item.id === 'local' || item.id === local.id || item.name === 'You'" class="sharingBadge">Sharing</span>
                </span>
                <template v-if="item.id === 'local' || item.id === local.id || item.name === 'You'">
                  <button
                    class="previewToggleButton"
                    type="button"
                    @click.stop="showLocalPreview = !showLocalPreview"
                    :title="showLocalPreview ? 'Hide preview' : 'Show preview'"
                  >
                    <AppIcon :name="showLocalPreview ? 'eye-off' : 'eye'" :size="14" />
                  </button>
                </template>
                <template v-else>
                  <button
                    class="expandButton"
                    type="button"
                    @click.stop="popOut(item.id)"
                    title="Expand screen"
                  >
                    <AppIcon name="maximize" :size="14" />
                  </button>
                </template>
              </div>
              <div class="videoContainer" v-if="item.id !== 'local' && item.id !== local.id && item.name !== 'You' || showLocalPreview">
                <ScreenshareVideo :track="item.track" />
              </div>
            </div>
          </TransitionGroup>
        </div>
      </Transition>
    </div>
  </Transition>

  <Transition name="expanded-pop">
    <template v-if="poppedOutScreenshares.length > 0">
      <ExpandedScreenshare
        v-for="(item, idx) in poppedOutScreenshares"
        :key="item.id"
        :id="item.id"
        :name="item.name"
        :track="item.track"
        :index="idx"
        @minimize="popIn(item.id)"
      />
    </template>
  </Transition>
</template>

<style scoped>
/* panel entrance */
.panel-slide-enter-active {
  transition: transform 0.3s cubic-bezier(0.34, 1.3, 0.64, 1), opacity 0.25s ease;
}
.panel-slide-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.panel-slide-enter-from {
  transform: translateX(-24px);
  opacity: 0;
}
.panel-slide-leave-to {
  transform: translateX(-12px);
  opacity: 0;
}

/* collapse content */
.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
  overflow: hidden;
}
.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.collapse-enter-to,
.collapse-leave-from {
  max-height: 600px;
  opacity: 1;
}

/* individual screen items */
.screen-item-enter-active {
  transition: transform 0.22s ease, opacity 0.2s ease;
}
.screen-item-leave-active {
  transition: transform 0.16s ease-in, opacity 0.16s ease-in;
}
.screen-item-enter-from {
  transform: translateY(-8px);
  opacity: 0;
}
.screen-item-leave-to {
  transform: translateY(-4px);
  opacity: 0;
}

/* expanded pop */
.expanded-pop-enter-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.2s ease;
}
.expanded-pop-leave-active {
  transition: transform 0.16s ease-in, opacity 0.16s ease-in;
}
.expanded-pop-enter-from {
  transform: scale(0.88);
  opacity: 0;
}
.expanded-pop-leave-to {
  transform: scale(0.92);
  opacity: 0;
}
.sharedScreensBox {
  position: fixed;
  left: 32px;
  top: 80px;
  width: 300px;
  max-height: calc(100vh - 200px);
  z-index: 4000; /* below footer, above room items */
  background: rgba(245, 247, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid var(--line-light);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.boxHeader {
  padding: 12px 16px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.sharedScreensBox:not(.collapsed) .boxHeader {
  border-bottom: 1px solid var(--line-light);
}

.headerLeft {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.boxTitle {
  font-weight: var(--fw-medium);
  font-family: var(--font-display);
  font-size: var(--fs-body);
  color: var(--color-text-default);
}

.badge {
  font-size: 0.75rem;
  font-weight: var(--fw-bold);
  background: var(--color-blue100);
  color: #fff;
  padding: 2px 8px;
  border-radius: 12px;
}

.collapseButton {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-mono30);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.collapseButton:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-default);
}

.boxContent {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.screenshareList {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.emptyState {
  padding: 16px;
  text-align: center;
  color: var(--color-mono30);
  font-size: var(--fs-small);
  font-style: italic;
}

.screenshareItem {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.screenshareItem.is-local {
  border: 2px solid var(--color-blue100);
  background: rgba(79, 110, 247, 0.08);
  border-radius: var(--radius-sm);
  padding: 8px;
  box-shadow: 0 4px 12px rgba(79, 110, 247, 0.15);
  box-sizing: border-box;
}

.itemHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-small);
  color: var(--color-mono30);
  font-weight: var(--fw-medium);
}

.sharingBadge {
  font-size: 0.65rem;
  font-weight: var(--fw-bold);
  background: var(--color-blue100);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
  text-transform: uppercase;
}

.expandButton,
.previewToggleButton {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-mono30);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.expandButton:hover,
.previewToggleButton:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: var(--color-text-default);
}

.previewToggleButton {
  color: var(--color-blue100);
}

.previewToggleButton:hover {
  background-color: rgba(79, 110, 247, 0.1);
  color: var(--color-blue100);
}

.videoContainer {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 16 / 9;
}
</style>
