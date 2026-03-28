// src/agent/agent-cache.ts
import { ToolLoopAgent } from 'ai';

/**
 * A singleton cache to hold a persistent agent instance for each session.
 * This prevents the agent and its provider from being re-created on every
 * component re-render or tab switch, making the UI much more efficient.
 */
export const agentCache = new Map<string, ToolLoopAgent>();

export function clearAgentCache() {
  console.log('[DSPCLAW] Clearing agent cache due to settings change');
  agentCache.clear();
}

/**
 * Removes stale cache entries for a session.
 * Call this when the model changes to prevent memory leaks.
 */
export function cleanupSessionCache(sessionId: string, currentKey: string) {
  const keysToDelete: string[] = [];

  // Find all keys for this session that don't match the current key
  agentCache.forEach((_, key) => {
    if (key.startsWith(`${sessionId}-`) && key !== currentKey) {
      keysToDelete.push(key);
    }
  });

  // Delete stale entries
  if (keysToDelete.length > 0) {
    keysToDelete.forEach(key => {
      console.log(`[DSPCLAW] Removing stale cache entry: ${key}`);
      agentCache.delete(key);
    });
  }
}

/**
 * Gets the current cache size for debugging/monitoring.
 */
export function getCacheSize(): number {
  return agentCache.size;
}
