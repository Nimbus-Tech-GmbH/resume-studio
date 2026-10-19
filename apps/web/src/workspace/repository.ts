import type { PersistedWorkspaceRecord } from './schema';
import {
  deleteWorkspaceRecord,
  readWorkspaceRecord,
  writeWorkspaceRecord,
} from './indexedDb';

export async function loadWorkspace(scope: string): Promise<PersistedWorkspaceRecord | null> {
  return readWorkspaceRecord(scope);
}

export async function saveWorkspace(record: PersistedWorkspaceRecord): Promise<void> {
  await writeWorkspaceRecord(record);
}

export async function clearWorkspace(scope: string): Promise<void> {
  await deleteWorkspaceRecord(scope);
}
