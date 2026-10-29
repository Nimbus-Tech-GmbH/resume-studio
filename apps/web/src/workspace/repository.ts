import type { AnyPersistedWorkspaceRecord, PersistedWorkspaceRecord } from './schema';
import {
  deleteWorkspaceRecord,
  readWorkspaceRecord,
  writeWorkspaceRecord,
} from './indexedDb';
import { migrateWorkspaceRecord } from './migrateRecord';

export async function loadWorkspace(scope: string): Promise<PersistedWorkspaceRecord | null> {
  const raw = (await readWorkspaceRecord(scope)) as AnyPersistedWorkspaceRecord | null;
  if (!raw) return null;
  if (raw.version !== 1 && raw.version !== 2) return null;
  return migrateWorkspaceRecord(raw);
}

export async function saveWorkspace(record: PersistedWorkspaceRecord): Promise<void> {
  await writeWorkspaceRecord(record);
}

export async function clearWorkspace(scope: string): Promise<void> {
  await deleteWorkspaceRecord(scope);
}
