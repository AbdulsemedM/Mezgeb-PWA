import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, OfflineError } from '../api/client';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'offline' }
  | { status: 'error'; error: ApiError | Error };

/**
 * Runs `load` on mount, when `deps` change and on `reload()`. No internet is its own state,
 * never an error (MOB-002 §6).
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[],
): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [n, setN] = useState(0);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const key = JSON.stringify(deps);

  useEffect(() => {
    let live = true;
    loader.current().then(
      (data) => live && setState({ status: 'ready', data }),
      (err: unknown) => {
        if (!live) return;
        if (err instanceof OfflineError) setState({ status: 'offline' });
        else
          setState({ status: 'error', error: err instanceof Error ? err : new Error(String(err)) });
      },
    );
    return () => {
      live = false;
    };
  }, [key, n]);

  const reload = useCallback(() => {
    setState({ status: 'loading' });
    setN((x) => x + 1);
  }, []);

  return { ...state, reload };
}
