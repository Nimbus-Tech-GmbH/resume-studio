import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WITHHELD_PATHS,
  createResumePayload,
  restoreWithheldFields,
} from './resumePayload.js';

function resume(): Record<string, unknown> {
  return {
    basics: {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '123',
      url: 'https://ada.example',
      image: 'avatar.png',
      label: 'Engineer',
      summary: 'Builds things.',
      location: { city: 'London', countryCode: 'GB' },
      profiles: [{ network: 'GitHub', username: 'ada' }],
    },
    work: [{ name: 'Acme', summary: 'Built a platform.' }],
    projects: [],
    skills: [],
  };
}

describe('createResumePayload', () => {
  it('withholds contact and identity fields from the model copy', () => {
    const payload = createResumePayload(resume());
    const basics = payload.resume.basics as Record<string, unknown>;

    assert.equal(basics.name, undefined);
    assert.equal(basics.email, undefined);
    assert.equal(basics.phone, undefined);
    assert.equal(basics.url, undefined);
    assert.equal(basics.image, undefined);
    assert.equal(basics.location, undefined);
    assert.equal(basics.profiles, undefined);
    assert.equal(basics.label, 'Engineer');
    assert.equal(basics.summary, 'Builds things.');
    assert.deepEqual(payload.withheldPaths, [...WITHHELD_PATHS]);
  });

  it('does not mutate the source resume', () => {
    const source = resume();
    createResumePayload(source);
    assert.equal((source.basics as Record<string, unknown>).email, 'ada@example.com');
  });

  it('only records paths that exist', () => {
    const payload = createResumePayload({ basics: { label: 'Engineer' }, work: [] });
    assert.deepEqual(payload.withheldPaths, []);
  });

  it('returns a stable hash of the source resume', () => {
    const first = createResumePayload(resume());
    const second = createResumePayload(resume());
    assert.equal(first.snapshotHash, second.snapshotHash);
    assert.notEqual(
      first.snapshotHash,
      createResumePayload({ ...resume(), work: [] }).snapshotHash,
    );
  });
});

describe('restoreWithheldFields', () => {
  it('restores withheld values from the editor copy', () => {
    const source = resume();
    const payload = createResumePayload(source);
    const modelResume = payload.resume;

    const restored = restoreWithheldFields(source, modelResume, payload.withheldPaths);
    const basics = restored.basics as Record<string, unknown>;

    assert.equal(basics.name, 'Ada Lovelace');
    assert.equal(basics.email, 'ada@example.com');
    assert.equal(basics.phone, '123');
    assert.equal(basics.url, 'https://ada.example');
    assert.deepEqual(basics.location, { city: 'London', countryCode: 'GB' });
    assert.deepEqual(basics.profiles, [{ network: 'GitHub', username: 'ada' }]);
  });

  it('keeps model edits to allowed fields', () => {
    const source = resume();
    const payload = createResumePayload(source);
    const modelResume = structuredClone(payload.resume);
    (modelResume.basics as Record<string, unknown>).summary = 'Builds resilient things.';

    const restored = restoreWithheldFields(source, modelResume, payload.withheldPaths);
    const basics = restored.basics as Record<string, unknown>;

    assert.equal(basics.summary, 'Builds resilient things.');
    assert.equal(basics.email, 'ada@example.com');
  });
});
