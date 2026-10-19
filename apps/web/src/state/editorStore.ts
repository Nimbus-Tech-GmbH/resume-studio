import { create } from 'zustand';
import type {
  CmsResume,
  JsonResume,
  JsonResumeProject,
  JsonResumeWork,
} from '@resume-studio/transformer';
import { DEFAULT_THEME, type ThemeId } from '@resume-studio/themes';

export const EMPTY_RESUME: JsonResume = {
  basics: {
    name: '',
    label: '',
    email: '',
    phone: '',
    url: '',
    summary: '',
    location: {
      address: '',
      postalCode: '',
      city: '',
      countryCode: '',
      region: '',
    },
    profiles: [],
  },
  work: [],
  education: [],
  skills: [],
  interests: [],
  volunteer: [],
  projects: [],
  awards: [],
  publications: [],
  certificates: [],
  languages: [],
  references: [],
  meta: { title: 'Untitled Resume' },
};

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
  | 'awards'
  | 'publications'
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

export interface EditorEntryIdentity {
  entryId: string;
  highlightIds: string[];
}

export interface EditorIdentityState {
  work: EditorEntryIdentity[];
  projects: EditorEntryIdentity[];
}

export interface JsonBufferState {
  isValid: boolean;
  isDirty: boolean;
  error: string | null;
}

export type WorkspaceLoadState = 'unloaded' | 'ready';
export type RecoveryStatus = 'idle' | 'recovering' | 'recovered' | 'storage-error';

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
  awards: 'awards',
  publications: 'publications',
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
  /** True while the startup dialog is waiting for user selection. */
  isStartup: boolean;

  workspaceLoadState: WorkspaceLoadState;
  recoveryStatus: RecoveryStatus;
  /** Changes only on full document replacement/import/load. */
  documentEpoch: string;
  /** Increments for every resume mutation path. */
  revision: number;
  editorIds: EditorIdentityState;
  jsonBuffer: JsonBufferState;

  setResume: (r: JsonResume) => void;
  patchResume: (updater: (r: JsonResume) => JsonResume) => void;
  commitResumeTransaction: (resume: JsonResume, editorIds: EditorIdentityState) => void;
  setJsonBufferState: (next: JsonBufferState) => void;
  setTheme: (t: ThemeId) => void;
  loadFromCms: (payload: { json: JsonResume; cms: CmsResume }) => void;
  /** Initialise the store for a locally-imported JSON Resume (no CMS backing). */
  loadFromJson: (json: JsonResume) => void;
  /** Reset to a blank state and reopen the startup dialog (used on logout). */
  resetAll: () => void;
  setResumeId: (id: string | null) => void;
  setIsStartup: (v: boolean) => void;
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
    awards: [],
    publications: [],
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
    awards: (cms.awards ?? []).map((x) => x.id),
    publications: (cms.publications ?? []).map((x) => x.id),
    certificates: (cms.resumeCertifications ?? []).map((x) => x.id),
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
    awards: [...map.awards],
    publications: [...map.publications],
    certificates: [...map.certificates],
    languages: [...map.languages],
    profiles: [...map.profiles],
  };
}

/** Build a CmsIdMap with null slots matching the length of each section. */
function buildIdMapFromJson(json: JsonResume): CmsIdMap {
  return {
    work: json.work?.map(() => null) ?? [],
    education: json.education?.map(() => null) ?? [],
    skills: json.skills?.map(() => null) ?? [],
    interests: json.interests?.map(() => null) ?? [],
    volunteer: json.volunteer?.map(() => null) ?? [],
    projects: json.projects?.map(() => null) ?? [],
    awards: json.awards?.map(() => null) ?? [],
    publications: json.publications?.map(() => null) ?? [],
    certificates: json.certificates?.map(() => null) ?? [],
    languages: json.languages?.map(() => null) ?? [],
    profiles: json.basics?.profiles?.map(() => null) ?? [],
  };
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newEpoch(): string {
  return randomId();
}

function entryIdentityFromHighlights(highlights: readonly string[] | undefined): EditorEntryIdentity {
  return {
    entryId: randomId(),
    highlightIds: (highlights ?? []).map(() => randomId()),
  };
}

function entriesFromResume(resume: JsonResumeWork[] | JsonResumeProject[] | undefined): EditorEntryIdentity[] {
  return (resume ?? []).map((item) => entryIdentityFromHighlights(item.highlights));
}

export function createEditorIdsFromResume(resume: JsonResume): EditorIdentityState {
  return {
    work: entriesFromResume(resume.work),
    projects: entriesFromResume(resume.projects),
  };
}

export function cloneEditorIds(ids: EditorIdentityState): EditorIdentityState {
  return {
    work: ids.work.map((entry) => ({
      entryId: entry.entryId,
      highlightIds: [...entry.highlightIds],
    })),
    projects: ids.projects.map((entry) => ({
      entryId: entry.entryId,
      highlightIds: [...entry.highlightIds],
    })),
  };
}

function reconcileHighlightIds(prevIds: readonly string[], nextValues: readonly string[] | undefined): string[] {
  const nextLength = nextValues?.length ?? 0;
  const next: string[] = [];
  for (let i = 0; i < nextLength; i += 1) {
    next.push(prevIds[i] ?? randomId());
  }
  return next;
}

function reconcileEntryIds(
  prevEntries: readonly EditorEntryIdentity[],
  nextEntries: readonly (JsonResumeWork | JsonResumeProject)[] | undefined,
): EditorEntryIdentity[] {
  const source = nextEntries ?? [];
  const out: EditorEntryIdentity[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const prev = prevEntries[i];
    out.push({
      entryId: prev?.entryId ?? randomId(),
      highlightIds: reconcileHighlightIds(prev?.highlightIds ?? [], source[i]?.highlights),
    });
  }
  return out;
}

function reconcileEditorIds(prev: EditorIdentityState, nextResume: JsonResume): EditorIdentityState {
  return {
    work: reconcileEntryIds(prev.work, nextResume.work),
    projects: reconcileEntryIds(prev.projects, nextResume.projects),
  };
}

function mutateResumeState(
  prev: EditorState,
  nextResume: JsonResume,
  nextEditorIds: EditorIdentityState = reconcileEditorIds(prev.editorIds, nextResume),
): Pick<EditorState, 'resume' | 'editorIds' | 'revision'> {
  return {
    resume: nextResume,
    editorIds: nextEditorIds,
    revision: prev.revision + 1,
  };
}

export function hashHighlights(values: readonly string[]): string {
  const normalized = values.map((value) => value.trim()).join('\u241f');
  const withLength = `${values.length}:${normalized}`;
  let hash = 2166136261;
  for (let i = 0; i < withLength.length; i += 1) {
    hash ^= withLength.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

const EMPTY_JSON_BUFFER: JsonBufferState = {
  isValid: true,
  isDirty: false,
  error: null,
};

export const useEditorStore = create<EditorState>()((set) => ({
  resume: {},
  original: {},
  originalCms: null,
  cmsIds: emptyIdMap(),
  originalCmsIds: emptyIdMap(),
  theme: DEFAULT_THEME,
  resumeId: null,
  loadedUpdatedAt: null,
  isStartup: true,

  workspaceLoadState: 'unloaded',
  recoveryStatus: 'idle',
  documentEpoch: newEpoch(),
  revision: 0,
  editorIds: { work: [], projects: [] },
  jsonBuffer: EMPTY_JSON_BUFFER,

  setResume: (resume) =>
    set((prev) => ({
      ...mutateResumeState(prev, resume),
    })),
  patchResume: (updater) =>
    set((prev) => {
      const nextResume = updater(prev.resume);
      return {
        ...mutateResumeState(prev, nextResume),
      };
    }),
  commitResumeTransaction: (resume, editorIds) =>
    set((prev) => ({
      ...mutateResumeState(prev, resume, cloneEditorIds(editorIds)),
    })),
  setJsonBufferState: (jsonBuffer) => set({ jsonBuffer }),
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
      editorIds: createEditorIdsFromResume(json),
      workspaceLoadState: 'ready',
      documentEpoch: newEpoch(),
      revision: 0,
      jsonBuffer: EMPTY_JSON_BUFFER,
    });
  },

  loadFromJson: (json) => {
    const ids = buildIdMapFromJson(json);
    set({
      resume: json,
      original: json,
      originalCms: null,
      cmsIds: ids,
      originalCmsIds: cloneIdMap(ids),
      loadedUpdatedAt: null,
      resumeId: null,
      editorIds: createEditorIdsFromResume(json),
      workspaceLoadState: 'ready',
      documentEpoch: newEpoch(),
      revision: 0,
      jsonBuffer: EMPTY_JSON_BUFFER,
    });
  },
  resetAll: () =>
    set((prev) => ({
      resume: {},
      original: {},
      originalCms: null,
      cmsIds: emptyIdMap(),
      originalCmsIds: emptyIdMap(),
      resumeId: null,
      loadedUpdatedAt: null,
      isStartup: true,
      theme: prev.theme,
      workspaceLoadState: 'unloaded',
      documentEpoch: newEpoch(),
      revision: 0,
      editorIds: { work: [], projects: [] },
      jsonBuffer: EMPTY_JSON_BUFFER,
    })),
  setResumeId: (resumeId) => set({ resumeId }),
  setIsStartup: (isStartup) => set({ isStartup }),

  addItem: (section, item) =>
    set((prev) => {
      const key = SECTION_TO_RESUME_KEY[section];
      const list = ((prev.resume[key] as unknown[] | undefined) ?? []).concat([item]);

      const resume = { ...prev.resume, [key]: list };
      const cmsIds = { ...prev.cmsIds, [section]: [...prev.cmsIds[section], null] };

      const editorIds = cloneEditorIds(prev.editorIds);
      if (section === 'work') {
        const workItem = item as JsonResumeWork;
        editorIds.work.push(entryIdentityFromHighlights(workItem.highlights));
      }
      if (section === 'projects') {
        const projectItem = item as JsonResumeProject;
        editorIds.projects.push(entryIdentityFromHighlights(projectItem.highlights));
      }

      return {
        ...mutateResumeState(prev, resume, editorIds),
        cmsIds,
      };
    }),

  removeItem: (section, index) =>
    set((prev) => {
      const key = SECTION_TO_RESUME_KEY[section];
      const list = (prev.resume[key] as unknown[] | undefined) ?? [];
      if (index < 0 || index >= list.length) return prev;
      const nextList = list.filter((_, i) => i !== index);
      const nextIds = prev.cmsIds[section].filter((_, i) => i !== index);

      const resume = { ...prev.resume, [key]: nextList };
      const cmsIds = { ...prev.cmsIds, [section]: nextIds };

      const editorIds = cloneEditorIds(prev.editorIds);
      if (section === 'work') {
        editorIds.work = editorIds.work.filter((_, i) => i !== index);
      }
      if (section === 'projects') {
        editorIds.projects = editorIds.projects.filter((_, i) => i !== index);
      }

      return {
        ...mutateResumeState(prev, resume, editorIds),
        cmsIds,
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

      const resume = { ...prev.resume, [key]: list };
      const cmsIds = { ...prev.cmsIds, [section]: ids };

      const editorIds = cloneEditorIds(prev.editorIds);
      if (section === 'work') {
        const [movedEntry] = editorIds.work.splice(from, 1);
        if (movedEntry) editorIds.work.splice(to, 0, movedEntry);
      }
      if (section === 'projects') {
        const [movedEntry] = editorIds.projects.splice(from, 1);
        if (movedEntry) editorIds.projects.splice(to, 0, movedEntry);
      }

      return {
        ...mutateResumeState(prev, resume, editorIds),
        cmsIds,
      };
    }),
}));
