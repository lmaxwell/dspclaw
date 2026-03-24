import type { AgentTool } from "@mariozechner/pi-agent-core";
import { useStore } from "../../store";
import { handleCompile } from "./utils";

export const compileAndRun: AgentTool = {
  name: "compile_and_run",
  label: "Compile and Run",
  description: "Compile the active session's code and update the VST UI.",
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

    const result = await handleCompile(targetSessionId);
    return {
      content: [{ type: "text", text: result.content[0].text }],
      details: { sessionId: targetSessionId, success: !result.isError }
    };
  },
};
