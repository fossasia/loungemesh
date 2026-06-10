import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import {
  applyRemoteNotesContent,
  buildToolbarGroups,
  getEditorMarkdown,
  markdownStorage,
  useNotesEditor,
} from './useNotesEditor';

function createChain(run = vi.fn(() => true)) {
  const chain = {
    focus: vi.fn(() => chain),
    toggleBold: vi.fn(() => ({ run })),
    toggleItalic: vi.fn(() => ({ run })),
    toggleStrike: vi.fn(() => ({ run })),
    toggleCode: vi.fn(() => ({ run })),
    toggleHeading: vi.fn(() => ({ run })),
    toggleBulletList: vi.fn(() => ({ run })),
    toggleOrderedList: vi.fn(() => ({ run })),
    toggleBlockquote: vi.fn(() => ({ run })),
    undo: vi.fn(() => ({ run })),
    redo: vi.fn(() => ({ run })),
  };
  return chain;
}

function createMockEditor(overrides: Record<string, unknown> = {}) {
  const chain = createChain();
  return {
    storage: { markdown: { getMarkdown: () => 'draft' } },
    isActive: vi.fn(() => false),
    chain: vi.fn(() => chain),
    can: vi.fn(() => ({ undo: () => true, redo: () => true })),
    commands: { setContent: vi.fn() },
    setEditable: vi.fn(),
    destroy: vi.fn(),
    ...overrides,
  };
}

const useEditorMock = vi.fn();

vi.mock('@tiptap/vue-3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tiptap/vue-3')>();
  return {
    ...actual,
    useEditor: (options: unknown) => useEditorMock(options),
  };
});

describe('notes editor helpers', () => {
  it('reads markdown storage from the editor', () => {
    const ed = { storage: { markdown: { getMarkdown: () => 'hello' } } };
    expect(markdownStorage(ed)).toBe(ed.storage.markdown);
    expect(getEditorMarkdown(ed)).toBe('hello');
    expect(getEditorMarkdown()).toBe('');
    expect(getEditorMarkdown({ storage: {} })).toBe('');
  });

  it('applies remote content only when it changed', () => {
    const editor = ref(createMockEditor());
    applyRemoteNotesContent(editor, 'remote', () => 'local');
    expect(editor.value.commands.setContent).toHaveBeenCalledWith('remote', { emitUpdate: false });

    vi.mocked(editor.value.commands.setContent).mockClear();
    applyRemoteNotesContent(editor, 'same', () => 'same');
    expect(editor.value.commands.setContent).not.toHaveBeenCalled();

    applyRemoteNotesContent(ref(undefined), 'remote');
  });

  it('builds toolbar groups and runs actions', () => {
    const editor = ref(
      createMockEditor({
        isActive: vi.fn((name: string, opts?: { level?: number }) => {
          if (name === 'heading') return opts?.level === 2 || opts?.level === 3;
          return true;
        }),
      }),
    );
    const toolbarEpoch = ref(0);
    const groups = buildToolbarGroups(editor, toolbarEpoch);
    expect(groups.flat()).toHaveLength(11);
    groups.flat().forEach((action) => {
      if (action.active) expect(action.active()).toBe(true);
      action.run();
    });
    expect(editor.value.chain).toHaveBeenCalled();
    expect(groups[3][0].disabled?.()).toBe(false);

    const emptyGroups = buildToolbarGroups(ref(undefined), toolbarEpoch);
    emptyGroups.flat().forEach((action) => {
      if (action.active) expect(action.active()).toBe(false);
      action.run();
    });
    expect(emptyGroups[3][0].disabled?.()).toBe(true);
    expect(emptyGroups[3][1].disabled?.()).toBe(true);

    const disabledEditor = ref(
      createMockEditor({
        can: vi.fn(() => ({ undo: () => false, redo: () => false })),
      }),
    );
    const disabledGroups = buildToolbarGroups(disabledEditor, toolbarEpoch);
    expect(disabledGroups[3][0].disabled?.()).toBe(true);
    expect(disabledGroups[3][1].disabled?.()).toBe(true);
  });
});

describe('useNotesEditor', () => {
  let capturedOptions: Record<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    capturedOptions = {};
    useEditorMock.mockImplementation((options: Record<string, unknown>) => {
      Object.assign(capturedOptions, options);
      return ref(createMockEditor());
    });
  });

  it('wires editor callbacks and lifecycle', async () => {
    const model = ref('start');
    const readonly = ref(false);
    const onBlur = vi.fn();

    const Harness = defineComponent({
      setup() {
        return useNotesEditor({
          model,
          readonly,
          placeholder: 'Placeholder',
          onBlur,
        });
      },
      template: '<div>{{ toolbarGroups.length }}</div>',
    });

    const wrapper = mount(Harness);
    await flushPromises();

    capturedOptions.onUpdate({ editor: createMockEditor({ storage: { markdown: { getMarkdown: () => 'next' } } }) });
    expect(model.value).toBe('next');

    capturedOptions.onUpdate({ editor: createMockEditor({ storage: { markdown: { getMarkdown: () => 'next' } } }) });
    expect(model.value).toBe('next');

    capturedOptions.onBlur();
    expect(onBlur).toHaveBeenCalled();
    capturedOptions.onSelectionUpdate();
    capturedOptions.onTransaction();

    model.value = 'remote';
    await nextTick();
    readonly.value = true;
    await nextTick();
    readonly.value = false;
    await nextTick();

    wrapper.unmount();
    expect(useEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: true,
        editorProps: expect.objectContaining({
          attributes: expect.objectContaining({ dir: 'ltr', 'data-testid': 'notes-editor' }),
        }),
      }),
    );
  });
});
