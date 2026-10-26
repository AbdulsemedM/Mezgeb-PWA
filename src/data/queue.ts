import { uuidv7 } from '@shared/uuid';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, ApiError, OfflineError } from '../api/client';
import { sessionState } from '../auth/session';
import type { Translate } from '../i18n';
import { db, type QueuedWrite } from '../storage/db';

/**
 * CLAUDE.md rule 5 / WEB-001: writes (people, limits, payment reports, orders, disputes) are
 * saved on the phone first and sent when online. Every create carries its client UUID, so a
 * write sent twice (lost answer, a second tab) is answered with the original by the server.
 * Writes go one at a time, oldest first, so a change never overtakes the create it depends on.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function changed(): void {
  version += 1;
  for (const l of listeners) l();
}

/** Cache keys to refresh after a write is accepted (see useCached). */
const invalidated = new Set<(key: string) => void>();
export function onInvalidate(fn: (key: string) => void): () => void {
  invalidated.add(fn);
  return () => invalidated.delete(fn);
}

/** Something changed on the server (a push arrived): refresh this cached data. */
export function invalidate(key: string): void {
  for (const fn of invalidated) fn(key);
}

export async function enqueue(
  write: Omit<QueuedWrite, 'id' | 'createdAt' | 'attempts'>,
): Promise<QueuedWrite> {
  const session = sessionState();
  const item: QueuedWrite = {
    ...write,
    ...(session.status === 'signed-in' && { userId: session.user.id }),
    id: uuidv7(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await (await db()).put('queue', item);
  changed();
  void flush();
  return item;
}

export async function queuedWrites(): Promise<QueuedWrite[]> {
  return (await db()).getAllFromIndex('queue', 'createdAt');
}

let flushing: Promise<void> | null = null;
/** A write was saved while a flush ran: go round once more before stopping. */
let again = false;

/** Sends what is waiting. Stops at the first "no internet"; a refusal is kept and shown. */
export function flush(): Promise<void> {
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      do {
        again = false;
        if (!(await sendWaiting())) return;
      } while (again);
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** One pass over the queue, oldest first. False when it had to stop (no internet, server down). */
async function sendWaiting(): Promise<boolean> {
  for (const item of await queuedWrites()) {
    if (item.failed) continue;
    // Checked before each send: someone else's write, left from before they were signed out,
    // is never sent as the person signed in now.
    const session = sessionState();
    if (session.status !== 'signed-in') return false;
    if (item.userId && item.userId !== session.user.id) continue;
    try {
      await api(
        item.method,
        item.path,
        item.raw ? { raw: { body: item.raw.blob, type: item.raw.type } } : { body: item.body },
      );
      await (await db()).delete('queue', item.id);
      for (const key of item.refresh ?? []) for (const fn of invalidated) fn(key);
    } catch (err) {
      if (err instanceof OfflineError) return false;
      // 5xx or 429: the server may accept it later; keep it and try again next time.
      if (err instanceof ApiError && (err.status >= 500 || err.status === 429)) return false;
      if (err instanceof ApiError) {
        await (
          await db()
        ).put('queue', {
          ...item,
          attempts: item.attempts + 1,
          failed: { code: err.code, status: err.status },
        });
      } else {
        return false;
      }
    } finally {
      changed();
    }
  }
  return true;
}

/**
 * The sentence after saving a queued write: what was done when online, or the calm "saved on
 * this phone, will send" when not (MOB-002 §4, §6).
 */
export function savedText(t: Translate, done: string): string {
  return typeof navigator !== 'undefined' && navigator.onLine === false ? t('offlineSaved') : done;
}

/** A different person signed in on this phone: drop what earlier people left unsent. */
export async function dropOthersWrites(userId: string): Promise<void> {
  const d = await db();
  for (const w of await queuedWrites()) {
    if (w.userId && w.userId !== userId) await d.delete('queue', w.id);
  }
  changed();
}

/** Forgets a refused write (the person saw it). */
export async function dismiss(id: string): Promise<void> {
  await (await db()).delete('queue', id);
  changed();
}

/** Flushes now and whenever the phone comes back online or the app comes back to the front. */
export function startQueue(): void {
  void flush();
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
}

/** The waiting writes of some kinds (all with null), kept up to date. */
export function useQueued(kinds: string[] | null): QueuedWrite[] {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  const [items, setItems] = useState<QueuedWrite[]>([]);
  const key = kinds === null ? '*' : kinds.join(',');
  useEffect(() => {
    let live = true;
    void queuedWrites().then((all) => {
      if (live) setItems(key === '*' ? all : all.filter((w) => key.split(',').includes(w.kind)));
    });
    return () => {
      live = false;
    };
  }, [v, key]);
  return items;
}

/** Tests only. */
export function resetQueueForTests(): void {
  flushing = null;
  again = false;
  listeners.clear();
  invalidated.clear();
}
