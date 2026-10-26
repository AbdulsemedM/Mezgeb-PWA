import './ui/ui.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { startServiceWorker } from './app/UpdateBanner';
import { restoreSession } from './auth/session';
import { captureInstallPrompt } from './features/install/install-prompt';

// Chrome fires this once, early: catch it before React renders (WEB-001 step 3).
captureInstallPrompt();
void restoreSession();
startServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
