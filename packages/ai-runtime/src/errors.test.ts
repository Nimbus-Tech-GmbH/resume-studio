import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeProviderError } from './errors.js';

describe('normalizeProviderError', () => {
  it('maps a local 401 to AUTH_FAILED', () => {
    const error = Object.assign(new Error('Unauthorized'), {
      name: 'AI_APICallError',
      statusCode: 401,
      responseBody: '{"error":{"message":"Unauthorized"}}',
    });

    const normalized = normalizeProviderError(error);
    assert.equal(normalized.code, 'AUTH_FAILED');
    assert.match(normalized.message, /Unauthorized/i);
  });

  it('maps status 404 to MODEL_NOT_FOUND', () => {
    const error = Object.assign(new Error('Not Found'), {
      statusCode: 404,
    });
    assert.equal(normalizeProviderError(error).code, 'MODEL_NOT_FOUND');
  });

  it('keeps a sanitized detail on generic failures', () => {
    const error = Object.assign(new Error('Payment required'), {
      statusCode: 402,
    });
    const normalized = normalizeProviderError(error);
    assert.equal(normalized.code, 'CONNECTION_FAILED');
    assert.match(normalized.message, /402/);
    assert.match(normalized.message, /Payment required/);
  });

  it('maps JSON parse failures to INVALID_OUTPUT', () => {
    const normalized = normalizeProviderError(
      new Error('No object generated: could not parse the response.'),
    );
    assert.equal(normalized.code, 'INVALID_OUTPUT');
    assert.match(normalized.message, /valid JSON object/i);
  });
});
