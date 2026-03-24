import type { AgentTool } from "@mariozechner/pi-agent-core";
import { listVFSFiles } from "../../faust/compiler";

export const listStdlibFiles: AgentTool = {
  name: "list_stdlib_files",
  label: "List Stdlib Files",
  description: "List available Faust standard library files (.lib).",
  parameters: {
    type: "object",
    properties: {},
  } as any,
  execute: async () => {
    const files = listVFSFiles("/usr/share/faust");
    const libs = files.filter((f) => f.endsWith(".lib")).join(", ");
    return {
      content: [{ type: "text", text: libs }],
      details: { count: files.length }
    };
  },
};
