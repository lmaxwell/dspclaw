import { tool } from "ai";
import { z } from "zod";
import { readVFSFile } from "../../faust/compiler";

export const readStdlibFile = tool({
  description: "Read the content of a specific standard library file.",
  inputSchema: z.object({
    name: z.string().describe("Library name (e.g., 'reverbs.lib')."),
  }),
  execute: async ({ name }, _context) => {
    const content = readVFSFile(`/usr/share/faust/${name}`);
    return {
      content: [{ type: "text", text: content || "File not found." }],
      details: { name, found: !!content }
    };
  },
});
