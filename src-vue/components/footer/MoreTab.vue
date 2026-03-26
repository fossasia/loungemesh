<script setup lang="ts">
import { ref } from 'vue';
import IconButton from '@/components/ui/IconButton.vue';
import MoreVerticalIcon from '@/components/icons/MoreVerticalIcon.vue';
import MenuCard from '@/components/common/MenuCard.vue';
import GitHubIcon from '@/components/icons/GitHubIcon.vue';
import MessageCircleIcon from '@/components/icons/MessageCircleIcon.vue';

const open = ref(false);
</script>

<template>
  <div class="wrap">
    <MenuCard v-if="open" title="More" :onClose="() => (open = false)">
      <ul class="list">
        <li class="li">
          <a class="a" href="https://github.com/eventyay/flowspace" target="_blank" rel="noopener noreferrer">
            <GitHubIcon class="ico" />
            GitHub
          </a>
        </li>
        <li class="li">
          <a
            class="a"
            href="https://docs.flowspace.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircleIcon class="ico" />
            Documentation
          </a>
        </li>
      </ul>
    </MenuCard>

    <IconButton label="More" :active="open" ghost aria-label="More" @click="open = !open">
      <template #icon><MoreVerticalIcon class="mv" /></template>
    </IconButton>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
}

.mv {
  transform: translateY(1px);
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.li {
  width: 100%;
  list-style: none;
}
.a {
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 15px;
  align-items: center;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--color-mono10);
  padding: 5px 0;
}
.a:visited {
  color: var(--color-mono10);
}
.a:active {
  color: var(--color-text-primary);
}
.a:hover {
  background-color: var(--btn-default-bg-hover);
}
.ico {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: var(--color-mono40);
}
</style>
