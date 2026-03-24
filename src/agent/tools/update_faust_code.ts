import type { AgentTool } from "@mariozechner/pi-agent-core";
import { useStore } from "../../store";
import { handleCompile } from "./utils";

export const updateFaustCode: AgentTool = {
  name: "update_faust_code",
  label: "Update Faust Code",
  description: "Update the active session with new Faust DSP code and compile it.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "The full Faust DSP source code." },
      __sessionId: { type: "string", description: "The session ID." },
    },
    required: ["code"],
  } as any,
  execute: async (_toolCallId, { code, __sessionId }: any) => {
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
};
