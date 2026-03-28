import '@testing-library/jest-dom';
import { vi, beforeAll } from 'vitest';

// Mock Web Worker (Needs to be available immediately during module evaluation)
class WorkerMock {
  url: string | URL;
  onmessage: any;
  onerror: any;
  constructor(stringUrl: string | URL) {
    this.url = stringUrl;
  }
  postMessage() {}
  terminate() {}
}
(globalThis as any).Worker = WorkerMock;

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
  (globalThis as any).AudioContext = AudioContextMock;
  (globalThis as any).webkitAudioContext = AudioContextMock;
  
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

  // Mock DOM methods not available in jsdom
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
