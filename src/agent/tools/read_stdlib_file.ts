import type { AgentTool } from "@mariozechner/pi-agent-core";
import { readVFSFile } from "../../faust/compiler";

export const readStdlibFile: AgentTool = {
  name: "read_stdlib_file",
  label: "Read Stdlib File",
  description: "Read the content of a specific standard library file.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "Library name (e.g., 'reverbs.lib')." },
    },
    required: ["name"],
  } as any,
  execute: async (_toolCallId, { name }: any) => {
    const content = readVFSFile(`/usr/share/faust/${name}`);
    return {
      content: [{ type: "text", text: content || "File not found." }],
      details: { name, found: !!content }
    };
  },
};
