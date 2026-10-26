import { WEB_PUSH_TOKEN_PREFIX } from '@shared/session';
import { api } from '../../api/client';

/**
 * WEB-001 notifications: Web Push (VAPID) behind the backend's PushSender (ADR-016). The
 * subscription is this device's push token, `webpush:` + its JSON. SMS keeps coming either way.
 */
export type PushState = 'unsupported' | 'off' | 'on' | 'blocked';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' ? 'on' : 'off';
}

let vapidKey: Promise<string | null> | null = null;

/** The server's VAPID public key, or null when web push is off there. */
export function serverKey(): Promise<string | null> {
  vapidKey ??= api<{ vapid_public_key: string | null }>('GET', '/v1/devices/web-push-key', {
    auth: false,
  })
    .then((r) => r.vapid_public_key)
    .catch(() => {
      vapidKey = null;
      return null;
    });
  return vapidKey;
}

/** Asks the browser (after a tap, never on first load) and registers the subscription. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const key = await serverKey();
  if (!key) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  await registerSubscription(key);
  return 'on';
}

/** On every start while allowed: the subscription can change; the server keeps the newest. */
export async function refreshPushSubscription(): Promise<void> {
  if (pushState() !== 'on') return;
  const key = await serverKey();
  if (key) await registerSubscription(key).catch(() => undefined);
}

async function registerSubscription(key: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(key),
    }));
  await api('PUT', '/v1/devices/me/push-token', {
    body: { token: `${WEB_PUSH_TOKEN_PREFIX}${JSON.stringify(sub.toJSON())}` },
  });
}

/** Signing out: this browser stops getting the person's messages. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    // Nothing to undo.
  }
}

export function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(text.length / 4) * 4, '=');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export { pathForPush } from './push-path';

/** Tests only. */
export function resetPushForTests(): void {
  vapidKey = null;
}
