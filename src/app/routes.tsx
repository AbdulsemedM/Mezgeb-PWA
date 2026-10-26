import type { ReactElement } from 'react';
import { BookScreen } from '../features/book/BookScreen';
import { EntryScreen } from '../features/book/EntryScreen';
import { HomeScreen } from '../features/home/HomeScreen';
import { InstalledScreen } from '../features/install/InstalledScreen';
import { InstallScreen } from '../features/install/InstallScreen';
import { InviteScreen } from '../features/invite/InviteScreen';
import { InvitesScreen } from '../features/invites/InvitesScreen';
import { TermsScreen } from '../features/invites/TermsScreen';
import { CalendarScreen } from '../features/signin/CalendarScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { SignInScreen } from '../features/signin/SignInScreen';
import { StartScreen } from '../features/start/StartScreen';
import { RequireSession, RequireSignedIn, SignedOutOnly } from './gates';

export interface AppRoute {
  path: string;
  element: ReactElement;
}

/** Every screen of the PWA. Customer features only (CLAUDE.md rule 8). */
export const routes: AppRoute[] = [
  // W2: invite and install (WEB-001 steps 2–4). Open to everyone.
  { path: '/i/:code', element: <InviteScreen /> },
  { path: '/install', element: <InstallScreen /> },
  { path: '/installed', element: <InstalledScreen /> },

  // W3: sign-in, calendar, terms and pending invites (WEB-001 step 5).
  {
    path: '/start',
    element: (
      <SignedOutOnly>
        <StartScreen />
      </SignedOutOnly>
    ),
  },
  {
    path: '/signin',
    element: (
      <SignedOutOnly>
        <SignInScreen />
      </SignedOutOnly>
    ),
  },
  {
    path: '/setup/calendar',
    element: (
      <RequireSignedIn>
        <CalendarScreen />
      </RequireSignedIn>
    ),
  },
  {
    path: '/invites',
    element: (
      <RequireSession>
        <InvitesScreen />
      </RequireSession>
    ),
  },
  {
    path: '/invites/:accountId',
    element: (
      <RequireSession>
        <TermsScreen />
      </RequireSession>
    ),
  },

  // W4: the dube book.
  {
    path: '/',
    element: (
      <RequireSession>
        <HomeScreen />
      </RequireSession>
    ),
  },
  {
    path: '/shops/:accountId',
    element: (
      <RequireSession>
        <BookScreen />
      </RequireSession>
    ),
  },
  {
    path: '/shops/:accountId/entries/:entryId',
    element: (
      <RequireSession>
        <EntryScreen />
      </RequireSession>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireSession>
        <SettingsScreen />
      </RequireSession>
    ),
  },
];
