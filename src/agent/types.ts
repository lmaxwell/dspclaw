export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning_content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
}
