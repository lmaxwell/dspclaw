import { useStore } from "../../store";
import { compileDSP } from "../../faust/compiler";

export const handleCompile = async (targetId: string) => {
  try {
    useStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === targetId ? { ...s, isCompiling: true } : s
      ),
    }));

    const store = useStore.getState();
    const audioCtx = store.getAudioCtx();
    const current = store.sessions.find((s) => s.id === targetId);

    if (!current) throw new Error("Session not found during compilation.");

    // 1. Compile first WITHOUT destroying the current node
    const { node, ui } = await compileDSP(current.code, audioCtx, current.type);

    // 2. ONLY if compilation succeeds, we disconnect and destroy the old node
    if (current.dspNode) {
      current.dspNode.disconnect();
      current.dspNode.destroy();
    }

    useStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === targetId
          ? {
              ...s,
              uiLayout: ui,
              dspNode: node,
              isCompiling: false,
              compileError: null,
            }
          : s
      ),
    }));

    // 3. Connect the new node if global audio is running AND it's still the active session
    if (
      useStore.getState().isAudioRunning &&
      useStore.getState().activeSessionId === targetId &&
      node
    ) {
      node.connect(audioCtx.destination);
    }

    return {
      content: [{ type: "text", text: `Update and Compilation successful.` }],
    };
  } catch (error: any) {
    // 4. If compilation fails, the old dspNode remains running and connected
    useStore.setState((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === targetId
          ? { ...s, isCompiling: false, compileError: error.message }
          : s
      ),
    }));
    return {
      isError: true,
      content: [
        { type: "text", text: `Error during compilation: ${error.message}` },
      ],
    };
  }
};
