import { initFaust } from './faust/compiler';
import { initMCPServer } from './mcp/server';
import { initMCPClient } from './mcp/client';
import { initMidi } from './midi/manager';
import { useStore } from './store';

// Prevent minification issues with faustwasm in some environments
(window as any).Py = (window as any).Py || {};

let isInitialized = false;
let client: any = null;

export const initializeApp = async () => {
  if (isInitialized) return client;
  
  console.log('--- DSPCLAW INITIALIZATION START ---');
  await initFaust();
  await initMidi();
  initMCPServer();
  client = await initMCPClient();
  
  // Give it a tiny bit of time for WASM/Midi to settle before first compile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Auto-compile all initial sessions
  try {
    const sessions = useStore.getState().sessions;
    for (const session of sessions) {
      await client.callTool({
        name: "compile_and_run",
        arguments: { __sessionId: session.id }
      });
    }
  } catch (e) {
    console.warn("Initial compilation deferred:", e);
  }

  isInitialized = true;
  (window as any).mcpClient = client;
  useStore.getState().setInitialized(true);

  console.log('--- DSPCLAW INITIALIZATION COMPLETE ---');
  return client;
};
