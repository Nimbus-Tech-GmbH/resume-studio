import { describe, expect, it } from 'vitest';
import { PREVIEW_IFRAME_SANDBOX, PRINT_IFRAME_SANDBOX } from './components';

describe('presentation iframe sandbox', () => {
  it('keeps modal dialogs disabled for preview', () => {
    expect(PREVIEW_IFRAME_SANDBOX).toBe('allow-same-origin');
  });

  it('allows the print surface to call window.print()', () => {
    expect(PRINT_IFRAME_SANDBOX).toBe('allow-same-origin allow-modals');
  });
});
