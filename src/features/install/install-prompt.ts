/**
 * WEB-001 step 3: Chromium's `beforeinstallprompt` arrives once, early, and only after the
 * page looks installable. It is captured at startup (before React renders) and kept here
 * until the person taps "Put Mezgeb on my home screen".
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Listener = () => void;

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) l();
}

export function captureInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (e) => {
    // Keep Chrome's mini-infobar away: the app offers installing in its own words.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  target.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function installPromptReady(): boolean {
  return deferred !== null;
}

export function wasInstalled(): boolean {
  return installed;
}

export function onInstallChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens Chrome's install dialog. The event can be used once. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred;
  if (!e) return 'unavailable';
  deferred = null;
  notify();
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') {
    installed = true;
    notify();
  }
  return outcome;
}

/** True inside the installed app (home screen icon). */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Tests only. */
export function resetInstallPromptForTests(): void {
  deferred = null;
  installed = false;
  listeners.clear();
}
