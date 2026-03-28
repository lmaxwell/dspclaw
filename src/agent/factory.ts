import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createMoonshotAI } from '@ai-sdk/moonshotai';
import { ToolLoopAgent } from 'ai';
import { useStore } from '../store';
import { tools as baseTools } from './tools/index';
import { agentCache } from './agent-cache';

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
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      headers: {
        'x-goog-api-key': apiKey
      }
    });
    return google(modelId, {
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: 1024,
      }
    });
  }

  if (provider === 'moonshot') {
    const moonshot = createMoonshotAI({
      apiKey,
      baseURL: 'https://api.moonshot.cn/v1',
    });
    return moonshot(modelId);
  }

  // OpenAI-compatible providers
  let baseURL = 'https://api.openai.com/v1';
  if (provider === 'deepseek') {
    baseURL = 'https://api.deepseek.com/v1';
  } else if (provider === 'glm') {
    baseURL = 'https://open.bigmodel.cn/api/paas/v4';
  }

  const openai = createOpenAI({
    apiKey,
    baseURL,
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return openai(modelId);
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

  console.log(`[DSPCLAW] Creating NEW agent instance for session: ${sessionId} using model: ${session.model}`);

  // Provide a safe default model if none is set in session
  let modelId = session.model;
  if (!modelId) {
    switch (store.provider) {
      case 'gemini': modelId = 'gemini-1.5-flash-latest'; break;
      case 'moonshot': modelId = 'moonshot-v1-8k'; break;
      case 'deepseek': modelId = 'deepseek-chat'; break;
      case 'glm': modelId = 'glm-4'; break;
      default: modelId = 'gpt-4o';
    }
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

  const agent = new ToolLoopAgent({
    model,
    instructions: systemPrompt,
    tools,
    providerOptions: {
      moonshotai: {
        thinking: {
          type: 'enabled',
          budgetTokens: 1024,
        },
      },
    },
  });

  agentCache.set(cacheKey, agent);
  return agent;
}
