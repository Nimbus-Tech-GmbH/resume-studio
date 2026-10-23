import { beforeEach, describe, expect, it } from 'vitest';
import type { CmsResume, JsonResume } from '@resume-studio/transformer';
import { useEditorStore } from './editorStore';

function cmsDocument(id = 'resume-1'): { json: JsonResume; cms: CmsResume } {
  return {
    json: {
      basics: {
        name: 'Ada Lovelace',
        profiles: [{ network: 'GitHub', username: 'ada' }],
      },
      work: [{ name: 'Analytical Engines' }, { name: 'Royal Society' }],
    },
    cms: {
      id,
      updatedAt: '2026-01-02T03:04:05.000Z',
      basicInformation: {
        id: 'basics-1',
        profiles: [{ id: 'profile-1' }],
      },
      work: [{ id: 'work-1' }, { id: 'work-2' }],
    },
  };
}

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().resetAll();
  });

  it('keeps list items and CMS IDs aligned through add, remove, and reorder', () => {
    const payload = cmsDocument();
    useEditorStore.getState().loadFromCms(payload);
    const documentKey = useEditorStore.getState().documentKey;

    useEditorStore.getState().addItem('work', { name: 'Local Work' });
    expect(useEditorStore.getState().resume.work?.map((item) => item.name)).toEqual([
      'Analytical Engines',
      'Royal Society',
      'Local Work',
    ]);
    expect(useEditorStore.getState().cmsIds.work).toEqual(['work-1', 'work-2', null]);

    useEditorStore.getState().removeItem('work', 1);
    expect(useEditorStore.getState().resume.work?.map((item) => item.name)).toEqual([
      'Analytical Engines',
      'Local Work',
    ]);
    expect(useEditorStore.getState().cmsIds.work).toEqual(['work-1', null]);

    useEditorStore.getState().reorderItems('work', 1, 0);
    const state = useEditorStore.getState();
    expect(state.resume.work?.map((item) => item.name)).toEqual([
      'Local Work',
      'Analytical Engines',
    ]);
    expect(state.cmsIds.work).toEqual([null, 'work-1']);
    expect(state.originalCmsIds.work).toEqual(['work-1', 'work-2']);
    expect(state.documentKey).toBe(documentKey);
    expect(state.documentRevision).toBe(3);
  });

  it('atomically replaces all active and original CMS metadata on CMS load', () => {
    useEditorStore.getState().loadFromJson({ basics: { name: 'Local draft' } });
    useEditorStore.getState().setResumeId('pending-selection');

    const payload = cmsDocument('resume-2');
    const observed: Array<ReturnType<typeof useEditorStore.getState>> = [];
    const unsubscribe = useEditorStore.subscribe((state) => observed.push(state));

    useEditorStore.getState().loadFromCms(payload);
    unsubscribe();

    expect(observed).toHaveLength(1);
    const state = observed[0]!;
    expect(state.resume).toBe(payload.json);
    expect(state.original).toBe(payload.json);
    expect(state.originalCms).toBe(payload.cms);
    expect(state.resumeId).toBe('resume-2');
    expect(state.documentKey).toBe('cms:resume-2');
    expect(state.documentRevision).toBe(0);
    expect(state.loadedUpdatedAt).toBe(payload.cms.updatedAt);
    expect(state.cmsIds.work).toEqual(['work-1', 'work-2']);
    expect(state.cmsIds.profiles).toEqual(['profile-1']);
    expect(state.originalCmsIds).toEqual(state.cmsIds);
    expect(state.originalCmsIds).not.toBe(state.cmsIds);
  });

  it('reconciles JSON-editor list replacements by content identity', () => {
    useEditorStore.getState().loadFromCms(cmsDocument());
    const [first, second] = useEditorStore.getState().resume.work ?? [];

    useEditorStore.getState().setResume({
      ...useEditorStore.getState().resume,
      work: [second!, first!],
    });
    expect(useEditorStore.getState().cmsIds.work).toEqual(['work-2', 'work-1']);

    useEditorStore.getState().setResume({
      ...useEditorStore.getState().resume,
      work: [{ ...second!, name: 'Edited in JSON' }, first!],
    });
    expect(useEditorStore.getState().cmsIds.work).toEqual([null, 'work-1']);
    expect(useEditorStore.getState().originalCmsIds.work).toEqual(['work-1', 'work-2']);
  });

  it('loads local create/import data without CMS identity and with null IDs', () => {
    useEditorStore.getState().loadFromCms(cmsDocument());
    const json: JsonResume = {
      basics: {
        name: 'Imported Person',
        profiles: [{ network: 'Website' }, { network: 'LinkedIn' }],
      },
      work: [{ name: 'Imported Work' }],
      skills: [{ name: 'TypeScript' }],
    };

    useEditorStore.getState().loadFromJson(json);

    const state = useEditorStore.getState();
    expect(state.resume).toBe(json);
    expect(state.original).toBe(json);
    expect(state.originalCms).toBeNull();
    expect(state.resumeId).toBeNull();
    expect(state.loadedUpdatedAt).toBeNull();
    expect(state.documentKey).toMatch(/^local:/);
    expect(state.documentRevision).toBe(0);
    expect(state.cmsIds.work).toEqual([null]);
    expect(state.cmsIds.skills).toEqual([null]);
    expect(state.cmsIds.profiles).toEqual([null, null]);
    expect(state.originalCmsIds).toEqual(state.cmsIds);
    expect(state.originalCmsIds).not.toBe(state.cmsIds);
  });

  it('uses one authoritative resume for JSON and form mutation actions', () => {
    const initial: JsonResume = { basics: { name: 'Initial' }, work: [] };
    useEditorStore.getState().loadFromJson(initial);

    useEditorStore.getState().setResume({
      ...useEditorStore.getState().resume,
      basics: { name: 'JSON edit' },
    });
    useEditorStore.getState().patchResume((resume) => ({
      ...resume,
      basics: { ...resume.basics, label: 'Form edit' },
    }));
    useEditorStore.getState().addItem('work', { name: 'Form-added work' });

    const state = useEditorStore.getState();
    expect(state.resume).toEqual({
      basics: { name: 'JSON edit', label: 'Form edit' },
      work: [{ name: 'Form-added work' }],
    });
    expect(state.original).toBe(initial);
    expect(state.cmsIds.work).toEqual([null]);
    expect(state.documentRevision).toBe(3);
  });

  it('creates a new stable document key for every distinct local load', () => {
    const json: JsonResume = { basics: { name: 'Local' } };
    useEditorStore.getState().loadFromJson(json);
    const firstKey = useEditorStore.getState().documentKey;

    useEditorStore.getState().patchResume((resume) => ({
      ...resume,
      basics: { ...resume.basics, label: 'Edited' },
    }));
    expect(useEditorStore.getState().documentKey).toBe(firstKey);

    useEditorStore.getState().loadFromJson(json);
    const secondKey = useEditorStore.getState().documentKey;
    expect(secondKey).toMatch(/^local:/);
    expect(secondKey).not.toBe(firstKey);
    expect(useEditorStore.getState().documentRevision).toBe(0);
  });

  it('advances revisions only for valid resume snapshots', () => {
    useEditorStore.getState().loadFromJson({
      basics: { name: 'Revision test' },
      work: [{ name: 'One' }, { name: 'Two' }],
    });
    const key = useEditorStore.getState().documentKey;

    useEditorStore.getState().setTheme(useEditorStore.getState().theme);
    useEditorStore.getState().setIsStartup(false);
    expect(useEditorStore.getState().documentRevision).toBe(0);

    useEditorStore.getState().setResume({ ...useEditorStore.getState().resume });
    useEditorStore.getState().patchResume((resume) => ({
      ...resume,
      basics: { ...resume.basics, label: 'Patched' },
    }));
    useEditorStore.getState().addItem('work', { name: 'Three' });
    useEditorStore.getState().removeItem('work', 2);
    useEditorStore.getState().reorderItems('work', 0, 1);

    expect(useEditorStore.getState().documentRevision).toBe(5);
    expect(useEditorStore.getState().documentKey).toBe(key);

    useEditorStore.getState().removeItem('work', 99);
    useEditorStore.getState().reorderItems('work', -1, 0);
    expect(useEditorStore.getState().documentRevision).toBe(5);
  });

  it('invalidates the active document while a different CMS selection loads', () => {
    useEditorStore.getState().loadFromCms(cmsDocument('resume-1'));

    useEditorStore.getState().setResumeId('resume-2');

    const state = useEditorStore.getState();
    expect(state.resumeId).toBe('resume-2');
    expect(state.resume).toEqual({});
    expect(state.originalCms).toBeNull();
    expect(state.cmsIds.work).toEqual([]);
    expect(state.documentKey).toBeNull();
    expect(state.documentRevision).toBe(0);
  });

  it('reset clears active document and preview metadata', () => {
    useEditorStore.getState().loadFromCms(cmsDocument());
    useEditorStore.getState().patchResume((resume) => ({ ...resume, meta: { title: 'Edited' } }));
    useEditorStore.getState().setIsStartup(false);
    const theme = useEditorStore.getState().theme;

    useEditorStore.getState().resetAll();

    const state = useEditorStore.getState();
    expect(state.resume).toEqual({});
    expect(state.original).toEqual({});
    expect(state.originalCms).toBeNull();
    expect(state.cmsIds.work).toEqual([]);
    expect(state.originalCmsIds.work).toEqual([]);
    expect(state.resumeId).toBeNull();
    expect(state.loadedUpdatedAt).toBeNull();
    expect(state.documentKey).toBeNull();
    expect(state.documentRevision).toBe(0);
    expect(state.isStartup).toBe(true);
    expect(state.theme).toBe(theme);
  });
});
