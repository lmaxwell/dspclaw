import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { aiFetch, getApiUrl } from './utils/env';
import { getOrCreateAgent } from './agent/factory';
import { useStore } from './store';

// Access API Key from environment
// @ts-ignore
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : '');

// Mock axios
vi.mock('axios', () => ({
  default: vi.fn()
}));

describe('AI API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset store state
    useStore.setState({
      sessions: [
        {
          id: 'test-session',
          name: 'Test Session',
          type: 'mono',
          code: '',
          uiLayout: [],
          dspNode: null,
          audioInputUrl: '',
          audioInputVolume: 1,
          midiInputId: 'all',
          isCompiling: false,
          compileError: null,
          messages: [],
          isAiThinking: false,
          model: 'gemini-2.0-flash',
          models: [],
        }
      ],
      activeSessionId: 'test-session',
      provider: 'gemini',
      apiKeys: { gemini: GEMINI_KEY || 'mock-key' },
    });
  });

  describe('URL Resolution (getApiUrl)', () => {
    it('maps all configured providers to correct absolute URLs when isElectron is true', () => {
      const testCases = [
        { path: '/api/openai/models', expected: 'https://api.openai.com/v1/models' },
        { path: '/api/moonshot/models', expected: 'https://api.moonshot.cn/v1/models' },
        { path: '/api/deepseek/models', expected: 'https://api.deepseek.com/models' },
        { path: '/api/glm/models', expected: 'https://open.bigmodel.cn/api/paas/v4/models' },
        { path: '/api/gemini/models', expected: 'https://generativelanguage.googleapis.com/v1beta/models' },
      ];

      testCases.forEach(({ path, expected }) => {
        expect(getApiUrl(path, true)).toBe(expected);
      });
    });

    it('returns original path when isElectron is false', () => {
      expect(getApiUrl('/api/openai/models', false)).toBe('/api/openai/models');
    });
  });

  describe('aiFetch logic', () => {
    it('uses direct axios for absolute URLs even in Electron mode', async () => {
      const mockData = { test: true };
      vi.mocked(axios).mockResolvedValueOnce({ data: mockData });
      
      const response = await aiFetch({ url: 'https://external.com/api', method: 'GET' }, true);
      
      expect(axios).toHaveBeenCalled();
      expect(response.data).toEqual(mockData);
    });

    it('uses IPC proxy for relative paths in Electron mode', async () => {
      const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true } });
      (window as any).ipcRenderer = { invoke: mockInvoke };

      await aiFetch({ url: '/api/deepseek/models', method: 'GET' }, true);

      expect(mockInvoke).toHaveBeenCalledWith('ai-request', expect.objectContaining({
        url: 'https://api.deepseek.com/models'
      }));
    });

    it('uses direct axios for relative paths in Web mode', async () => {
      const mockData = { test: true };
      vi.mocked(axios).mockResolvedValueOnce({ data: mockData });
      
      const response = await aiFetch({ url: '/api/moonshot/models', method: 'GET' }, false);
      
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({ url: '/api/moonshot/models' }));
      expect(response.data).toEqual(mockData);
    });
  });

  describe('Agent Factory', () => {
    it('creates an agent instance', () => {
      const agent = getOrCreateAgent('test-session');
      expect(agent).toBeDefined();
      expect(typeof agent).toBe('object');
    });
  });

  // Real network tests (only if GEMINI_KEY is provided)
  if (GEMINI_KEY && GEMINI_KEY !== 'mock-key') {
    describe('Real Network Integration', () => {
      it('successfully connects to Gemini API', async () => {
        try {
          const realAxios = (await vi.importActual('axios') as any).default;
          vi.mocked(axios).mockImplementationOnce(realAxios);
          
          const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`;
          const response = await aiFetch({ url, method: 'GET' }, false);
          
          expect(response.data.models).toBeDefined();
        } catch (e: any) {
          if (e.message.includes('Network Error') || e.message.includes('403') || e.message.includes('401')) {
            console.warn('Network or Auth error during integration test - likely restricted environment');
            return;
          }
          throw e;
        }
      }, 20000);
    });
  } else {
    describe('Real Network Integration (Skipped)', () => {
      it('skips real network calls as no API key was found', () => {
        console.log('Skipping real network tests: No VITE_GEMINI_API_KEY found in environment');
      });
    });
  }
});
