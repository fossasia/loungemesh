import { NOTES_TEMPLATE_REQUIREMENTS } from '@/constants/roomBackground';

export class NotesTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotesTemplateError';
  }
}

function formatKb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return NOTES_TEMPLATE_REQUIREMENTS.extensions.some((ext) => lower.endsWith(ext));
}

/** Read a markdown or plain-text notes template from an uploaded file. */
export async function processNotesTemplateFile(file: File): Promise<string> {
  if (!hasAllowedExtension(file.name)) {
    throw new NotesTemplateError('Use a .md, .markdown, or .txt file.');
  }
  if (file.size > NOTES_TEMPLATE_REQUIREMENTS.maxFileBytes) {
    throw new NotesTemplateError(`Template must be under ${formatKb(NOTES_TEMPLATE_REQUIREMENTS.maxFileBytes)}.`);
  }
  const text = await file.text();
  if (!text.trim()) {
    throw new NotesTemplateError('Template file is empty.');
  }
  return text.replace(/\r\n/g, '\n');
}

export function notesTemplateRequirementsHint(): string {
  return 'Markdown or plain text (.md, .txt). Applied once when the meeting starts if shared notes are still empty.';
}
