import { tool } from "ai";
import { z } from "zod";
import { useStore } from "../../store";
import { handleCompile } from "./utils";

export const compileAndRun = tool({
  description: "Compile the active session's code and update the VST UI.",
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

    const result = await handleCompile(targetSessionId);
    return {
      content: [{ type: "text", text: result.content[0].text }],
      details: { sessionId: targetSessionId, success: !result.isError }
    };
  },
});
