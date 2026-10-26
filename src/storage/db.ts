import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

/**
 * Everything the PWA keeps on the phone (WEB-001): small settings and the device key (`kv`),
 * the last-seen data shown offline with "Last updated" (`cache`), and writes waiting for the
 * internet (`queue`). Never the refresh token: that lives only in the httpOnly cookie.
 */
export interface QueuedWrite {
  /** The client UUID the server is idempotent on (CLAUDE.md rule 4). */
  id: string;
  /** Whose write it is: only sent while that person is signed in on this phone. */
  userId?: string;
  /** What it is, for the screens that show it as "waiting to send". */
  kind: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** A raw body instead of JSON (a receipt photo). IndexedDB keeps Blobs as they are. */
  raw?: { blob: Blob; type: string };
  /** Which cached data to refresh after it is sent. */
  refresh?: string[];
  createdAt: string;
  attempts: number;
  /** A refusal from the server: the write will not be retried. */
  failed?: { code: string; status: number };
}

export interface CacheEntry<T = unknown> {
  data: T;
  savedAt: string;
}

interface MezgebDb extends DBSchema {
  kv: { key: string; value: unknown };
  cache: { key: string; value: CacheEntry };
  queue: { key: string; value: QueuedWrite; indexes: { createdAt: string } };
}

const DB_NAME = 'mezgeb';
let dbPromise: Promise<IDBPDatabase<MezgebDb>> | undefined;

export function db(): Promise<IDBPDatabase<MezgebDb>> {
  dbPromise ??= openDB<MezgebDb>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('cache');
      d.createObjectStore('queue', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    },
  });
  return dbPromise;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key);
}

export async function kvDelete(key: string): Promise<void> {
  await (await db()).delete('kv', key);
}

export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | undefined> {
  return (await (await db()).get('cache', key)) as CacheEntry<T> | undefined;
}

export async function cacheSet(key: string, data: unknown, savedAt = new Date()): Promise<void> {
  await (await db()).put('cache', { data, savedAt: savedAt.toISOString() }, key);
}

/**
 * Signing out on a shared phone removes the person's data (not the device key). A session that
 * ended on its own (the 60-day refresh expired, the device was revoked) keeps the unsent writes:
 * they go out when the same person signs in again (`keepQueue`).
 */
export async function clearPersonalData(opts: { keepQueue?: boolean } = {}): Promise<void> {
  const d = await db();
  const tx = d.transaction(['cache', 'queue', 'kv'], 'readwrite');
  await Promise.all([
    tx.objectStore('cache').clear(),
    opts.keepQueue ? Promise.resolve() : tx.objectStore('queue').clear(),
    tx.objectStore('kv').delete('session'),
    tx.done,
  ]);
}

/** Tests only: a fresh database. */
export async function resetDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = undefined;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
