# Faust Web MCP IDE (DSPCLAW)

A professional, industry-level web-based IDE for Faust DSP programming, featuring an embedded AI agent powered by the Model Context Protocol (MCP).

## 🚀 Key Features
- **Cross-Platform Desktop App:** Now supports Electron for a native desktop experience.
- **Embedded MCP Server:** Runs entirely in the browser using `@modelcontextprotocol/sdk` via `InMemoryTransport`.
- **AI Agent:** Autonomously writes, compiles, and surgically modifies Faust code with context-awareness via MCP tools.
- **Industry-Level VST UI:** Photorealistic control surface with radial knobs, LED tracking rings, and hierarchical grouping.
- **Polyphonic MIDI:** Supports polyphony via MIDI controllers and computer keyboard mappings.
- **Live MIDI Visualization:** Displays active MIDI notes in real-time.
- **Adaptive Interface:** VST modules and controls intelligently scale and stack to fill the workspace.
- **Audio Input:** Reference WAV loops routable through the DSP engine with proxy-based CORS bypassing.

## 🛠 Tech Stack
- **Platform:** React + Vite + TypeScript + Electron.
- **State Management:** Zustand (Single source of truth in `src/store.ts` for code, AudioContext, and nodes).
- **DSP Engine:** `@grame/faustwasm` using `FaustPolyDspGenerator` and `FaustMonoDspGenerator`.
- **Layout:** `allotment` for resizable sidebars and panes.
- **Editor:** `@monaco-editor/react` for high-performance code editing.
- **AI Integration:** MCP (Model Context Protocol) for tool-based AI interactions.

## 📂 Architecture & Conventions
- **Global Initialization:** Managed via `src/init.ts` to prevent duplicate library instantiations.
- **Tool-Driven AI:** The agent uses the following MCP tools (defined in `src/mcp/server.ts`):
    - `read_faust_code`: Get current Faust code.
    - `update_faust_code`: Update Faust code.
    - `compile_and_run`: Compile and refresh the DSP engine/UI.
    - `list_stdlib_files`: List Faust standard library (.lib) files.
    - `read_stdlib_file`: Read content of standard library files.
- **UI Metadata:** Use Faust labels like `[style:knob]` and `[unit:Hz]` for professional rendering in the VST UI.
- **Session Management:** Supports multiple sessions (Poly/Mono) stored in the Zustand store.
- **Vite Proxy:** Audio fetches are proxied to bypass CORS restrictions.

## 🛠 Building and Running
- **Install Dependencies:** `npm install`
- **Start Development Server (Web):** `npm run dev`
- **Start Development Server (Electron):** `npm run electron:dev`
- **Build for Production (Web):** `npm run build`
- **Build for Production (Electron):** `npm run electron:build`
- **Lint Codebase:** `npm run lint`
- **Preview Production Build:** `npm run preview`

## 🧪 AI Prompting & Development
The assistant is designed to **Analyze & Plan** before writing code.
When interacting with the AI:
- Use the "Moog Synthesizer" quick-prompt for a baseline setup.
- Request specific DSP modifications like "Add a stereo phaser after the current filter".
- The AI can inspect the Faust standard library to find relevant functions and implementations.

## ⚠️ Requirements
- **API Key:** Provide your key in the in-app Settings panel (stored in `localStorage`).
- **Audio Gesture:** WebAudio requires clicking "START ENGINE" in the header to activate sound.
