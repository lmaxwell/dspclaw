import { initFaust } from './faust/compiler';
import { initMidi } from './midi/manager';
import { useStore } from './store';
import { compileAndRun } from './agent/tools/compile_and_run';

// Prevent minification issues with faustwasm in some environments
(window as any).Py = (window as any).Py || {};

let isInitialized = false;

export const initializeApp = async () => {
  if (isInitialized) return;
  isInitialized = true;
  
  console.log('--- DSPCLAW INITIALIZATION START ---');

  // Wrap init steps in a timeout to prevent total app hang
  const timeout = (ms: number, msg: string) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Timeout during: ${msg}`)), ms)
  );

  try {
    await Promise.race([initFaust(), timeout(10000, "Faust Engine Initialization")]);
    await Promise.race([initMidi(), timeout(5000, "MIDI System Initialization")]);
  } catch (e) {
    console.error("Critical Engine Init Error:", e);
    throw e;
  }

  // Load API keys from .env into store (only if not already set by user, and only in DEV mode)
  if (import.meta.env.DEV) {
    const store = useStore.getState();
    const envKeys: Record<string, string | undefined> = {
      gemini: import.meta.env.VITE_GEMINI_API_KEY,
      moonshot: import.meta.env.VITE_KIMI_MOONSHOT_API_KEY,
      deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
      glm: import.meta.env.VITE_GLM_API_KEY,
    };

    for (const [provider, key] of Object.entries(envKeys)) {
      if (key && !store.apiKeys[provider]) {
        store.setApiKey(provider, key);
      }
    }
  }

  // Give it a tiny bit of time for WASM/Midi to settle before first compile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Auto-compile all initial sessions
  try {
    const sessions = useStore.getState().sessions;
    for (const session of sessions) {
      try {
        await compileAndRun.execute!({ __sessionId: session.id }, {} as any);
      } catch(e) {
        console.warn(`Initial compile failed for ${session.id}:`, e);
      }
    }
  } catch (e) {
    console.warn("Initial compilation deferred:", e);
  }

  useStore.getState().setInitialized(true);
  (window as any).store = useStore;

  console.log('--- DSPCLAW INITIALIZATION COMPLETE ---');
};
