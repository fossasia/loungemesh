import { describe, expect, it } from 'vitest';
import App from './App.vue';
import { mountWithApp } from '@/test/mountApp';

describe('App', () => {
  it('renders router outlet', async () => {
    const { wrapper } = await mountWithApp(App, { route: '/' });
    expect(wrapper.find('.app').exists()).toBe(true);
  });
});
