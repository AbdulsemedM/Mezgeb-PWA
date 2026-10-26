import type { ReactElement } from 'react';
import { StartScreen } from '../features/start/StartScreen';

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/** Every screen of the PWA. Customer features only (CLAUDE.md rule 8). */
export const routes: AppRoute[] = [
  { path: '/', element: <StartScreen /> },
  { path: '/start', element: <StartScreen /> },
];
