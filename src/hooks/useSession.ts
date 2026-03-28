import { useStore } from '../store';
import type { Session } from '../store';

/**
 * Hook to get a specific session by ID (reactive)
 * Returns undefined if session not found
 */
export function useSession(sessionId: string): Session | undefined {
  return useStore(state => state.sessions.find(s => s.id === sessionId));
}

/**
 * Hook to get the currently active session (reactive)
 * Returns undefined if no active session is set
 */
export function useActiveSession(): Session | undefined {
  const activeSessionId = useStore(state => state.activeSessionId);
  return useStore(state => state.sessions.find(s => s.id === activeSessionId));
}

/**
 * Get a specific session by ID (non-reactive)
 * Uses getState() for use in callbacks, tools, and other non-reactive contexts
 */
export function getSession(sessionId: string): Session | undefined {
  const store = useStore.getState();
  return store.sessions.find(s => s.id === sessionId);
}

/**
 * Get the active session (non-reactive)
 * Uses getState() for use in callbacks, tools, and other non-reactive contexts
 */
export function getActiveSession(): Session | undefined {
  const store = useStore.getState();
  return store.sessions.find(s => s.id === store.activeSessionId);
}

/**
 * Get active session ID (non-reactive)
 */
export function getActiveSessionId(): string {
  return useStore.getState().activeSessionId;
}
