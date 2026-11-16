import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NameTag from './NameTag.vue';

describe('NameTag', () => {
  it('renders host icon when role is host', () => {
    const wrapper = mount(NameTag, {
      props: { role: 'host' },
      slots: { default: 'Alice' },
    });
    expect(wrapper.find('.hostIcon').exists()).toBe(true);
    expect(wrapper.find('.hostIcon').text()).toBe('👑');
    expect(wrapper.find('.modIcon').exists()).toBe(false);
    expect(wrapper.text()).toContain('Alice');
  });

  it('renders moderator icon when role is moderator', () => {
    const wrapper = mount(NameTag, {
      props: { role: 'moderator' },
      slots: { default: 'Bob' },
    });
    expect(wrapper.find('.modIcon').exists()).toBe(true);
    expect(wrapper.find('.modIcon').text()).toBe('🛡️');
    expect(wrapper.find('.hostIcon').exists()).toBe(false);
    expect(wrapper.text()).toContain('Bob');
  });

  it('renders without icons when role is attendee or omitted', () => {
    const wrapper = mount(NameTag, {
      props: { role: 'attendee' },
      slots: { default: 'Charlie' },
    });
    expect(wrapper.find('.roleIcon').exists()).toBe(false);
    expect(wrapper.text()).toBe('Charlie');

    const wrapperEmpty = mount(NameTag, {
      slots: { default: 'David' },
    });
    expect(wrapperEmpty.find('.roleIcon').exists()).toBe(false);
    expect(wrapperEmpty.text()).toBe('David');
  });
});
