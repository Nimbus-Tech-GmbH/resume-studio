import { create } from 'zustand';
import { temporal } from 'zundo';
import type { JsonResume } from '@resume-studio/transformer';
import { DEFAULT_THEME, type ThemeId } from '@resume-studio/themes';

interface EditorState {
  resume: JsonResume;
  original: JsonResume;
  theme: ThemeId;
  setResume: (r: JsonResume) => void;
  setTheme: (t: ThemeId) => void;
  loadFromCms: (r: JsonResume) => void;
}

/**
 * Editor store. `temporal` middleware from zundo provides undo/redo
 * over the tracked slice (resume). Theme + original are excluded from history.
 */
export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      resume: {},
      original: {},
      theme: DEFAULT_THEME,
      setResume: (resume) => set({ resume }),
      setTheme: (theme) => set({ theme }),
      loadFromCms: (r) => set({ resume: r, original: r }),
    }),
    {
      partialize: (state) => ({ resume: state.resume }) as Partial<EditorState>,
    },
  ),
);
