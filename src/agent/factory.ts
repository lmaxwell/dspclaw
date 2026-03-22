import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { type ChatMessage } from './types';
import { getApiUrl, aiFetch } from '../utils/env';

export type AIProvider = 'openai' | 'anthropic' | 'moonshot' | 'glm' | 'custom';

export class UniversalAgent {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private customBaseUrl: string;
  private sessionType: 'poly' | 'mono';
  private sessionId: string;
  private client: Client;
  public history: ChatMessage[] = [];

  constructor(provider: AIProvider, apiKey: string, model: string, mcpClient: Client, initialHistory?: ChatMessage[], customBaseUrl?: string, sessionType: 'poly' | 'mono' = 'poly', sessionId: string = '') {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
    this.customBaseUrl = customBaseUrl || '';
    this.sessionType = sessionType;
    this.sessionId = sessionId;
    this.client = mcpClient;
    
    if (initialHistory && initialHistory.length > 0) {
      this.history = initialHistory;
    } else {
      const typeDesc = sessionType === 'poly' ? "SYNTH (Polyphonic Generator)" : "EFFECT (Monophonic Processor)";
      const typeRules = sessionType === 'poly' 
        ? "STRICT RULE: This is a SYNTH track. You must GENERATE audio (oscillators, noise, etc.). DO NOT use audio input '_' unless you are explicitly building a hybrid 'Synth + FX' chain."
        : "STRICT RULE: This is an EFFECT track. You MUST NOT generate sound from scratch (no oscillators). You MUST process the incoming audio signal using the '_' symbol (e.g. process = _ : reverb;).";

      this.history = [
        {
          role: 'system',
          content: `You are an expert Faust DSP developer. Your mission is to build professional audio tools with beautiful structured UIs.

CURRENT SESSION TYPE: ${typeDesc}
${typeRules}

CRITICAL WORKFLOW (MANDATORY):
1. CONTEXT CHECK: Before modifying, ALWAYS call 'read_faust_code' to see existing logic.
2. EXECUTE CHANGE: ALWAYS call 'update_faust_code' to apply your code to the editor and UI. 
3. AUTOMATIC COMPILATION: Note that 'update_faust_code' automatically triggers compilation and UI refresh.
4. VALIDATION: If 'update_faust_code' returns a compilation error, you MUST analyze the error and call 'update_faust_code' again with fixed code until it succeeds.

MIDI & POLYPHONY RULES (FOR SYNTH TRACKS):
- Use exact names 'freq', 'gate', 'gain' as UI elements (nentry/hslider) for MIDI binding.
- Ensure sound stops when 'gate' is 0 (use 'en.adsr' or multiplication).

FAUST UI RULES (MANDATORY):
- NO NAKED CONTROLS: Every slider/button MUST be wrapped inside a 'vgroup' or 'hgroup'.
- STRUCTURE: Use hierarchical grouping (e.g., hgroup(\"Title\", vgroup(\"OSC\", ...) : vgroup(\"Filter\", ...))).
- STYLING: Use '[style:knob]' for continuous values and '[style:menu{...}]' for discrete selections.
- Syntax: Always 'import(\"stdfaust.lib\");' and output to 'process = ...;'`
        }
      ];
    }
  }

  private getBaseUrl() {
    switch (this.provider) {
      case 'openai': return getApiUrl('/api/openai/chat/completions');
      case 'anthropic': return getApiUrl('/api/anthropic/messages');
      case 'moonshot': return getApiUrl('/api/moonshot/chat/completions');
      case 'custom': return this.customBaseUrl;
      default: return '';
    }
  }

  async chat(userMessage: string, useMcp: boolean, onUpdate: (history: ChatMessage[]) => void, signal?: AbortSignal) {
    const currentHistory = [...this.history];
    currentHistory.push({ role: 'user', content: userMessage });
    onUpdate([...currentHistory]);

    // Ensure system prompt is accurate for the current session state
    const systemIdx = currentHistory.findIndex(m => m.role === 'system');
    if (systemIdx !== -1) {
      const typeDesc = this.sessionType === 'poly' ? "SYNTH (Polyphonic Generator)" : "EFFECT (Monophonic Processor)";
      const typeRules = this.sessionType === 'poly' 
        ? "STRICT RULE: This is a SYNTH track. You must GENERATE audio using oscillators/noise."
        : "STRICT RULE: This is an EFFECT track. You MUST process the incoming audio signal using the '_' symbol.";

      currentHistory[systemIdx].content = `You are an expert Faust DSP developer. Build professional tools with beautiful structured UIs.

CURRENT SESSION TYPE: ${typeDesc}
${typeRules}

CRITICAL WORKFLOW (MANDATORY):
1. CONTEXT CHECK: ALWAYS call 'read_faust_code' before modifying.
2. EXECUTE CHANGE: ALWAYS call 'update_faust_code' to apply changes. It automatically compiles and refreshes the UI.
3. VALIDATION: If compilation fails, you MUST fix the error and call 'update_faust_code' again.

MIDI & UI RULES:
- Use 'freq', 'gate', 'gain' as labels for MIDI binding.
- EVERY control MUST be inside a 'vgroup' or 'hgroup'.
- Use '[style:knob]' for knobs and '[style:menu{...}]' for dropdowns.
- Syntax: Always 'import(\"stdfaust.lib\");' and output to 'process = ...;'`;
    }

    const { tools } = useMcp ? await this.client.listTools() : { tools: [] };
    let isRunning = true;

    const safeParseJson = (jsonStr: string) => {
      try {
        return JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Invalid JSON in tool arguments: ${jsonStr.substring(0, 100)}...`);
      }
    };

    while (isRunning) {
      if (signal?.aborted) {
        currentHistory.push({ role: 'assistant', content: "🛑 Interrupted." });
        onUpdate([...currentHistory]);
        return;
      }

      try {
        let response;
        if (this.provider !== 'anthropic') {
          const payload: any = {
            model: this.model,
            messages: currentHistory.map(msg => {
              const m: any = { role: msg.role, content: msg.content };
              if (msg.reasoning_content) m.reasoning_content = msg.reasoning_content;
              if (msg.tool_call_id) m.tool_call_id = msg.tool_call_id;
              if (msg.name) m.name = msg.name;
              if (msg.tool_calls) m.tool_calls = msg.tool_calls;
              return m;
            })
          };

          if (useMcp && tools.length > 0) {
            payload.tools = tools.map(t => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema
              }
            }));
          }

          response = await aiFetch({
            url: this.getBaseUrl(),
            method: 'POST',
            data: payload,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          const choice = response.data.choices[0].message;
          currentHistory.push(choice);
          onUpdate([...currentHistory]);

          if (useMcp && choice.tool_calls) {
            for (const toolCall of choice.tool_calls) {
              try {
                const args = safeParseJson(toolCall.function.arguments);
                // INJECT sessionId into arguments
                const result = await this.client.callTool({
                  name: toolCall.function.name,
                  arguments: { ...args, __sessionId: this.sessionId }
                });
                currentHistory.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify(result.content)
                });
              } catch (parseError: any) {
                currentHistory.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  name: toolCall.function.name,
                  content: JSON.stringify([{ type: 'text', text: `Error: ${parseError.message}. Please provide valid JSON for tool arguments.` }])
                });
              }
              onUpdate([...currentHistory]);
            }
            continue;
          }
        } else {
          const systemMsg = currentHistory.find(m => m.role === 'system')?.content || '';
          const chatMsgs = currentHistory.filter(m => m.role !== 'system').map(m => {
            if (m.role === 'tool') {
              return {
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: m.tool_call_id,
                    content: m.content
                  }
                ]
              };
            }
            if (m.tool_calls) {
              return {
                role: 'assistant',
                content: [
                  { type: 'text', text: m.content || 'Calling tool...' },
                  ...m.tool_calls.map(tc => {
                    let input = {};
                    try {
                      input = JSON.parse(tc.function.arguments);
                    } catch (e) {}
                    return {
                      type: 'tool_use',
                      id: tc.id,
                      name: tc.function.name,
                      input: input
                    };
                  })
                ]
              };
            }
            return { role: m.role, content: m.content };
          });

          const payload: any = {
            model: this.model,
            max_tokens: 4096,
            system: systemMsg,
            messages: chatMsgs
          };

          if (useMcp && tools.length > 0) {
            payload.tools = tools.map(t => ({
              name: t.name,
              description: t.description,
              input_schema: t.inputSchema
            }));
          }

          response = await aiFetch({
            url: this.getBaseUrl(),
            method: 'POST',
            data: payload,
            headers: {
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            }
          });

          const anthropicMsg = response.data;
          const content = anthropicMsg.content.find((c: any) => c.type === 'text')?.text || '';
          const toolUses = anthropicMsg.content.filter((c: any) => c.type === 'tool_use');

          const assistantMsg: ChatMessage = { role: 'assistant', content };
          if (useMcp && toolUses.length > 0) {
            assistantMsg.tool_calls = toolUses.map((tu: any) => ({
              id: tu.id,
              type: 'function',
              function: {
                name: tu.name,
                arguments: JSON.stringify(tu.input)
              }
            }));
          }

          currentHistory.push(assistantMsg);
          onUpdate([...currentHistory]);

          if (useMcp && toolUses.length > 0) {
            for (const tu of toolUses) {
              const result = await this.client.callTool({
                name: tu.name,
                arguments: { ...tu.input, __sessionId: this.sessionId }
              });
              currentHistory.push({
                role: 'tool',
                tool_call_id: tu.id,
                name: tu.name,
                content: JSON.stringify(result.content)
              });
              onUpdate([...currentHistory]);
            }
            continue;
          }
        }

        isRunning = false;
      } catch (error: any) {
        const errMsg = error.message;
        currentHistory.push({ role: 'assistant', content: `Error: ${errMsg}` });
        onUpdate([...currentHistory]);
        isRunning = false;
      }
    }
    
    this.history = [...currentHistory];
  }
}
