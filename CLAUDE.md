# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DSPCLAW is an AI-powered Faust DSP IDE that allows users to describe audio synthesizers and effects in natural language. An embedded AI agent autonomously writes, compiles, and renders VST-style UIs in the browser or desktop.

## Development Commands

```bash
# Web development
npm run dev              # Start Vite dev server (port 5174)

# Electron development
npm run electron:dev     # Start Electron app in dev mode

# Building
npm run build            # Web production build
npm run electron:build   # Build for current platform
npm run electron:build:mac   # macOS build
npm run electron:build:win   # Windows build

# Testing & Linting
npm run lint             # Run ESLint
npm run test             # Run Vitest tests
```

## Platform-Specific Requirements

### Windows Builds

Building the Electron app on Windows requires **Developer Mode** to be enabled:

1. Settings → System → For developers → Enable "Developer Mode"
2. This allows electron-builder to create symbolic links during code signing tool extraction

If you see symlink errors, clear the cache and retry:
```bash
rm -rf ~/AppData/Local/electron-builder/Cache
npm run electron:build:win
```

## Architecture

### State Management (Zustand)

`src/store.ts` is the central state store with:
- **Sessions**: Multiple DSP sessions (poly/mono), each with its own Faust code, compiled DSP node, chat messages, and model selection
- **Settings**: API keys per provider, custom providers, base URLs
- **MIDI**: Device list and last played note

### AI Agent (Vercel AI SDK)

The agent system uses the `ToolLoopAgent` pattern from the Vercel AI SDK:

- `src/agent/factory.ts`: Creates and caches agents per session+provider+model combination
- `src/agent/tools/`: Five tools the agent can use:
  - `readFaustCode`: Get current session code
  - `updateFaustCode`: Write new code
  - `compileAndRun`: Compile and activate DSP
  - `listStdlibFiles` / `readStdlibFile`: Explore Faust standard library

The agent is configured with a specialized system prompt for Faust DSP engineering.

### Faust DSP Engine

- `src/faust/compiler.ts`: Initializes the Faust WASM compiler and orchestrates Web Worker compilation
- `src/faust/worker.ts`: Heavy compilation runs in a Web Worker to avoid blocking the UI
- Supports polyphonic (synth) and monophonic (effect) DSP types

### Initialization Flow

`src/init.ts` orchestrates startup:
1. Initialize Faust WASM engine
2. Initialize MIDI system
3. Auto-compile all initial sessions

### Component Structure

- `ChatPanel`: AI chat interface using `useChat` hook with `DirectChatTransport`
- `EditorPanel`: Monaco editor for Faust code
- `FaustUIPanel`: Renders VST-style UI from compiled DSP metadata
- `SessionPanel`: Session management sidebar

## Key Patterns

### Session-Scoped Tools

Agent tools receive `__sessionId` to operate on the correct session. Tools access the Zustand store directly via `useStore.getState()`.

### Agent Caching

Agents are cached by `sessionId-provider-model` key. Changing provider or model creates a new agent instance. Use `clearAgentCache()` from `agent-cache.ts` when settings change.

### API Key Security

In Electron, API keys are encrypted via `safe-storage:encrypt/decrypt` IPC. The store handles both web (localStorage) and Electron (secure storage) modes.

## Supported AI Providers

- Gemini (`@ai-sdk/google`)
- Moonshot (`@ai-sdk/moonshotai`)
- DeepSeek (OpenAI-compatible)
- GLM (OpenAI-compatible)
- Custom OpenAI-compatible providers

## Faust Code Conventions

The default synth and effect templates in `store.ts` demonstrate expected Faust patterns:
- Use `nentry` for MIDI-controlled parameters (freq, gate, gain)
- Use `hslider` with `[style:knob][scale:log]` for UI controls
- Stereo output: `process = synth <: _, _;`
