import { describe, expect, it } from 'vitest';
import { NOTES_TEMPLATE_REQUIREMENTS } from '@/constants/roomBackground';
import {
  NotesTemplateError,
  notesTemplateRequirementsHint,
  processNotesTemplateFile,
} from './notesTemplateFile';

describe('processNotesTemplateFile', () => {
  it('reads markdown templates', async () => {
    const file = new File(['# Agenda\n\n- Intro'], 'agenda.md', { type: 'text/markdown' });
    await expect(processNotesTemplateFile(file)).resolves.toBe('# Agenda\n\n- Intro');
  });

  it('rejects unsupported extensions', async () => {
    const file = new File(['notes'], 'agenda.doc', { type: 'application/msword' });
    await expect(processNotesTemplateFile(file)).rejects.toBeInstanceOf(NotesTemplateError);
  });

  it('rejects empty templates', async () => {
    const file = new File(['   \n'], 'empty.txt', { type: 'text/plain' });
    await expect(processNotesTemplateFile(file)).rejects.toThrow('empty');
  });

  it('rejects oversized templates', async () => {
    const file = new File([new Uint8Array(NOTES_TEMPLATE_REQUIREMENTS.maxFileBytes + 1)], 'big.md');
    await expect(processNotesTemplateFile(file)).rejects.toThrow('under');
  });

  it('normalizes windows line endings', async () => {
    const file = new File(['line\r\nnext'], 'notes.md', { type: 'text/markdown' });
    await expect(processNotesTemplateFile(file)).resolves.toBe('line\nnext');
  });

  it('describes template requirements', () => {
    expect(notesTemplateRequirementsHint()).toContain('Markdown');
  });
});
