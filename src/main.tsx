import './ui/ui.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startServiceWorker } from './app/UpdateBanner';
import { restoreSession } from './auth/session';
import { invalidate, startQueue } from './data/queue';
import { refreshPushSubscription } from './features/notifications/push';
import { captureInstallPrompt } from './features/install/install-prompt';

// Chrome fires this once, early: catch it before React renders (WEB-001 step 3).
captureInstallPrompt();
void restoreSession().then((state) => {
  startQueue();
  if (state.status === 'signed-in') void refreshPushSubscription();
});

// A push arrived while the app is open: show the server's new data (WEB-001).
navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type?: string; data?: { account_id?: string } } | null;
  if (msg?.type !== 'push') return;
  invalidate('home');
  if (msg.data?.account_id) invalidate(`book:${msg.data.account_id}`);
});
startServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
