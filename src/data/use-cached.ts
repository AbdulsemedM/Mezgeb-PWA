import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, OfflineError } from '../api/client';
import { cacheGet, cacheSet } from '../storage/db';
import { onInvalidate } from './queue';

export interface Cached<T> {
  /** The last data seen: from the network or, until it answers, from this phone. */
  data?: T;
  /** When `data` came from the server (ISO); shown as "Last updated". */
  savedAt?: string;
  /** Fetching from the server right now. */
  refreshing: boolean;
  /** The last fetch found no internet; `data` (if any) is what was saved. */
  offline: boolean;
  /** The server refused (not "no internet"). */
  error: ApiError | Error | null;
  refresh: () => Promise<void>;
}

/**
 * WEB-001 offline reading: show what was saved on this phone at once, then fetch and save the
 * fresh copy. No internet keeps the saved copy and never looks like an error.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T>): Cached<T> {
  const [state, setState] = useState<Omit<Cached<T>, 'refresh'>>({
    refreshing: true,
    offline: false,
    error: null,
  });
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, refreshing: true }));
    try {
      const data = await fetchRef.current();
      const savedAt = new Date();
      await cacheSet(key, data, savedAt);
      setState({
        data,
        savedAt: savedAt.toISOString(),
        refreshing: false,
        offline: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        refreshing: false,
        offline: err instanceof OfflineError,
        error: err instanceof OfflineError ? null : (err as Error),
      }));
    }
  }, [key]);

  useEffect(() => {
    let live = true;
    void cacheGet<T>(key).then((saved) => {
      if (live && saved) {
        setState((s) =>
          s.data === undefined ? { ...s, data: saved.data, savedAt: saved.savedAt } : s,
        );
      }
    });
    void refresh();
    // Back online or back to the app: fetch again.
    const again = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', again);
    // A queued write for this data was accepted: show the server's copy.
    const offInvalidate = onInvalidate((k) => {
      if (k === key) void refresh();
    });
    document.addEventListener('visibilitychange', again);
    return () => {
      live = false;
      window.removeEventListener('online', again);
      offInvalidate();
      document.removeEventListener('visibilitychange', again);
    };
  }, [key, refresh]);

  return { ...state, refresh };
}
