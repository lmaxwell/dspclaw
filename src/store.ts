import { create } from 'zustand';
import type { FaustAudioWorkletNode, FaustScriptProcessorNode } from '@grame/faustwasm';
import { type ChatMessage } from './agent/types';

export type AIProvider = 'openai' | 'anthropic' | 'moonshot' | 'custom';
export type SessionType = 'poly' | 'mono';

export interface Session {
  id: string;
  name: string;
  type: SessionType;
  code: string;
  uiLayout: any[];
  dspNode: FaustAudioWorkletNode | FaustScriptProcessorNode | null;
  audioInputUrl: string;
  audioInputVolume: number;
  midiInputId: string;
  isCompiling: boolean;
  compileError: string | null;
  messages: ChatMessage[];
  isAiThinking: boolean;
}

interface AppState {
  sessions: Session[];
  activeSessionId: string;
  isAudioRunning: boolean;
  isInitialized: boolean;
  
  // Settings (Global)
  provider: AIProvider;
  apiKeys: Record<AIProvider, string>;
  apiKey: string; 
  model: string;
  customBaseUrl: string;
  models: string[];
  useMcp: boolean;
  setSettings: (settings: { provider?: AIProvider, apiKey?: string, model?: string, customBaseUrl?: string, models?: string[] }) => void | Promise<void>;
  setUseMcp: (use: boolean) => void;

  // MIDI Global State
  midiDevices: { id: string, name: string }[];
  setMidiDevices: (devices: { id: string, name: string }[]) => void;
  lastMidiNote: number | null;
  setLastMidiNote: (note: number | null) => void;

  // Session Actions
  addSession: (name: string, type: SessionType) => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  updateActiveSession: (updates: Partial<Session>) => void;
  getActiveSession: () => Session | undefined;

  // Global Actions
  setAudioRunning: (running: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  getAudioCtx: () => AudioContext;
}

let globalAudioCtx: AudioContext | null = null;

const isElectron = !!(window as any).ipcRenderer;

const DEFAULT_SYNTH_CODE = `import("stdfaust.lib");
process = os.sawtooth(hslider("freq", 440, 20, 2000, 0.01)) 
          * hslider("gain", 0.3, 0, 1, 0.01) 
          * button("gate") 
          : _ <: _,_;`;

const DEFAULT_EFFECT_CODE = `import("stdfaust.lib");
process = _ : fi.lowpass(2, hslider("cutoff", 2000, 20, 10000, 1)) <: _,_;`;

export const useStore = create<AppState>((set, get) => {
  const initialProvider = (localStorage.getItem('faust_provider') as AIProvider) || 'moonshot';
  const initialKeys: Record<AIProvider, string> = {
    openai: localStorage.getItem('faust_api_key_openai') || '',
    anthropic: localStorage.getItem('faust_api_key_anthropic') || '',
    moonshot: localStorage.getItem('faust_api_key_moonshot') || '',
    custom: localStorage.getItem('faust_api_key_custom') || '',
  };

  // If in Electron, asynchronously decrypt any secure keys and override
  if (isElectron) {
    (async () => {
      const providers: AIProvider[] = ['openai', 'anthropic', 'moonshot', 'custom'];
      const secureKeys = { ...initialKeys };
      let changed = false;
      for (const p of providers) {
        const encrypted = localStorage.getItem(`faust_api_key_secure_${p}`);
        if (encrypted) {
          const decrypted = await (window as any).ipcRenderer.invoke('safe-storage:decrypt', encrypted);
          if (decrypted) {
            secureKeys[p] = decrypted;
            changed = true;
          }
        }
      }
      if (changed) {
        set((state) => ({ apiKeys: secureKeys, apiKey: secureKeys[state.provider] }));
      }
    })();
  }

  const initialSession: Session = {
    id: 'default-synth',
    name: 'CLAW Synth',
    type: 'poly',
    code: DEFAULT_SYNTH_CODE,
    uiLayout: [],
    dspNode: null,
    audioInputUrl: './audio/stay-a-while.mp3',
    audioInputVolume: 0.5,
    midiInputId: 'all',
    isCompiling: false,
    compileError: null,
    messages: [],
    isAiThinking: false
  };

  return {
    sessions: [initialSession],
    activeSessionId: 'default-synth',
    isAudioRunning: false,
    isInitialized: false,
    midiDevices: [],
    lastMidiNote: null,

    // Settings
    provider: initialProvider,
    apiKeys: initialKeys,
    apiKey: initialKeys[initialProvider],
    model: localStorage.getItem(`faust_model_${initialProvider}`) || (initialProvider === 'moonshot' ? 'moonshot-v1-8k' : ''),
    customBaseUrl: localStorage.getItem('faust_custom_base_url') || '',
    models: [],
    useMcp: localStorage.getItem('faust_use_mcp') !== 'false',

    addSession: (name, type) => {
      const id = Math.random().toString(36).substring(7);
      const newSession: Session = {
        id,
        name,
        type,
        code: type === 'poly' ? DEFAULT_SYNTH_CODE : DEFAULT_EFFECT_CODE,
        uiLayout: [],
        dspNode: null,
        audioInputUrl: './audio/stay-a-while.mp3',
        audioInputVolume: 0.5,
        midiInputId: 'all',
        isCompiling: false,
        compileError: null,
        messages: [],
        isAiThinking: false
      };
      set((state) => ({ sessions: [...state.sessions, newSession], activeSessionId: id }));
    },

    switchSession: (id) => {
      const state = get();
      const currentSession = state.getActiveSession();
      const nextSession = state.sessions.find(s => s.id === id);
      
      if (currentSession?.dspNode) {
        currentSession.dspNode.disconnect();
      }
      
      if (nextSession?.dspNode && state.isAudioRunning) {
        nextSession.dspNode.connect(state.getAudioCtx().destination);
      }
      
      set({ activeSessionId: id });
    },

    deleteSession: (id) => {
      set((state) => {
        const session = state.sessions.find(s => s.id === id);
        if (session?.dspNode) {
          session.dspNode.disconnect();
          session.dspNode.destroy();
        }
        const newSessions = state.sessions.filter(s => s.id !== id);
        let nextId = state.activeSessionId;
        if (id === state.activeSessionId) {
          nextId = newSessions.length > 0 ? newSessions[0].id : '';
        }
        return { sessions: newSessions, activeSessionId: nextId };
      });
    },

    renameSession: (id, name) => {
      set((state) => ({
        sessions: state.sessions.map((s) => s.id === id ? { ...s, name } : s)
      }));
    },

    updateActiveSession: (updates) => {
      set((state) => ({
        sessions: state.sessions.map((s) => 
          s.id === state.activeSessionId ? { ...s, ...updates } : s
        )
      }));
    },

    getActiveSession: () => {
      const state = get();
      return state.sessions.find(s => s.id === state.activeSessionId);
    },

    setSettings: async (settings) => {
      const current = get();
      let newProvider = settings.provider || current.provider;
      let newApiKeys = { ...current.apiKeys };
      
      if (settings.apiKey !== undefined) {
        newApiKeys[newProvider] = settings.apiKey;
        if (isElectron) {
          const encrypted = await (window as any).ipcRenderer.invoke('safe-storage:encrypt', settings.apiKey);
          localStorage.setItem(`faust_api_key_secure_${newProvider}`, encrypted);
          localStorage.removeItem(`faust_api_key_${newProvider}`);
        } else {
          localStorage.setItem(`faust_api_key_${newProvider}`, settings.apiKey);
        }
      }

      let newApiKey = newApiKeys[newProvider];
      let newModel = settings.model !== undefined ? settings.model : current.model;
      let newCustomBaseUrl = settings.customBaseUrl !== undefined ? settings.customBaseUrl : current.customBaseUrl;
      let newModels = settings.models || current.models;

      if (newCustomBaseUrl !== current.customBaseUrl) {
        localStorage.setItem('faust_custom_base_url', newCustomBaseUrl);
      }

      if (settings.provider && settings.provider !== current.provider) {
        newApiKey = newApiKeys[newProvider];
        newModel = localStorage.getItem(`faust_model_${newProvider}`) || '';
        newModels = [];
        if (!newModel && newApiKey) {
          switch(newProvider) {
            case 'moonshot': newModel = 'moonshot-v1-8k'; break;
            case 'openai': newModel = 'gpt-4o'; break;
            case 'anthropic': newModel = 'claude-3-5-sonnet-latest'; break;
          }
        }
      }

      if (!newApiKey) newModel = '';

      localStorage.setItem('faust_provider', newProvider);
      if (newModel) {
        localStorage.setItem(`faust_model_${newProvider}`, newModel);
      } else {
        localStorage.removeItem(`faust_model_${newProvider}`);
      }

      set({ 
        provider: newProvider, 
        apiKeys: newApiKeys, 
        apiKey: newApiKey, 
        model: newModel, 
        customBaseUrl: newCustomBaseUrl,
        models: newModels 
      });
    },

    setUseMcp: (use) => {
      localStorage.setItem('faust_use_mcp', use ? 'true' : 'false');
      set({ useMcp: use });
    },

    setAudioRunning: (running) => set({ isAudioRunning: running }),
    setInitialized: (initialized) => set({ isInitialized: initialized }),
    setMidiDevices: (midiDevices) => set({ midiDevices }),
    setLastMidiNote: (lastMidiNote) => set({ lastMidiNote }),
    getAudioCtx: () => {
      if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return globalAudioCtx;
    }
  };
});
