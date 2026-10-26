/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

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
