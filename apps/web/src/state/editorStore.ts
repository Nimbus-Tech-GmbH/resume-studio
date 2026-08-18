import { create } from 'zustand';
import { temporal } from 'zundo';
import type { CmsResume, JsonResume } from '@resume-studio/transformer';
import { DEFAULT_THEME, type ThemeId } from '@resume-studio/themes';

interface EditorState {
  /** Currently-edited resume (JSON Resume shape). */
  resume: JsonResume;
  /** Snapshot of the resume as last loaded from CMS (for diffing). */
  original: JsonResume;
  /** Raw CMS payload — carries the stable ids needed by `toCms`. */
  originalCms: CmsResume | null;
  /** Selected theme. */
  theme: ThemeId;
  /** Currently-selected resume id (for load / save). */
  resumeId: string | null;

  setResume: (r: JsonResume) => void;
  patchResume: (updater: (r: JsonResume) => JsonResume) => void;
  setTheme: (t: ThemeId) => void;
  loadFromCms: (payload: { json: JsonResume; cms: CmsResume }) => void;
  setResumeId: (id: string | null) => void;
}

/**
 * Editor store. `temporal` middleware provides undo/redo over the tracked
 * slice (resume). Theme + original + resumeId are excluded from history via
 * `partialize` — they're navigation / meta state, not editable content.
 */
export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      resume: {},
      original: {},
      originalCms: null,
      theme: DEFAULT_THEME,
      resumeId: null,
      setResume: (resume) => set({ resume }),
      patchResume: (updater) => set((prev) => ({ resume: updater(prev.resume) })),
      setTheme: (theme) => set({ theme }),
      loadFromCms: ({ json, cms }) => set({ resume: json, original: json, originalCms: cms }),
      setResumeId: (resumeId) => set({ resumeId }),
    }),
    {
      partialize: (state) => ({ resume: state.resume }) as Partial<EditorState>,
      limit: 100,
    },
  ),
);
