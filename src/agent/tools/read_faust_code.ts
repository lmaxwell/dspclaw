import type { AgentTool } from "@mariozechner/pi-agent-core";
import { useStore } from "../../store";

export const readFaustCode: AgentTool = {
  name: "read_faust_code",
  label: "Read Faust Code",
  description: "Get the current Faust DSP code from the active session.",
  parameters: {
    type: "object",
    properties: {
      __sessionId: { type: "string", description: "The session ID." },
    },
  } as any,
  execute: async (_toolCallId, { __sessionId }: any) => {
    const store = useStore.getState();
    const targetSessionId = __sessionId || store.activeSessionId;
    const targetSession = store.sessions.find((s) => s.id === targetSessionId);

    if (!targetSession) {
      throw new Error(`Target session ${targetSessionId} not found.`);
    }

    return {
      content: [{ type: "text", text: targetSession.code }],
      details: { sessionId: targetSessionId }
    };
  },
};
