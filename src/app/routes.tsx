import type { ReactElement } from 'react';
import { InstalledScreen } from '../features/install/InstalledScreen';
import { InstallScreen } from '../features/install/InstallScreen';
import { InviteScreen } from '../features/invite/InviteScreen';
import { StartScreen } from '../features/start/StartScreen';

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/** Every screen of the PWA. Customer features only (CLAUDE.md rule 8). */
export const routes: AppRoute[] = [
  { path: '/', element: <StartScreen /> },
  { path: '/start', element: <StartScreen /> },
  // W2: invite and install (WEB-001 steps 2–4).
  { path: '/i/:code', element: <InviteScreen /> },
  { path: '/install', element: <InstallScreen /> },
  { path: '/installed', element: <InstalledScreen /> },
];
