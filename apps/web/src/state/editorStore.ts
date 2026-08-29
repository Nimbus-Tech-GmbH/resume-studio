import { create } from 'zustand';
import type { CmsResume, JsonResume } from '@resume-studio/transformer';
import { DEFAULT_THEME, type ThemeId } from '@resume-studio/themes';

/**
 * The set of resume sections that behave as reorderable/CRUD-able lists.
 * `basics` is a single object, so it's not in here.
 */
export type ListSection =
  | 'work'
  | 'education'
  | 'skills'
  | 'interests'
  | 'volunteer'
  | 'projects'
  | 'certificates'
  | 'languages';

/**
 * Parallel arrays of CMS ids for each list section.
 *
 * A `null` slot means "this row was added locally and has no CMS id yet" —
 * `toCms` emits a create op for it. Rows removed locally simply disappear
 * from these arrays; `toCms` diffs against `originalCmsIds` to figure out
 * which ids to delete.
 */
export type CmsIdMap = Record<ListSection, Array<string | null>> & {
  profiles: Array<string | null>;
};

/**
 * Which sub-list of `JsonResume` a `ListSection` maps to. Kept as constants
 * so we can bulk-mutate the resume + cmsIds together with a single helper.
 */
export const SECTION_TO_RESUME_KEY: Record<ListSection, keyof JsonResume> = {
  work: 'work',
  education: 'education',
  skills: 'skills',
  interests: 'interests',
  volunteer: 'volunteer',
  projects: 'projects',
  certificates: 'certificates',
  languages: 'languages',
};

interface EditorState {
  resume: JsonResume;
  original: JsonResume;
  originalCms: CmsResume | null;
  /** Live CMS ids, mutated alongside `resume` on add/remove/reorder. */
  cmsIds: CmsIdMap;
  /** Snapshot of ids at load time — used to compute deletes. */
  originalCmsIds: CmsIdMap;
  theme: ThemeId;
  resumeId: string | null;
  /** CMS `updatedAt` captured at load time — used for staleness checks on save. */
  loadedUpdatedAt: string | null;

  setResume: (r: JsonResume) => void;
  patchResume: (updater: (r: JsonResume) => JsonResume) => void;
  setTheme: (t: ThemeId) => void;
  loadFromCms: (payload: { json: JsonResume; cms: CmsResume }) => void;
  setResumeId: (id: string | null) => void;
  addItem: <K extends ListSection>(section: K, item: NonNullable<JsonResume[K]>[number]) => void;
  removeItem: (section: ListSection, index: number) => void;
  reorderItems: (section: ListSection, from: number, to: number) => void;
}

function emptyIdMap(): CmsIdMap {
  return {
    work: [],
    education: [],
    skills: [],
    interests: [],
    volunteer: [],
    projects: [],
    certificates: [],
    languages: [],
    profiles: [],
  };
}

function buildIdMap(cms: CmsResume): CmsIdMap {
  return {
    work: (cms.work ?? []).map((x) => x.id),
    education: (cms.education ?? []).map((x) => x.id),
    skills: (cms.skills ?? []).map((x) => x.id),
    interests: (cms.interests ?? []).map((x) => x.id),
    volunteer: (cms.volunteer ?? []).map((x) => x.id),
    projects: (cms.projects ?? []).map((x) => x.id),
    certificates: (cms.certificates ?? []).map((x) => x.id),
    languages: (cms.resumeLanguages ?? []).map((x) => x.id),
    profiles: (cms.basicInformation?.profiles ?? []).map((x) => x.id),
  };
}

function cloneIdMap(map: CmsIdMap): CmsIdMap {
  return {
    work: [...map.work],
    education: [...map.education],
    skills: [...map.skills],
    interests: [...map.interests],
    volunteer: [...map.volunteer],
    projects: [...map.projects],
    certificates: [...map.certificates],
    languages: [...map.languages],
    profiles: [...map.profiles],
  };
}

export const useEditorStore = create<EditorState>()((set) => ({
  resume: {},
  original: {},
  originalCms: null,
  cmsIds: emptyIdMap(),
  originalCmsIds: emptyIdMap(),
  theme: DEFAULT_THEME,
  resumeId: null,
  loadedUpdatedAt: null,

  setResume: (resume) => set({ resume }),
  patchResume: (updater) => set((prev) => ({ resume: updater(prev.resume) })),
  setTheme: (theme) => set({ theme }),
  loadFromCms: ({ json, cms }) => {
    const ids = buildIdMap(cms);
    set({
      resume: json,
      original: json,
      originalCms: cms,
      cmsIds: ids,
      originalCmsIds: cloneIdMap(ids),
      loadedUpdatedAt: cms.updatedAt ?? null,
    });
  },
  setResumeId: (resumeId) => set({ resumeId }),

  addItem: (section, item) =>
    set((prev) => {
      const key = SECTION_TO_RESUME_KEY[section];
      const list = ((prev.resume[key] as unknown[] | undefined) ?? []).concat([item]);
      return {
        resume: { ...prev.resume, [key]: list },
        cmsIds: { ...prev.cmsIds, [section]: [...prev.cmsIds[section], null] },
      };
    }),

  removeItem: (section, index) =>
    set((prev) => {
      const key = SECTION_TO_RESUME_KEY[section];
      const list = (prev.resume[key] as unknown[] | undefined) ?? [];
      if (index < 0 || index >= list.length) return prev;
      const nextList = list.filter((_, i) => i !== index);
      const nextIds = prev.cmsIds[section].filter((_, i) => i !== index);
      return {
        resume: { ...prev.resume, [key]: nextList },
        cmsIds: { ...prev.cmsIds, [section]: nextIds },
      };
    }),

  reorderItems: (section, from, to) =>
    set((prev) => {
      const key = SECTION_TO_RESUME_KEY[section];
      const list = [...((prev.resume[key] as unknown[] | undefined) ?? [])];
      if (from < 0 || from >= list.length || to < 0 || to >= list.length) return prev;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      const ids = [...prev.cmsIds[section]];
      const [movedId = null] = ids.splice(from, 1);
      ids.splice(to, 0, movedId);
      return {
        resume: { ...prev.resume, [key]: list },
        cmsIds: { ...prev.cmsIds, [section]: ids },
      };
    }),
}));
