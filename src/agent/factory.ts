import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { useStore } from '../store';
import { tools as baseTools } from './tools/index';
import { agentCache } from './agent-cache';

/**
 * Maps our store providers to Vercel AI SDK providers.
 */
function getProvider(provider: string, apiKey: string) {
  console.log(`[DSPCLAW] Creating provider '${provider}' with key: '${apiKey ? 'sk-...' + apiKey.slice(-4) : 'none'}'`);
  
  if (provider === 'gemini') {
    return createGoogleGenerativeAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: {
        'x-goog-api-key': apiKey
      }
    });
  }

  // OpenAI-compatible providers
  let baseURL = 'https://api.openai.com/v1';
  if (provider === 'moonshot') {
    baseURL = 'https://api.moonshot.cn/v1';
  } else if (provider === 'deepseek') {
    baseURL = 'https://api.deepseek.com/v1';
  } else if (provider === 'glm') {
    baseURL = 'https://open.bigmodel.cn/api/paas/v4';
  }

  return createOpenAI({
    apiKey,
    baseURL,
    compatibility: 'compatible',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
}

/**
 * Configures and retrieves a cached agent for a specific session.
 * Returns a ToolLoopAgent that can be used with DirectChatTransport.
 */
export function getOrCreateAgent(sessionId: string) {
  if (agentCache.has(sessionId)) {
    return agentCache.get(sessionId)!;
  }

  console.log(`[DSPCLAW] Creating NEW agent instance for session: ${sessionId}`);

  const store = useStore.getState();
  const session = store.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const provider = getProvider(store.provider, store.apiKeys[store.provider]);
  const model = provider.chat(store.model || 'gpt-4o');

  const typeDesc = session.type === 'poly' ? "SYNTH (Polyphonic Generator)" : "EFFECT (Monophonic Processor)";
  const typeRules = session.type === 'poly' 
    ? "STRICT RULE: This is a SYNTH track. You must GENERATE audio (oscillators, noise, etc.). DO NOT use audio input '_' unless you are explicitly building a hybrid 'Synth + FX' chain."
    : "STRICT RULE: This is an EFFECT track. You MUST NOT generate sound from scratch (no oscillators). You MUST process the incoming audio signal using the '_' symbol (e.g. process = _ : reverb;).";

  const systemPrompt = `You are CLAW, a world-class Expert Audio DSP Engineer specializing in the Faust Programming Language. 
Your goal is to generate high-performance, sample-rate independent audio code for use in professional DAWs and web environments.
...`;

  const tools = Object.entries(baseTools).reduce((acc, [name, t]) => {
    acc[name] = {
      ...t,
      execute: (args: Record<string, unknown>) => (t as any).execute({ ...args, __sessionId: sessionId }),
    };
    return acc;
  }, {} as Record<string, any>);

  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools,
  });

  agentCache.set(sessionId, agent);
  return agent;
}
