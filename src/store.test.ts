import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';

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
          messages: [{ id: 'm1', role: 'user', content: 'Message from session 1' }],
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
          messages: [{ id: 'm2', role: 'user', content: 'Message from session 2' }],
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
    expect(store.sessions.find(s => s.id === 'session-1')?.messages[0].content).toBe('Message from session 1');

    store.switchSession('session-2');
    const stateAfterSwitch = useStore.getState();
    expect(stateAfterSwitch.activeSessionId).toBe('session-2');
    expect(stateAfterSwitch.sessions.find(s => s.id === 'session-2')?.messages[0].content).toBe('Message from session 2');

    store.switchSession('session-1');
    const stateAfterSwitchBack = useStore.getState();
    expect(stateAfterSwitchBack.activeSessionId).toBe('session-1');
    expect(stateAfterSwitchBack.sessions.find(s => s.id === 'session-1')?.messages[0].content).toBe('Message from session 1');
  });
});