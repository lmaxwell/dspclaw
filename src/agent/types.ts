import type { AgentMessage } from "@mariozechner/pi-agent-core";

export type ChatMessage = AgentMessage | { role: 'system'; content: string };
