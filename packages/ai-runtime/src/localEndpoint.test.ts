import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AiRuntimeError } from './errors.js';
import { isLocalProvider, validateLocalEndpoint } from './providers/local.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error instanceof AiRuntimeError ? error.code : 'OTHER';
  }
}

describe('validateLocalEndpoint', () => {
  it('accepts loopback http and https endpoints', () => {
    assert.doesNotThrow(() => validateLocalEndpoint('http://127.0.0.1:11434/v1'));
    assert.doesNotThrow(() => validateLocalEndpoint('http://localhost:11434/v1'));
    assert.doesNotThrow(() => validateLocalEndpoint('https://[::1]:11434/v1'));
  });

  it('rejects non-loopback hosts', () => {
    assert.equal(
      codeOf(() => validateLocalEndpoint('https://api.openai.com/v1')),
      'INVALID_CONFIGURATION',
    );
    assert.equal(
      codeOf(() => validateLocalEndpoint('http://192.168.1.20:11434/v1')),
      'INVALID_CONFIGURATION',
    );
  });

  it('rejects embedded credentials', () => {
    assert.equal(
      codeOf(() => validateLocalEndpoint('http://key:secret@127.0.0.1:11434/v1')),
      'INVALID_CONFIGURATION',
    );
  });

  it('rejects a non-v1 base path', () => {
    assert.equal(
      codeOf(() => validateLocalEndpoint('http://127.0.0.1:11434/api')),
      'INVALID_CONFIGURATION',
    );
  });

  it('rejects malformed URLs', () => {
    assert.equal(codeOf(() => validateLocalEndpoint('not a url')), 'INVALID_CONFIGURATION');
  });
});

describe('isLocalProvider', () => {
  it('only Ollama is local', () => {
    assert.equal(isLocalProvider('ollama'), true);
  });
});
