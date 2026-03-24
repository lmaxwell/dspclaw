import '@testing-library/jest-dom';
import { vi, beforeAll } from 'vitest';

// Mock Web Audio API
class AudioContextMock {
  createOscillator() { return {}; }
  createGain() { return {}; }
  decodeAudioData() { return Promise.resolve({}); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  destination = {};
}

// Mock Global Objects
beforeAll(() => {
  (global as any).AudioContext = AudioContextMock;
  (global as any).webkitAudioContext = AudioContextMock;
  
  // Mock window properties
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
