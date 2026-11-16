import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GRID_BACKGROUND_REQUIREMENTS } from '@/constants/roomBackground';
import {
  encodeGridBackgroundForSync,
  gridBackgroundRequirementsHint,
  GridBackgroundError,
  isAcceptedGridBackgroundFile,
  processGridBackgroundFile,
  viewportBackgroundImageStyle,
  viewportBackgroundStyle,
} from './gridBackgroundImage';

class MockImage {
  naturalWidth = 800;
  naturalHeight = 600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _fail = false;

  constructor(fail = false) {
    this._fail = fail;
  }

  set src(_value: string) {
    queueMicrotask(() => {
      if (this._fail) this.onerror?.();
      else this.onload?.();
    });
  }
}

function installImageMock(fail = false) {
  vi.stubGlobal(
    'Image',
    class extends MockImage {
      constructor() {
        super(fail);
      }
    },
  );
}

describe('gridBackgroundImage', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
    installImageMock();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,abc');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('describes upload requirements', () => {
    expect(gridBackgroundRequirementsHint()).toContain('aspect ratio');
    expect(gridBackgroundRequirementsHint()).toContain('fills the screen');
  });

  it('builds viewport background image styles', () => {
    const style = viewportBackgroundStyle('https://cdn.test/"bg".png');
    expect(style.backgroundImage).toContain('\\"');
    expect(viewportBackgroundImageStyle('https://cdn.test/bg.png').backgroundImage).toContain(
      'bg.png',
    );
  });

  it('accepts jpg files by mime type or extension', () => {
    expect(isAcceptedGridBackgroundFile(new File([], 'bg.jpg', { type: 'image/jpg' }))).toBe(true);
    expect(isAcceptedGridBackgroundFile(new File([], 'bg.jpg', { type: '' }))).toBe(true);
    expect(isAcceptedGridBackgroundFile(new File([], 'bg.jpeg', { type: 'image/jpeg' }))).toBe(true);
  });

  it('rejects unsupported file types and oversized uploads', async () => {
    const file = new File(['gif'], 'bg.gif', { type: 'image/gif' });
    await expect(processGridBackgroundFile(file)).rejects.toBeInstanceOf(GridBackgroundError);

    const huge = new File([new Uint8Array(GRID_BACKGROUND_REQUIREMENTS.maxFileBytes + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    await expect(processGridBackgroundFile(huge)).rejects.toThrow('under');
  });

  it('processes a valid image into a data url', async () => {
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    await expect(processGridBackgroundFile(file)).resolves.toBe('data:image/jpeg;base64,abc');
  });

  it('rejects unreadable images', async () => {
    installImageMock(true);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    await expect(processGridBackgroundFile(file)).rejects.toThrow('Could not read');
  });

  it('rejects when canvas context is unavailable', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    await expect(processGridBackgroundFile(file)).rejects.toThrow('Could not process');
  });

  it('rejects when encoded output stays too large', async () => {
    const hugeData = `data:image/jpeg;base64,${'a'.repeat(GRID_BACKGROUND_REQUIREMENTS.maxSyncBytes + 1)}`;
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(hugeData);
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    await expect(processGridBackgroundFile(file)).rejects.toThrow('too detailed');
  });

  it('skips failed encodes and keeps trying lower quality', async () => {
    const toDataUrl = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockImplementationOnce(() => {
        throw new Error('encode failed');
      })
      .mockReturnValueOnce('data:image/jpeg;base64,small');
    const file = new File(['img'], 'bg.jpg', { type: 'image/jpeg' });
    await expect(processGridBackgroundFile(file)).resolves.toBe('data:image/jpeg;base64,small');
    expect(toDataUrl).toHaveBeenCalledTimes(2);
  });

  it('downscales when early encodes exceed the sync budget', async () => {
    const huge = `data:image/jpeg;base64,${'a'.repeat(GRID_BACKGROUND_REQUIREMENTS.maxSyncBytes + 1)}`;
    const small = 'data:image/jpeg;base64,ok';
    let calls = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => {
      calls += 1;
      return calls <= GRID_BACKGROUND_REQUIREMENTS.syncQualitySteps.length ? huge : small;
    });
    const img = new MockImage() as unknown as HTMLImageElement;
    expect(encodeGridBackgroundForSync(img)).toBe(small);
    expect(calls).toBeGreaterThan(GRID_BACKGROUND_REQUIREMENTS.syncQualitySteps.length);
  });
});
