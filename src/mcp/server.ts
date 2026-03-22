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

    const handleCompile = async (targetId: string) => {
      try {
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === targetId ? { ...s, isCompiling: true } : s)
        }));
        
        const store = useStore.getState();
        const audioCtx = store.getAudioCtx();
        const current = store.sessions.find(s => s.id === targetId);
        
        if (!current) throw new Error("Session not found during compilation.");

        // 1. Compile first WITHOUT destroying the current node
        const { node, ui } = await compileDSP(current.code, audioCtx, current.type);
        
        // 2. ONLY if compilation succeeds, we disconnect and destroy the old node
        if (current.dspNode) {
          current.dspNode.disconnect();
          current.dspNode.destroy();
        }
        
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === targetId ? { 
            ...s, 
            uiLayout: ui,
            dspNode: node,
            isCompiling: false,
            compileError: null 
          } : s)
        }));

        // 3. Connect the new node if global audio is running AND it's still the active session
        if (useStore.getState().isAudioRunning && useStore.getState().activeSessionId === targetId && node) {
          node.connect(audioCtx.destination);
        }

        return { content: [{ type: "text", text: `Update and Compilation successful.` }] };
      } catch (error: any) {
        // 4. If compilation fails, the old dspNode remains running and connected
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === targetId ? { ...s, isCompiling: false, compileError: error.message } : s)
        }));
        return { isError: true, content: [{ type: "text", text: `Error during compilation: ${error.message}` }] };
      }
    };

    switch (name) {
      case "read_faust_code":
        return { content: [{ type: "text", text: targetSession!.code }] };

      case "update_faust_code":
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === targetSessionId ? { ...s, code: (args as any).code } : s)
        }));
        return handleCompile(targetSessionId);

      case "compile_and_run":
        return handleCompile(targetSessionId);

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
