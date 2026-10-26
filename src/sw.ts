/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { pathForPush } from './features/notifications/push-path';

declare const self: ServiceWorkerGlobalScope;

// The app shell and the subset font (WEB-001). Data lives in IndexedDB; the API is never
// cached here, so a stale response can never pose as the truth.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every in-app URL (/i/<code>, /shops/…) opens the shell offline too.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/v1\//, /^\/\.well-known\//],
  }),
);

// Install guide pictures: fetched only by people who need them, then kept.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/guides/'),
  new CacheFirst({
    cacheName: 'guides',
    plugins: [new ExpirationPlugin({ maxEntries: 20 })],
  }),
);

// The page asks the waiting worker to take over when the person taps "Update now".
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

interface PushData {
  title?: string;
  body?: string;
  data?: { event?: string; account_id?: string };
}

// WEB-001: a Web Push from the API (ADR-016). Open windows are told so they refresh.
self.addEventListener('push', (event) => {
  let push: PushData = {};
  try {
    push = (event.data?.json() as PushData) ?? {};
  } catch {
    push = { body: event.data?.text() };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(push.title ?? 'Nota', {
        body: push.body ?? '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: push.data ?? {},
        tag: push.data?.account_id,
      });
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        client.postMessage({ type: 'push', data: push.data ?? {} });
      }
    })(),
  );
});

// A tap opens the screen the message is about, in an open window if there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = pathForPush(event.notification.data as PushData['data']);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(path);
      } else {
        await self.clients.openWindow(path);
      }
    })(),
  );
});
