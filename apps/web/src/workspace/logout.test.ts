import { describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../state/editorStore';
import { logoutAndReset } from './logout';

describe('logout workspace lifecycle', () => {
  it('clears active document and presentation identity before signing out', async () => {
    useEditorStore.getState().loadFromJson({ basics: { name: 'Guest draft' } });
    useEditorStore.getState().setIsStartup(false);
    const observed: string[] = [];
    const logout = vi.fn(async () => {
      observed.push(`logout:${useEditorStore.getState().documentKey ?? 'cleared'}`);
    });

    await logoutAndReset(() => {
      useEditorStore.getState().resetAll();
      observed.push('reset');
    }, logout);

    expect(observed).toEqual(['reset', 'logout:cleared']);
    expect(logout).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().resume).toEqual({});
    expect(useEditorStore.getState().documentKey).toBeNull();
    expect(useEditorStore.getState().isStartup).toBe(true);
  });
});
