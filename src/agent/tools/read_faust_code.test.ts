import { describe, it, expect, vi } from 'vitest';
import { readFaustCode } from './read_faust_code';
import { useStore } from '../../store';

vi.mock('../../store', () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

describe('read_faust_code tool', () => {
  it('should return code from the active session if no sessionId is provided', async () => {
    const mockCode = 'process = _ : reverb;';
    (useStore.getState as any).mockReturnValue({
      activeSessionId: 'session-1',
      sessions: [
        { id: 'session-1', code: mockCode },
      ],
    });

    const result = await (readFaustCode as any).execute({ });
    expect(result.content[0]).toEqual({ type: 'text', text: mockCode });
  });

  it('should return code from a specific session if __sessionId is provided', async () => {
    const mockCode1 = 'process = _ : reverb;';
    const mockCode2 = 'process = osc(440) : gain;';
    (useStore.getState as any).mockReturnValue({
      activeSessionId: 'session-1',
      sessions: [
        { id: 'session-1', code: mockCode1 },
        { id: 'session-2', code: mockCode2 },
      ],
    });

    const result = await (readFaustCode as any).execute({ __sessionId: 'session-2' });
    expect(result.content[0]).toEqual({ type: 'text', text: mockCode2 });
  });

  it('should throw an error if the session is not found', async () => {
    (useStore.getState as any).mockReturnValue({
      activeSessionId: 'session-1',
      sessions: [],
    });

    await expect((readFaustCode as any).execute({ __sessionId: 'non-existent' }))
      .rejects.toThrow('Target session non-existent not found.');
  });
});
