import { computed, onBeforeUnmount, ref, watch, type Component, type Ref } from 'vue';
import { useEditor, type Editor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  TextQuote,
  Undo2,
} from '@lucide/vue';

export function markdownStorage(ed?: { storage: unknown } | null) {
  return (ed?.storage as { markdown?: { getMarkdown: () => string } } | undefined)?.markdown;
}

export function getEditorMarkdown(ed?: { storage: unknown } | null): string {
  return markdownStorage(ed)?.getMarkdown() ?? '';
}

export type ToolbarAction = {
  icon: Component;
  title: string;
  active?: () => boolean;
  disabled?: () => boolean;
  run: () => void;
};

export function buildToolbarGroups(
  editor: Ref<Editor | undefined>,
  toolbarEpoch: Ref<number>,
): ToolbarAction[][] {
  toolbarEpoch.value;
  return [
    [
      {
        icon: Bold,
        title: 'Bold',
        active: () => !!editor.value?.isActive('bold'),
        run: () => editor.value?.chain().focus().toggleBold().run(),
      },
      {
        icon: Italic,
        title: 'Italic',
        active: () => !!editor.value?.isActive('italic'),
        run: () => editor.value?.chain().focus().toggleItalic().run(),
      },
      {
        icon: Strikethrough,
        title: 'Strikethrough',
        active: () => !!editor.value?.isActive('strike'),
        run: () => editor.value?.chain().focus().toggleStrike().run(),
      },
      {
        icon: Code,
        title: 'Inline code',
        active: () => !!editor.value?.isActive('code'),
        run: () => editor.value?.chain().focus().toggleCode().run(),
      },
    ],
    [
      {
        icon: Heading2,
        title: 'Heading 2',
        active: () => !!editor.value?.isActive('heading', { level: 2 }),
        run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        icon: Heading3,
        title: 'Heading 3',
        active: () => !!editor.value?.isActive('heading', { level: 3 }),
        run: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      {
        icon: List,
        title: 'Bullet list',
        active: () => !!editor.value?.isActive('bulletList'),
        run: () => editor.value?.chain().focus().toggleBulletList().run(),
      },
      {
        icon: ListOrdered,
        title: 'Numbered list',
        active: () => !!editor.value?.isActive('orderedList'),
        run: () => editor.value?.chain().focus().toggleOrderedList().run(),
      },
      {
        icon: TextQuote,
        title: 'Quote',
        active: () => !!editor.value?.isActive('blockquote'),
        run: () => editor.value?.chain().focus().toggleBlockquote().run(),
      },
    ],
    [
      {
        icon: Undo2,
        title: 'Undo',
        disabled: () => !editor.value?.can().undo(),
        run: () => editor.value?.chain().focus().undo().run(),
      },
      {
        icon: Redo2,
        title: 'Redo',
        disabled: () => !editor.value?.can().redo(),
        run: () => editor.value?.chain().focus().redo().run(),
      },
    ],
  ];
}

export function applyRemoteNotesContent(
  editor: Ref<Editor | undefined>,
  next: string,
  getMarkdown: (ed?: { storage: unknown } | null) => string = getEditorMarkdown,
) {
  if (!editor.value) return;
  const current = getMarkdown(editor.value);
  if (current === next) return;
  editor.value.commands.setContent(next, { emitUpdate: false });
}

export type NotesEditorOptions = {
  model: Ref<string>;
  readonly: Ref<boolean>;
  placeholder: string;
  onBlur: () => void;
};

export function useNotesEditor({ model, readonly, placeholder, onBlur }: NotesEditorOptions) {
  const toolbarEpoch = ref(0);

  const editor = useEditor({
    content: model.value,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    editable: !readonly.value,
    editorProps: {
      attributes: {
        class: 'notesEditorContent',
        'data-testid': 'notes-editor',
        dir: 'ltr',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = getEditorMarkdown(ed);
      if (md !== model.value) {
        model.value = md;
      }
    },
    onBlur,
    onSelectionUpdate: () => {
      toolbarEpoch.value += 1;
    },
    onTransaction: () => {
      toolbarEpoch.value += 1;
    },
  });

  watch(model, (next) => {
    applyRemoteNotesContent(editor, next);
  });

  watch(readonly, (value) => {
    editor.value?.setEditable(!value);
  });

  onBeforeUnmount(() => {
    editor.value?.destroy();
  });

  const toolbarGroups = computed(() => buildToolbarGroups(editor, toolbarEpoch));

  return { editor, toolbarGroups };
}
