import { tool } from "ai";
import { z } from "zod";
import { listVFSFiles } from "../../faust/compiler";

export const listStdlibFiles = tool({
  description: "List available Faust standard library files (.lib).",
  inputSchema: z.object({}),
  execute: async (_args, _context) => {
    const files = listVFSFiles("/usr/share/faust");
    const libs = files.filter((f) => f.endsWith(".lib")).join(", ");
    return {
      content: [{ type: "text", text: libs }],
      details: { count: files.length }
    };
  },
});
