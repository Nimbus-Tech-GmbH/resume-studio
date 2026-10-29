import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiRuntimeError } from './errors.js';
import { assertOutputFinished, parseModelJson } from './parseJson.js';

describe('parseModelJson', () => {
  it('parses one JSON object', () => {
    assert.deepEqual(parseModelJson('{"resume":{},"changes":[],"gaps":[]}'), {
      resume: {},
      changes: [],
      gaps: [],
    });
  });

  it('rejects a markdown fenced object', () => {
    assert.throws(
      () => parseModelJson('```json\n{"resume":{}}\n```'),
      (error: unknown) => error instanceof AiRuntimeError && error.code === 'INVALID_OUTPUT',
    );
  });

  it('rejects prose around the object', () => {
    assert.throws(
      () => parseModelJson('Here is the result: {"resume":{}}'),
      (error: unknown) => error instanceof AiRuntimeError && error.code === 'INVALID_OUTPUT',
    );
  });

  it('rejects invalid JSON', () => {
    assert.throws(
      () => parseModelJson('{"resume":}'),
      (error: unknown) => error instanceof AiRuntimeError && error.code === 'INVALID_OUTPUT',
    );
  });

  it('rejects empty output', () => {
    assert.throws(
      () => parseModelJson('   '),
      (error: unknown) => error instanceof AiRuntimeError && error.code === 'INVALID_OUTPUT',
    );
  });
});

describe('assertOutputFinished', () => {
  it('reports a truncated response as a budget problem', () => {
    assert.throws(
      () => assertOutputFinished('length', 4096),
      (error: unknown) =>
        error instanceof AiRuntimeError &&
        error.code === 'CONTEXT_TOO_LARGE' &&
        /4096/.test(error.message),
    );
  });

  it('accepts a completed response', () => {
    assert.doesNotThrow(() => assertOutputFinished('stop', 4096));
    assert.doesNotThrow(() => assertOutputFinished(undefined, 4096));
  });

  it('reports a content filter as refused', () => {
    assert.throws(
      () => assertOutputFinished('content-filter', 4096),
      (error: unknown) => error instanceof AiRuntimeError && error.code === 'REFUSED',
    );
  });
});
