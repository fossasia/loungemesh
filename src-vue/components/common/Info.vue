<script setup lang="ts">
import { computed } from 'vue';
import { useInfoStore } from '@/stores/infoStore';

const props = withDefaults(
  defineProps<{
    /** When true, visibility follows the prototype banner store (dismiss hides). */
    managed?: boolean;
  }>(),
  { managed: true }
);

const emit = defineEmits<{
  dismiss: [];
}>();

const info = useInfoStore();

const visible = computed(() => (props.managed ? info.show : true));

function onDismiss() {
  if (props.managed) info.setHidden();
  else emit('dismiss');
}
</script>

<template>
  <div v-if="visible" class="wrap" @click="onDismiss">
    <div class="box">
      <slot />
      <button type="button" class="close" aria-label="Close" @click.stop="onDismiss">×</button>
    </div>
  </div>
</template>

<style scoped>
/* Legacy `InfoBox` from src/components/common/Info/Info.tsx */
.wrap {
  user-select: none;
  position: fixed;
  margin: 10px auto;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  z-index: 10001;
}

.box {
  position: relative;
  padding: 15px 36px 15px 25px;
  font-size: 0.9rem;
  font-weight: normal;
  font-family: var(--font-body);
  background-color: #fff;
  border-radius: var(--radius-sm);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.25);
  color: #555;
  text-align: center;
}

.box:hover {
  background-color: #fefefe;
  box-shadow: 0 0 1px rgba(0, 0, 0, 0.7);
}

.box :deep(b) {
  color: #000;
}

.close {
  position: absolute;
  right: 5px;
  top: 5px;
  border: none;
  background: none;
  padding: 4px 8px;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  color: #555;
  border-radius: 4px;
}

.close:hover {
  background: rgba(0, 0, 0, 0.06);
}
</style>
