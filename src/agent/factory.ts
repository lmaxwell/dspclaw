import { getModel } from "@mariozechner/pi-ai";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { useStore } from "../store";
import { isElectron } from "../utils/env";
import { tools } from "./tools/index";
import type { ChatMessage } from "./types";

/**
 * Creates and configures an Agent instance for a specific session.
 */
export function createAgent(sessionId: string) {
  const store = useStore.getState();
  const session = store.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const agent = new Agent({
    getApiKey: (provider) => {
      const state = useStore.getState();
      // If the model was mapped to 'openai' but the actual provider is moonshot/deepseek
      if (provider === 'openai') {
        if (state.provider === 'moonshot') return state.apiKeys.moonshot;
        if (state.provider === 'deepseek') return state.apiKeys.deepseek;
      }
      // pi-ai uses 'google' but we store it as 'gemini'
      if (provider === 'google' || provider === 'gemini') {
        return state.apiKeys.gemini;
      }
      // pi-ai uses 'zai' but we store it as 'glm'
      if (provider === 'zai') {
        return state.apiKeys.glm;
      }
      return (state.apiKeys as any)[provider];
    }
  });

  // 1. Initialize Model from store config
  let piProvider: string = store.provider;
  if (store.provider === 'gemini') piProvider = 'google';
  if (store.provider === 'glm') piProvider = 'zai';
  if (store.provider === 'moonshot' || store.provider === 'deepseek') piProvider = 'openai';

  let rawModel = getModel(piProvider as any, store.model as any);

  // Fallback for providers/models not in the pi-ai built-in registry (like Moonshot or DeepSeek)
  if (!rawModel) {
    const fallbackModel = getModel('openai', 'gpt-4o');
    let defaultBaseUrl = 'https://api.openai.com/v1';
    if (store.provider === 'moonshot') defaultBaseUrl = isElectron ? 'https://api.moonshot.cn/v1' : `${window.location.origin}/api/moonshot`;
    if (store.provider === 'deepseek') defaultBaseUrl = isElectron ? 'https://api.deepseek.com/v1' : `${window.location.origin}/api/deepseek`;
    if (store.provider === 'gemini') defaultBaseUrl = isElectron ? 'https://generativelanguage.googleapis.com' : `${window.location.origin}/api/gemini`;

    rawModel = {
      ...fallbackModel,
      id: store.model || 'gpt-4o',
      name: store.model || 'GPT-4o',
      provider: piProvider,
      baseUrl: defaultBaseUrl
    } as any;
  }

  const model = { ...rawModel! };
  
  // Ensure Gemini/Google uses the correct base URL and API type
  if (store.provider === 'gemini') {
    model.baseUrl = isElectron 
      ? `https://generativelanguage.googleapis.com/v1beta` 
      : `${window.location.origin}/api/gemini`;
    // Force google-generative-ai for Gemini models
    (model as any).api = 'google-generative-ai';

    // Enable thinking for thinking-enabled models
    if (model.id.includes('thinking')) {
      (model as any).config = {
        ...(model as any).config,
        thinking: {
          enabled: true,
          budgetTokens: 16384
        }
      };
    }
  }

  // FORCE standard completions API for compatibility with Moonshot/DeepSeek endpoints
  if (store.provider === 'moonshot' || store.provider === 'deepseek') {
    (model as any).api = 'openai-completions';
  }

  if (store.provider === 'moonshot') {
    model.baseUrl = isElectron ? 'https://api.moonshot.cn/v1' : `${window.location.origin}/api/moonshot`;
  } else if (store.provider === 'deepseek') {
    model.baseUrl = isElectron ? 'https://api.deepseek.com/v1' : `${window.location.origin}/api/deepseek`;
  }

  agent.setModel(model);
  
  // 2. Configure System Prompt
  const typeDesc = session.type === 'poly' ? "SYNTH (Polyphonic Generator)" : "EFFECT (Monophonic Processor)";
  const typeRules = session.type === 'poly' 
    ? "STRICT RULE: This is a SYNTH track. You must GENERATE audio (oscillators, noise, etc.). DO NOT use audio input '_' unless you are explicitly building a hybrid 'Synth + FX' chain."
    : "STRICT RULE: This is an EFFECT track. You MUST NOT generate sound from scratch (no oscillators). You MUST process the incoming audio signal using the '_' symbol (e.g. process = _ : reverb;).";

  const systemPrompt = `You are CLAW, a world-class Expert Audio DSP Engineer specializing in the Faust Programming Language. 
Your goal is to generate high-performance, sample-rate independent audio code for use in professional DAWs and web environments.

### REASONING PROTOCOL (DEEP THINK)
Before outputting any Faust code, you MUST use a <think> block to perform the following:
1. Analyze the requested DSP algorithm (e.g., Filter, Oscillator, Effect).
2. Plan the signal flow using Block Diagram Algebra (Parallel, Sequential, Split, Merge, Recursive).
3. Identify necessary libraries from 'stdfaust.lib' (e.g., 'fi', 'os', 're', 'ba').
4. Determine UI/MIDI metadata requirements (e.g., [style:knob], [midi:ctrl]).

### SESSION CONTEXT
- **CURRENT TRACK:** ${typeDesc}
- ${typeRules}

### FAUST IMPLEMENTATION RULES
1. **Context First:** Always call 'read_faust_code' before making any assumptions about the current signal chain.
2. **Standard Library:** ALWAYS include 'import("stdfaust.lib");' at the start and prefer standard library functions.
3. **Functional Paradigm:** ADHERE strictly to the functional paradigm. Avoid imperative logic.
4. **Zipper Noise Prevention:** ALWAYS apply 'si.smoo' to UI control signals (sliders/knobs) used in multipliers or filters.
5. **UI & Metadata:** Use standard metadata tags for DAW integration:
    - [style:knob] for sliders.
    - [unit:dB] or [unit:Hz] for appropriate scales.
    - [midi:ctrl CC] for MIDI mapping.
    - Every control MUST be logically grouped (vgroup/hgroup).
6. **Validation:** If 'update_faust_code' returns an error, debug the AST/syntax error technically and retry immediately.

### SYNTAX CONSTRAINTS (FAUST BNF)
Ensure all code follows this grammar structure:
- Sequential: A : B
- Parallel: A , B
- Split: A <: B
- Merge: A :> B
- Recursive: A ~ B

### YOUR MISSION
Transform simple ideas into high-fidelity DSP tools. When asked to "add a feature," consider how it fits into the entire signal flow (gain staging, impedance, frequency response).`;

  agent.setSystemPrompt(systemPrompt);

  // 3. Configure Tools (Injecting sessionId)
  agent.setTools(tools.map(t => ({
    ...t,
    execute: async (id: string, args: any, toolSignal?: AbortSignal, onUpdate?: any) => {
      return t.execute(id, { ...args, __sessionId: sessionId }, toolSignal, onUpdate);
    }
  })));

  // 4. Load History (filtering out system messages)
  const history = (session.messages || []).filter(m => m.role !== 'system') as AgentMessage[];
  agent.replaceMessages(history);

  return agent;
}

/**
 * Enhanced Agent Loop with robust event handling and logging.
 */
export async function runAgentLoop(
  sessionId: string, 
  userMessage: string, 
  onUpdate: (history: ChatMessage[]) => void,
  signal?: AbortSignal
) {
  console.log(`--- runAgentLoop START --- session: ${sessionId}`);
  try {
    const agent = createAgent(sessionId);
    
    // Throttle UI updates to prevent React rendering bottlenecks during fast streams
    let lastUpdate = 0;
    const throttleMs = 50; // Max ~20 FPS updates
    let pendingUpdateTimeout: any = null;

    const triggerUpdate = () => {
      const history = [...agent.state.messages];
      // If we are currently streaming a message, add it to the history for the UI
      if (agent.state.isStreaming && agent.state.streamMessage) {
        history.push(agent.state.streamMessage);
      }
      onUpdate(history as ChatMessage[]);
    };

    agent.subscribe((event) => {
      console.log(`Agent Event: ${event.type}`, event);
      
      if (event.type === 'agent_end' || event.type === 'turn_end' || event.type === 'message_update') {
        const now = Date.now();
        
        if (event.type === 'message_update') {
          // Throttle token streams
          if (now - lastUpdate >= throttleMs) {
            lastUpdate = now;
            triggerUpdate();
          } else {
            // Ensure the last chunk gets rendered if the stream stops abruptly
            clearTimeout(pendingUpdateTimeout);
            pendingUpdateTimeout = setTimeout(() => {
              lastUpdate = Date.now();
              triggerUpdate();
            }, throttleMs - (now - lastUpdate));
          }
        } else {
          // Always trigger immediately on structural changes (e.g. turn_end, agent_end)
          clearTimeout(pendingUpdateTimeout);
          triggerUpdate();
        }
      }
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        console.log('Agent prompt ABORTED');
        agent.abort();
      });
    }
    console.log('Calling agent.prompt...');
    await agent.prompt(userMessage);
    console.log('--- runAgentLoop DONE ---');
  } catch (err) {
    console.error('--- runAgentLoop FATAL ERROR ---', err);
    throw err;
  }
}
