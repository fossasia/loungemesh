import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountWithApp } from '@/test/mountApp';
import WhiteboardPenToolbar from './WhiteboardPenToolbar.vue';

function wheelRect() {
  return { left: 0, top: 0, width: 132, height: 132, right: 132, bottom: 132 } as DOMRect;
}

async function mountToolbar(penColor = '#1e3a8a', penWidth = 4) {
  let wrapper!: Awaited<ReturnType<typeof mountWithApp>>['wrapper'];
  const mounted = await mountWithApp(WhiteboardPenToolbar, {
    props: {
      penColor,
      penWidth,
      'onUpdate:penColor': (v: string) => wrapper.setProps({ penColor: v }),
      'onUpdate:penWidth': (v: number) => wrapper.setProps({ penWidth: v }),
    },
  });
  wrapper = mounted.wrapper;
  return wrapper;
}

describe('WhiteboardPenToolbar', () => {
  it('opens the color wheel and applies a hex code', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbColorTrigger').trigger('click');
    expect(wrapper.find('.wbColorPanel').exists()).toBe(true);
    const input = wrapper.find('.wbHexInput');
    await input.setValue('dc2626');
    await input.trigger('blur');
    expect(wrapper.props('penColor')).toBe('#dc2626');
    expect(wrapper.find('.wbWheelWrap').exists()).toBe(true);
    wrapper.unmount();
  });

  it('keeps the hex field in sync with preset picks', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbColorTrigger').trigger('click');
    await wrapper.find('button.wbPreset[title="Red"]').trigger('click');
    expect((wrapper.find('.wbHexInput').element as HTMLInputElement).value).toBe('dc2626');
    wrapper.unmount();
  });

  it('opens the pen dropdown and selects a size', async () => {
    const wrapper = await mountToolbar('#111827');
    await flushPromises();
    await wrapper.find('.wbPenTrigger').trigger('click');
    const options = wrapper.findAll('.wbPenOption');
    await options[2].trigger('click');
    expect(wrapper.props('penWidth')).toBe(8);
    expect(wrapper.find('.wbPenMenu').exists()).toBe(false);
    wrapper.unmount();
  });

  it('wires picker pointer handlers in the template', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbColorTrigger').trigger('click');
    const wheel = wrapper.find('.wbWheelWrap').element as HTMLElement;
    const box = wrapper.find('.wbSlBox').element as HTMLElement;
    wheel.setPointerCapture = vi.fn();
    box.setPointerCapture = vi.fn();
    wheel.releasePointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
    vi.spyOn(wheel, 'getBoundingClientRect').mockReturnValue(wheelRect());
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 188,
      height: 96,
    } as DOMRect);
    await wheel.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 66, clientY: 12, bubbles: true }),
    );
    await wheel.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 120, clientY: 66, bubbles: true }),
    );
    await box.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 120, clientY: 20, bubbles: true }),
    );
    await box.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 40, clientY: 80, bubbles: true }),
    );
    await wheel.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await wheel.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await box.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await box.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true }));
    await wrapper.find('.wbHexInput').trigger('keydown', { key: 'Enter' });
    wrapper.unmount();
  });

  it('shows a fallback pen label for unknown widths', async () => {
    const wrapper = await mountToolbar('#111827', 99);
    expect(wrapper.find('.wbPenLabel').text()).toBe('Pen');
    wrapper.unmount();
  });

  it('closes panels when toggling the same control again', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbColorTrigger').trigger('click');
    expect(wrapper.find('.wbColorPanel').exists()).toBe(true);
    await wrapper.find('.wbColorTrigger').trigger('click');
    expect(wrapper.find('.wbColorPanel').exists()).toBe(false);

    await wrapper.find('.wbPenTrigger').trigger('click');
    expect(wrapper.find('.wbPenMenu').exists()).toBe(true);
    await wrapper.find('.wbPenTrigger').trigger('click');
    expect(wrapper.find('.wbPenMenu').exists()).toBe(false);
    wrapper.unmount();
  });

  it('closes the color panel when opening the pen menu', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbColorTrigger').trigger('click');
    await wrapper.find('.wbPenTrigger').trigger('click');
    expect(wrapper.find('.wbColorPanel').exists()).toBe(false);
    expect(wrapper.find('.wbPenMenu').exists()).toBe(true);
    wrapper.unmount();
  });

  it('closes the pen menu when opening the color panel', async () => {
    const wrapper = await mountToolbar();
    await flushPromises();
    await wrapper.find('.wbPenTrigger').trigger('click');
    await wrapper.find('.wbColorTrigger').trigger('click');
    expect(wrapper.find('.wbPenMenu').exists()).toBe(false);
    expect(wrapper.find('.wbColorPanel').exists()).toBe(true);
    wrapper.unmount();
  });
});
