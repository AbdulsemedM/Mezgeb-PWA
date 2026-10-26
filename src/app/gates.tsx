import type { ReactElement } from 'react';
import { Navigate } from './router';
import { useSession } from '../auth/useSession';

/** While the saved session is read (a few ms from IndexedDB): the paper colour, nothing else. */
function Splash() {
  return <div className="screen" aria-busy="true" />;
}

/** Screens that need a signed-in person; anyone else starts at the language choice. */
export function RequireSession({ children }: { children: ReactElement }) {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'signed-out') return <Navigate to="/start" replace />;
  if (!session.user.calendar_pref) return <Navigate to="/setup/calendar" replace />;
  return children;
}

/** The calendar step needs a session but must not loop back to itself. */
export function RequireSignedIn({ children }: { children: ReactElement }) {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'signed-out') return <Navigate to="/start" replace />;
  return children;
}

/** Sign-in and the start screen are for signed-out people only. */
export function SignedOutOnly({ children }: { children: ReactElement }) {
  const session = useSession();
  if (session.status === 'loading') return <Splash />;
  if (session.status === 'signed-in') return <Navigate to="/invites" replace />;
  return children;
}
