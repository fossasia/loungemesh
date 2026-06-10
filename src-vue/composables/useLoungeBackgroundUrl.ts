import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';

/** Host wallpaper plus optional Eventyay event background. */
export function useLoungeBackgroundUrl(eventIdentifier?: MaybeRefOrGetter<string | undefined>) {
  const features = useSessionFeaturesStore();
  const eventBackgroundUrl = ref('');

  watch(
    () => toValue(eventIdentifier),
    async (id) => {
      eventBackgroundUrl.value = '';
      if (!id) return;
      const base = (import.meta.env.VITE_EVENTYAY_API_BASE as string | undefined)?.trim();
      if (!base) return;
      try {
        const res = await fetch(
          `${base.replace(/\/$/, '')}/v1/events/${encodeURIComponent(id)}/loungemesh`,
          { headers: { Accept: 'application/vnd.api+json' } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const url = data?.data?.attributes?.['bg-img-url']?.toString?.();
        if (url) eventBackgroundUrl.value = url;
      } catch {
        /* optional background */
      }
    },
    { immediate: true },
  );

  return computed(() => features.gridBackgroundUrl || eventBackgroundUrl.value);
}
