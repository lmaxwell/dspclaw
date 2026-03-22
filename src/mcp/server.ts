import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { serverTransport } from "./transport";
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { useStore } from "../store";
import { compileDSP, readVFSFile, listVFSFiles } from "../faust/compiler";

export const initMCPServer = () => {
  const server = new Server(
    {
      name: "faust-web-ide",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "read_faust_code",
        description: "Get the current Faust DSP code from the active session.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "update_faust_code",
        description: "Update the active session with new Faust DSP code.",
        inputSchema: {
          type: "object",
          properties: {
            code: { type: "string", description: "The full Faust DSP source code." },
          },
          required: ["code"],
        },
      },
      {
        name: "compile_and_run",
        description: "Compile the active session's code and update the VST UI.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "list_stdlib_files",
        description: "List available Faust standard library files (.lib).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "read_stdlib_file",
        description: "Read the content of a specific standard library file.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Library name (e.g., 'reverbs.lib')." },
          },
          required: ["name"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const store = useStore.getState();
    
    // PRIORITY: Use the __sessionId injected by the agent if available.
    // This is the ONLY way to guarantee that track-switches during AI "thinking"
    // don't cause the AI to write into the new track.
    const targetSessionId = (args as any)?.__sessionId || store.activeSessionId;
    
    const getTargetSession = () => useStore.getState().sessions.find(s => s.id === targetSessionId);
    const targetSession = getTargetSession();

    if (!targetSession && ["read_faust_code", "update_faust_code", "compile_and_run"].includes(name)) {
      throw new Error(`Target session ${targetSessionId} not found.`);
    }

    switch (name) {
      case "read_faust_code":
        return { content: [{ type: "text", text: targetSession!.code }] };

      case "update_faust_code":
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === targetSessionId ? { ...s, code: (args as any).code } : s)
        }));
        return { content: [{ type: "text", text: "Session updated." }] };

      case "compile_and_run":
        try {
          useStore.setState(state => ({
            sessions: state.sessions.map(s => s.id === targetSessionId ? { ...s, isCompiling: true } : s)
          }));
          
          const audioCtx = store.getAudioCtx();
          const current = getTargetSession();
          
          if (current?.dspNode) {
            current.dspNode.disconnect();
            current.dspNode.destroy();
          }
          
          const { node, ui } = await compileDSP(current!.code, audioCtx, current!.type);
          
          useStore.setState(state => ({
            sessions: state.sessions.map(s => s.id === targetSessionId ? { 
              ...s, 
              uiLayout: ui,
              dspNode: node,
              isCompiling: false,
              compileError: null 
            } : s)
          }));

          // Connect if global audio is running AND it's still the active session
          if (useStore.getState().isAudioRunning && useStore.getState().activeSessionId === targetSessionId && node) {
            node.connect(audioCtx.destination);
          }

          return { content: [{ type: "text", text: `Compilation successful.` }] };
        } catch (error: any) {
          useStore.setState(state => ({
            sessions: state.sessions.map(s => s.id === targetSessionId ? { ...s, isCompiling: false, compileError: error.message } : s)
          }));
          return { isError: true, content: [{ type: "text", text: `Error: ${error.message}` }] };
        }

      case "list_stdlib_files":
        const files = listVFSFiles("/usr/share/faust");
        return { content: [{ type: "text", text: files.filter(f => f.endsWith(".lib")).join(", ") }] };

      case "read_stdlib_file":
        const content = readVFSFile(`/usr/share/faust/${(args as any).name}`);
        return { content: [{ type: "text", text: content || "File not found." }] };

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  });

  server.connect(serverTransport).catch(console.error);
  return server;
};
