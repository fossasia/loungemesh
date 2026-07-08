import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { mountWithApp } from '@/test/mountApp';
import { getMediaEngineInstance } from '@/services/mediaEngineSingleton';
import { useLocalStore } from '@/stores/localStore';
import { useSessionFeaturesStore } from '@/stores/sessionFeaturesStore';
import HostRoomSettingsSection from './HostRoomSettingsSection.vue';
import { GridBackgroundError, processGridBackgroundFile } from '@/utils/gridBackgroundImage';
import { NotesTemplateError, processNotesTemplateFile } from '@/utils/notesTemplateFile';

vi.mock('@/utils/gridBackgroundImage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/gridBackgroundImage')>();
  return { ...actual, processGridBackgroundFile: vi.fn() };
});

vi.mock('@/utils/notesTemplateFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/notesTemplateFile')>();
  return { ...actual, processNotesTemplateFile: vi.fn() };
});

function fileInput(wrapper: Awaited<ReturnType<typeof mountWithApp>>['wrapper'], index = 0) {
  return wrapper.findAll('input[type="file"]')[index]!;
}

function setInputFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    value: files,
    configurable: true,
  });
}

describe('HostRoomSettingsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const features = useSessionFeaturesStore();
    const local = useLocalStore();
    local.setMyID('host');
    features.setHost('host');
    features.hostSettingsSessionId = 'room-1';
  });

  it('uploads and syncs a grid background', async () => {
    vi.mocked(processGridBackgroundFile).mockResolvedValue('data:image/jpeg;base64,wall');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    setInputFiles(fileInput(wrapper).element as HTMLInputElement, [file]);
    await fileInput(wrapper).trigger('change');
    await flushPromises();
    const features = useSessionFeaturesStore();
    expect(features.gridBackgroundUrl).toBe('data:image/jpeg;base64,wall');
    expect(cmdSpy).toHaveBeenCalledWith('room', expect.stringContaining('reload'));
    expect(wrapper.find('.preview').exists()).toBe(true);
    wrapper.unmount();
  });

  it('shows background errors and clears the wallpaper', async () => {
    vi.mocked(processGridBackgroundFile).mockRejectedValue(new GridBackgroundError('Too big'));
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    setInputFiles(fileInput(wrapper).element as HTMLInputElement, [file]);
    await fileInput(wrapper).trigger('change');
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Too big');

    vi.mocked(processGridBackgroundFile).mockResolvedValue('data:image/jpeg;base64,wall');
    setInputFiles(fileInput(wrapper).element as HTMLInputElement, [file]);
    await fileInput(wrapper).trigger('change');
    await flushPromises();
    await wrapper.find('.pill.subtle').trigger('click');
    expect(useSessionFeaturesStore().gridBackgroundUrl).toBe('');
    expect(cmdSpy).toHaveBeenCalledWith('room', JSON.stringify({ action: 'clear' }));
    wrapper.unmount();
  });

  it('handles generic background failures', async () => {
    vi.mocked(processGridBackgroundFile).mockRejectedValue(new Error('boom'));
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    setInputFiles(fileInput(wrapper).element as HTMLInputElement, [file]);
    await fileInput(wrapper).trigger('change');
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Could not use that image.');
    wrapper.unmount();
  });

  it('ignores empty background file selection', async () => {
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    setInputFiles(fileInput(wrapper).element as HTMLInputElement, []);
    await fileInput(wrapper).trigger('change');
    await flushPromises();
    expect(processGridBackgroundFile).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('uploads a notes template and publishes when notes are empty', async () => {
    vi.mocked(processNotesTemplateFile).mockResolvedValue('# Agenda');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['# Agenda'], 'notes.md', { type: 'text/markdown' });
    setInputFiles(fileInput(wrapper, 1).element as HTMLInputElement, [file]);
    await fileInput(wrapper, 1).trigger('change');
    await flushPromises();
    const features = useSessionFeaturesStore();
    expect(features.notesTemplate).toBe('# Agenda');
    expect(features.sharedNotes).toBe('# Agenda');
    expect(cmdSpy).toHaveBeenCalledWith('notes', JSON.stringify({ action: 'begin', total: 1 }));
    expect(wrapper.find('.templateStatus').exists()).toBe(true);
    wrapper.unmount();
  });

  it('stores template without overwriting existing shared notes', async () => {
    const features = useSessionFeaturesStore();
    features.sharedNotes = 'existing';
    vi.mocked(processNotesTemplateFile).mockResolvedValue('# Template');
    const cmdSpy = vi.spyOn(getMediaEngineInstance(), 'sendCommand');
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['# Template'], 'notes.md', { type: 'text/markdown' });
    setInputFiles(fileInput(wrapper, 1).element as HTMLInputElement, [file]);
    await fileInput(wrapper, 1).trigger('change');
    await flushPromises();
    expect(features.notesTemplate).toBe('# Template');
    expect(features.sharedNotes).toBe('existing');
    expect(cmdSpy).not.toHaveBeenCalledWith('notes', expect.any(String));
    await wrapper.findAll('.pill.subtle')[0]!.trigger('click');
    expect(features.notesTemplate).toBe('');
    wrapper.unmount();
  });

  it('shows template errors and ignores empty selection', async () => {
    vi.mocked(processNotesTemplateFile).mockRejectedValue(new NotesTemplateError('Bad file'));
    const { wrapper } = await mountWithApp(HostRoomSettingsSection);
    const file = new File(['x'], 'notes.md', { type: 'text/markdown' });
    setInputFiles(fileInput(wrapper, 1).element as HTMLInputElement, [file]);
    await fileInput(wrapper, 1).trigger('change');
    await flushPromises();
    expect(wrapper.findAll('.error').at(-1)?.text()).toBe('Bad file');

    vi.mocked(processNotesTemplateFile).mockRejectedValue(new Error('boom'));
    setInputFiles(fileInput(wrapper, 1).element as HTMLInputElement, [file]);
    await fileInput(wrapper, 1).trigger('change');
    await flushPromises();
    expect(wrapper.findAll('.error').at(-1)?.text()).toBe('Could not read that template.');

    setInputFiles(fileInput(wrapper, 1).element as HTMLInputElement, []);
    await fileInput(wrapper, 1).trigger('change');
    await flushPromises();
    expect(processNotesTemplateFile).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
});
