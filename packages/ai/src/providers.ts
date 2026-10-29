import type { LanguageModel } from 'ai';
import { createOllamaModel } from './ollama';
import { createOpencodeModel } from './opencode';
import type { ConnectionProfile } from './types';

/** Build the AI SDK model for the configured provider. */
export function createConnectionModel(connection: ConnectionProfile): LanguageModel {
  if (connection.providerId === 'ollama') {
    return createOllamaModel({
      endpoint: connection.endpoint,
      model: connection.model,
    });
  }

  return createOpencodeModel({
    endpoint: connection.endpoint,
    model: connection.model,
    apiKey: connection.apiKey,
  });
}
