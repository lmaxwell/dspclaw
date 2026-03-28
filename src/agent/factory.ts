import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createMoonshotAI } from '@ai-sdk/moonshotai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createZhipu } from 'zhipu-ai-provider';
import { ToolLoopAgent } from 'ai';
import { useStore } from '../store';
import { tools as baseTools } from './tools/index';
import { agentCache, cleanupSessionCache } from './agent-cache';
import { PROVIDERS, getProviderConfig } from '../config';

/**
 * Maps our store providers to Vercel AI SDK providers and returns a model instance.
 */
function getModel(provider: string, apiKey: string, modelId: string) {
  const keyPrefix = apiKey ? apiKey.slice(0, 4) : 'none';
  const keySuffix = apiKey ? apiKey.slice(-4) : 'none';
  console.log(`[DSPCLAW] Creating provider '${provider}' for model '${modelId}' with key: '${apiKey ? keyPrefix + '...' + keySuffix : 'none'}'`);

  if (provider === 'gemini') {
    const google = createGoogleGenerativeAI({
      apiKey,
      baseURL: PROVIDERS.gemini.apiBase,
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    // Thinking models work by default; thinkingConfig can be passed via providerOptions in streamText
    return google(modelId);
  }

  if (provider === 'moonshot') {
    const moonshot = createMoonshotAI({
      apiKey,
      baseURL: PROVIDERS.moonshot.apiBase,
    });
    return moonshot(modelId);
  }

  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({
      apiKey,
    });
    return deepseek(modelId);
  }

  if (provider === 'glm') {
    const zhipu = createZhipu({
      apiKey,
    });
    // Check if model supports thinking (GLM-4.5+)
    const isThinkingModel = modelId.includes('4.5') || modelId.includes('4.6') || modelId.includes('4.7') || modelId.includes('5');
    if (isThinkingModel) {
      return zhipu(modelId, {
        thinking: {
          type: 'enabled',
        },
      });
    }
    return zhipu(modelId);
  }

  // OpenAI-compatible providers (custom providers)
  const openai = createOpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  // Use .chat() for standard /chat/completions endpoint
  return openai.chat(modelId);
}

/**
 * Configures and retrieves a cached agent for a specific session.
 * Returns a ToolLoopAgent that can be used with DirectChatTransport.
 */
export function getOrCreateAgent(sessionId: string) {
  const store = useStore.getState();
  const session = store.sessions.find(s => s.id === sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  // Include provider and model in cache key so changing either creates a new agent
  const cacheKey = `${sessionId}-${store.provider}-${session.model}`;

  if (agentCache.has(cacheKey)) {
    return agentCache.get(cacheKey)!;
  }

  // Clean up stale entries for this session before creating new agent
  cleanupSessionCache(sessionId, cacheKey);

  console.log(`[DSPCLAW] Creating NEW agent instance for session: ${sessionId} using model: ${session.model}`);

  // Provide a safe default model if none is set in session
  let modelId = session.model;
  if (!modelId) {
    const config = getProviderConfig(store.provider);
    modelId = config.defaultModel;
  }

  const model = getModel(store.provider, store.apiKeys[store.provider], modelId);

  const systemPrompt = `You are CLAW, a world-class Expert Audio DSP Engineer specializing in the Faust Programming Language.
Your goal is to generate high-performance, sample-rate independent audio code.

**CRITICAL INSTRUCTIONS:**
1.  **Analyze and Plan:** Always start by analyzing the user's request and forming a plan.
2.  **Use Tools:** You MUST use the provided tools to interact with the environment.
    - **NEVER assume you know the current code.** ALWAYS use the 'readFaustCode' tool to get the current state before making changes.
    - Use 'updateFaustCode' to apply changes.
    - Use 'listStdlibFiles' and 'readStdlibFile' to explore available libraries.
3.  **Workflow:** Work methodically: Read the code, formulate the change, write the new code, and then use 'compileAndRun' to verify.
4.  **Be Surgical:** When modifying code, only change what is necessary. Preserve existing controls and logic unless asked to do otherwise.
5.  **Explain:** Briefly explain your plan before executing tools.`;

  const tools = Object.entries(baseTools).reduce((acc, [name, t]) => {
    acc[name] = {
      ...t,
      execute: (args: Record<string, unknown>, context: any) => (t as any).execute({ ...args, __sessionId: sessionId }, context),
    };
    return acc;
  }, {} as Record<string, any>);

  // Build provider-specific options for reasoning/thinking
  const providerOpts: Record<string, any> = {};

  if (store.provider === 'gemini') {
    const isGemini3 = modelId.toLowerCase().includes('gemini-3');
    const isGemini2_5 = modelId.toLowerCase().includes('gemini-2.5');
    
    if (isGemini3 || isGemini2_5) {
      providerOpts.google = {
        thinkingConfig: {
          includeThoughts: true,
          ...(isGemini3 ? { thinkingLevel: 'high' } : { thinkingBudget: 8192 })
        },
      };
    }
  } else if (store.provider === 'moonshot') {
    providerOpts.moonshotai = {
      thinking: {
        type: 'enabled',
        budgetTokens: 1024,
      },
    };
  } else if (store.provider === 'deepseek') {
    providerOpts.deepseek = {
      thinking: {
        type: 'enabled',
        budgetTokens: 1024,
      },
    };
  } else if (store.provider === 'glm') {
    providerOpts.zhipu = {
      thinking: {
        type: 'enabled',
      },
    };
  }

  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools,
    providerOptions: providerOpts,
    onStepFinish: (event) => {
      if (event.usage) {
        useStore.getState().updateSession(sessionId, { 
          tokenUsage: {
            inputTokens: event.usage.inputTokens ?? 0,
            outputTokens: event.usage.outputTokens ?? 0,
            totalTokens: event.usage.totalTokens ?? 0
          }
        });
      }
    }
  });

  agentCache.set(cacheKey, agent);
  return agent;
}
