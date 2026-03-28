import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { UIMessage } from 'ai';

// Helper to create a simple text message
function createTextMessage(id: string, role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }]
  } as UIMessage;
}

describe('useStore Session Management', () => {
  beforeEach(() => {
    useStore.setState({
      sessions: [
        {
          id: 'session-1',
          name: 'Session 1',
          type: 'poly',
          code: '',
          uiLayout: [],
          dspNode: null,
          audioInputUrl: '',
          audioInputVolume: 1,
          midiInputId: 'all',
          isCompiling: false,
          compileError: null,
          messages: [createTextMessage('m1', 'user', 'Message from session 1')],
          isAiThinking: false,
          model: 'model-1',
          models: []
        },
        {
          id: 'session-2',
          name: 'Session 2',
          type: 'mono',
          code: '',
          uiLayout: [],
          dspNode: null,
          audioInputUrl: '',
          audioInputVolume: 1,
          midiInputId: 'all',
          isCompiling: false,
          compileError: null,
          messages: [createTextMessage('m2', 'user', 'Message from session 2')],
          isAiThinking: false,
          model: 'model-1',
          models: []
        }
      ],
      activeSessionId: 'session-1',
    });
  });

  it('persists and retrieves messages correctly when switching sessions', () => {
    const store = useStore.getState();
    expect(store.activeSessionId).toBe('session-1');

    // Get text from the first message's parts
    const session1Msg = store.sessions.find(s => s.id === 'session-1')?.messages[0];
    const session1Text = session1Msg?.parts.find(p => p.type === 'text')?.text;
    expect(session1Text).toBe('Message from session 1');

    store.switchSession('session-2');
    const stateAfterSwitch = useStore.getState();
    expect(stateAfterSwitch.activeSessionId).toBe('session-2');

    const session2Msg = stateAfterSwitch.sessions.find(s => s.id === 'session-2')?.messages[0];
    const session2Text = session2Msg?.parts.find(p => p.type === 'text')?.text;
    expect(session2Text).toBe('Message from session 2');

    store.switchSession('session-1');
    const stateAfterSwitchBack = useStore.getState();
    expect(stateAfterSwitchBack.activeSessionId).toBe('session-1');

    const session1MsgAgain = stateAfterSwitchBack.sessions.find(s => s.id === 'session-1')?.messages[0];
    const session1TextAgain = session1MsgAgain?.parts.find(p => p.type === 'text')?.text;
    expect(session1TextAgain).toBe('Message from session 1');
  });
});
