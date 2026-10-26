import { useSyncExternalStore } from 'react';
import { Workbox } from 'workbox-window';
import { useT } from '../i18n';
import { CalmBanner } from '../ui';

type Update = () => void;

let pendingUpdate: Update | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker once, at startup (main.tsx). */
export function startServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const wb = new Workbox('/sw.js', { scope: '/' });
  // A new version installed while this one runs: offer it, never force it.
  wb.addEventListener('waiting', () => {
    pendingUpdate = () => {
      wb.addEventListener('controlling', () => window.location.reload());
      wb.messageSkipWaiting();
    };
    for (const l of listeners) l();
  });
  void wb.register();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * A new app version waits until the person taps "Update now": never a reload in the middle of
 * typing (MOB-002 §6, "never lose what the user typed").
 */
export function UpdateBanner() {
  const t = useT();
  const update = useSyncExternalStore(subscribe, () => pendingUpdate);
  if (!update) return null;
  return (
    <div style={{ padding: '8px 16px 0', maxWidth: '40rem', margin: '0 auto' }}>
      <CalmBanner
        icon="refresh"
        message={t('updateReady')}
        action={{ label: t('updateNow'), onClick: update }}
      />
    </div>
  );
}
