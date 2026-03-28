import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from './ChatPanel';
import * as aiReact from '@ai-sdk/react';

// Mock useStore
const { mockUseStore } = vi.hoisted(() => {
  const store = vi.fn() as any;
  store.getState = vi.fn();
  return { mockUseStore: store };
});

vi.mock('../../store', () => ({
  useStore: mockUseStore,
}));

// Mock @ai-sdk/react useChat
vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

describe('ChatPanel Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls stop() when stop button is clicked while AI is thinking', () => {
    const mockState = {
      sessions: [{ id: 's1', messages: [], model: 'kimi-2.5', models: [] }], 
      activeSessionId: 's1', 
      apiKeys: { moonshot: 'fake-key' },
      provider: 'moonshot',
      customProviders: [],
      updateSession: vi.fn()
    };
    
    // Default mock implementation
    mockUseStore.mockImplementation((selector: any) => {
      if (selector) return selector(mockState);
      return mockState;
    });
    mockUseStore.getState.mockReturnValue(mockState);

    const mockStop = vi.fn();

    // Mock useChat to simulate streaming status
    (aiReact.useChat as any).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      stop: mockStop,
      status: 'streaming',
      setMessages: vi.fn(),
    });

    render(<ChatPanel sessionId="s1" />);

    // The STOP button should be rendered and enabled
    const stopButton = screen.getByRole('button', { name: /stop/i });
    expect(stopButton).toBeInTheDocument();
    expect(stopButton).not.toBeDisabled();

    // Click STOP
    fireEvent.click(stopButton);

    // Verify stop() was called
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('hydrates messages correctly when session switches', () => {
    const mockSetMessages = vi.fn();
    (aiReact.useChat as any).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      stop: vi.fn(),
      status: 'idle',
      setMessages: mockSetMessages,
    });

    const s1 = { id: 's1', messages: [{ id: '1', role: 'user', content: 's1 msg' }], model: 'm1', models: [] };
    const s2 = { id: 's2', messages: [{ id: '2', role: 'user', content: 's2 msg' }], model: 'm1', models: [] };
    
    let mockState = { 
      sessions: [s1, s2], 
      activeSessionId: 's1', 
      apiKeys: { moonshot: 'key' },
      provider: 'moonshot',
      customProviders: [],
      updateSession: vi.fn()
    };

    // Simulate active session s1
    mockUseStore.mockImplementation((selector: any) => {
      if (selector) return selector(mockState);
      return mockState;
    });
    mockUseStore.getState.mockImplementation(() => mockState);

    const { rerender } = render(<ChatPanel sessionId="s1" />);
    // With individual panels, initial messages handle hydration, but our useEffect also fires if messages is empty
    expect(mockSetMessages).toHaveBeenCalledWith([{ id: '1', role: 'user', content: 's1 msg' }]);
    
    // Rerender for session s2
    mockSetMessages.mockClear();
    rerender(<ChatPanel sessionId="s2" />);
    expect(mockSetMessages).toHaveBeenCalledWith([{ id: '2', role: 'user', content: 's2 msg' }]);
  });
});