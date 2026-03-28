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
