import { tool } from "ai";
import { z } from "zod";
import { useStore } from "../../store";
import { handleCompile } from "./utils";

export const updateFaustCode = tool({
  description: "Update the active session with new Faust DSP code and compile it.",
  inputSchema: z.object({
    code: z.string().describe("The full Faust DSP source code."),
    __sessionId: z.string().optional().describe("The session ID."),
  }),
  execute: async ({ code, __sessionId }, _context) => {
    const store = useStore.getState();
    const targetSessionId = __sessionId || store.activeSessionId;

    useStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === targetSessionId ? { ...s, code } : s
      ),
    }));

    const result = await handleCompile(targetSessionId);
    return {
      content: [{ type: "text", text: result.content[0].text }],
      details: { sessionId: targetSessionId, success: !result.isError }
    };
  },
});
