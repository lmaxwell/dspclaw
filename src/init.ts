import { initFaust } from './faust/compiler';
import { initMidi } from './midi/manager';
import { useStore } from './store';
import { compileAndRun } from './agent/tools/compile_and_run';

// Prevent minification issues with faustwasm in some environments
(window as any).Py = (window as any).Py || {};

let isInitialized = false;

export const initializeApp = async () => {
  if (isInitialized) return;
  
  console.log('--- DSPCLAW INITIALIZATION START ---');

  await initFaust();
  await initMidi();
  
  // Give it a tiny bit of time for WASM/Midi to settle before first compile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Auto-compile all initial sessions
  try {
    const sessions = useStore.getState().sessions;
    for (const session of sessions) {
      await compileAndRun.execute('init-compile', { __sessionId: session.id });
    }
  } catch (e) {
    console.warn("Initial compilation deferred:", e);
  }

  isInitialized = true;
  useStore.getState().setInitialized(true);
  (window as any).store = useStore;

  console.log('--- DSPCLAW INITIALIZATION COMPLETE ---');
};
