import { tool } from "ai";
import { z } from "zod";
import { useStore } from "../../store";

export const readFaustCode = tool({
  description: "Get the current Faust DSP code from the active session.",
  inputSchema: z.object({
    __sessionId: z.string().optional().describe("The session ID."),
  }),
  execute: async ({ __sessionId }: { __sessionId?: string }, _context) => {
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
});
