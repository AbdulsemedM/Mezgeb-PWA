import { useSyncExternalStore } from 'react';
import { type SessionState, sessionState, subscribe } from './session';

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, sessionState, sessionState);
}
