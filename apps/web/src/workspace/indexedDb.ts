import type { PersistedWorkspaceRecord } from './schema';

const DB_NAME = 'resume-studio-workspace';
const STORE_NAME = 'workspaces';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'scope' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await run(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}

export async function readWorkspaceRecord(scope: string): Promise<PersistedWorkspaceRecord | null> {
  return withStore('readonly', (store) =>
    new Promise((resolve, reject) => {
      const request = store.get(scope);
      request.onsuccess = () => {
        resolve((request.result as PersistedWorkspaceRecord | undefined) ?? null);
      };
      request.onerror = () => reject(request.error);
    }),
  );
}

export async function writeWorkspaceRecord(record: PersistedWorkspaceRecord): Promise<void> {
  return withStore('readwrite', (store) =>
    new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }),
  );
}

export async function deleteWorkspaceRecord(scope: string): Promise<void> {
  return withStore('readwrite', (store) =>
    new Promise((resolve, reject) => {
      const request = store.delete(scope);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }),
  );
}
