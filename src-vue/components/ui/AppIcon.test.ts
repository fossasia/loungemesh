import { describe, it, expect } from 'vitest';
import { mountWithApp } from '@/test/mountApp';
import AppIcon, { type IconName } from './AppIcon.vue';

const ICON_NAMES: IconName[] = [
  'arrow-right',
  'bar-chart',
  'bell',
  'bell-off',
  'chat',
  'close',
  'eye-off',
  'file-text',
  'hand',
  'mic',
  'mic-off',
  'minus',
  'monitor-up',
  'more-vertical',
  'pencil',
  'plus',
  'smile',
  'stage',
  'user',
  'video',
  'video-off',
  'volume-x',
];

describe('AppIcon', () => {
  it('renders highlight styling on IconButton', async () => {
    const IconButton = (await import('../ui/IconButton.vue')).default;
    const { wrapper } = await mountWithApp(IconButton, {
      props: { label: 'Chat', highlight: true },
      slots: { icon: '<span data-test="ic" />' },
    });
    expect(wrapper.classes()).toContain('highlight');
    wrapper.unmount();
  });

  it.each(ICON_NAMES)('renders %s', async (name) => {
    const { wrapper } = await mountWithApp(AppIcon, { props: { name } });
    expect(wrapper.find('svg').exists()).toBe(true);
    wrapper.unmount();
  });
});
