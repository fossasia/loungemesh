import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusScreen from './StatusScreen.vue';

describe('StatusScreen', () => {
  it('renders a warning card and hides an empty message', () => {
    const wrapper = mount(StatusScreen, {
      props: { title: 'Access Revoked', icon: 'log-out', tone: 'warning' },
      slots: { default: '<button class="btnHome">Return</button>' },
    });
    expect(wrapper.text()).toContain('Access Revoked');
    expect(wrapper.find('.message').exists()).toBe(false);
    expect(wrapper.find('.iconCircle').classes()).toContain('warning');
    expect(wrapper.find('.btnHome').exists()).toBe(true);
  });

  it('renders an info message', () => {
    const wrapper = mount(StatusScreen, {
      props: { title: 'Hello', message: 'Details', icon: 'info' },
    });
    expect(wrapper.find('.message').text()).toBe('Details');
    expect(wrapper.find('.iconCircle').classes()).toContain('info');
  });
});
