import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, markRaw, ref } from 'vue';
import { useNotesEditor } from '@/composables/useNotesEditor';
import { mountWithApp } from '@/test/mountApp';
import NotesEditor from './NotesEditor.vue';

const Icon = markRaw(defineComponent({ template: '<span />' }));

function createToolbarGroups() {
  return [
    [
      { icon: Icon, title: 'Bold', active: () => true, run: vi.fn() },
      { icon: Icon, title: 'Italic', run: vi.fn() },
      { icon: Icon, title: 'Strikethrough', run: vi.fn() },
      { icon: Icon, title: 'Inline code', run: vi.fn() },
    ],
    [
      { icon: Icon, title: 'Heading 2', run: vi.fn() },
      { icon: Icon, title: 'Heading 3', run: vi.fn() },
    ],
    [
      { icon: Icon, title: 'Bullet list', run: vi.fn() },
      { icon: Icon, title: 'Numbered list', run: vi.fn() },
      { icon: Icon, title: 'Quote', run: vi.fn() },
    ],
    [
      { icon: Icon, title: 'Undo', disabled: () => true, run: vi.fn() },
      { icon: Icon, title: 'Redo', disabled: () => true, run: vi.fn() },
    ],
  ];
}

let toolbarGroups = createToolbarGroups();

vi.mock('@/composables/useNotesEditor', () => ({
  useNotesEditor: vi.fn(() => ({
    editor: ref({}),
    toolbarGroups: ref(toolbarGroups),
  })),
}));

vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/vue-3')>();
  return {
    ...actual,
    EditorContent: {
      props: ['editor'],
      template: '<div data-testid="notes-editor" dir="ltr">editor</div>',
    },
  };
});

describe('NotesEditor', () => {
  it('renders toolbar actions and handles clicks', async () => {
    toolbarGroups = createToolbarGroups();
    const { wrapper } = await mountWithApp(NotesEditor, {
      props: { modelValue: '', readonly: false },
    });
    await flushPromises();
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Bold"]').classes()).toContain('active');
    expect(wrapper.find('[aria-label="Undo"]').attributes('disabled')).toBeDefined();

    for (const action of toolbarGroups.flat()) {
      const btn = wrapper.find(`[aria-label="${action.title}"]`);
      await btn.trigger('mousedown');
      if (action.disabled?.()) continue;
      await btn.trigger('click');
    }
    toolbarGroups
      .flat()
      .filter((action) => !action.disabled?.())
      .forEach((action) => expect(action.run).toHaveBeenCalled());
    wrapper.unmount();
  });

  it('hides the toolbar in readonly mode', async () => {
    const { wrapper } = await mountWithApp(NotesEditor, {
      props: { modelValue: 'Read only', readonly: true },
    });
    await flushPromises();
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(false);
    expect(wrapper.find('.notesEditor').classes()).toContain('readonly');
    wrapper.unmount();
  });

  it('renders the editor surface', async () => {
    const { wrapper } = await mountWithApp(NotesEditor, {
      props: { modelValue: '**bold** text', readonly: false },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="notes-editor"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('emits blur through the editor hook', async () => {
    const onBlur = vi.fn();
    vi.mocked(useNotesEditor).mockImplementationOnce((options) => {
      options.onBlur();
      return { editor: ref({}), toolbarGroups: ref(createToolbarGroups()) };
    });
    const { wrapper } = await mountWithApp(NotesEditor, {
      props: { modelValue: '', onBlur },
    });
    await flushPromises();
    expect(onBlur).toHaveBeenCalled();
    wrapper.unmount();
  });
});
