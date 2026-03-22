import React, { useState, useEffect, useRef } from 'react';
import { Send, Square } from 'lucide-react';
import { UniversalAgent } from '../../agent/factory';
import { useStore } from '../../store';
import { type ChatMessage } from '../../agent/types';

const ChatPanel: React.FC = () => {
  const { provider, apiKey, model, customBaseUrl, useMcp, getActiveSession, updateActiveSession } = useStore();
  const [input, setInput] = useState('');
  
  const agentRef = useRef<UniversalAgent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Track AbortControllers per session ID to allow independent stopping
  const abortControllersMap = useRef<Record<string, AbortController>>({});

  const session = getActiveSession();
  const allMessages = session?.messages || [];
  const isLoading = session?.isAiThinking || false;
  
  // Filter for display: Only show User, Assistant (with content/reasoning), and Error tools
  const messages = allMessages.filter(m => {
    if (m.role === 'user') return true;
    if (m.role === 'assistant') return (!!m.content && m.content.trim().length > 0) || !!m.reasoning_content;
    if (m.role === 'tool') {
      const lowerContent = m.content.toLowerCase();
      return lowerContent.includes('error') || lowerContent.includes('failed');
    }
    return false;
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Re-create agent if settings, useMcp, or SESSION changes
  useEffect(() => {
    if (apiKey && (window as any).mcpClient && session) {
      agentRef.current = new UniversalAgent(provider, apiKey, model, (window as any).mcpClient, session.messages, customBaseUrl, session.type, session.id);
    }
  }, [provider, apiKey, model, customBaseUrl, useMcp, session?.id]);

  const sendMessage = async (messageText: string) => {
    if (!messageText || !apiKey || !(window as any).mcpClient || !session) return;

    // CAPTURE current session ID to ensure response goes to the right place
    const initiatingSessionId = session.id;

    if (!agentRef.current) {
      agentRef.current = new UniversalAgent(provider, apiKey, model, (window as any).mcpClient, session.messages, customBaseUrl, session.type, initiatingSessionId);
    }

    // Update thinking state for the SPECIFIC initiating session
    useStore.setState(state => ({
      sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, isAiThinking: true } : s)
    }));

    const controller = new AbortController();
    abortControllersMap.current[initiatingSessionId] = controller;

    try {
      await agentRef.current.chat(messageText, useMcp, (updatedHistory) => {
        // Always route updates back to the initiating session ID
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, messages: updatedHistory } : s)
        }));
      }, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) {
        const errorMsg: ChatMessage = { role: 'assistant', content: `Fatal Error: ${error.message}` };
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s)
        }));
      }
    } finally {
      useStore.setState(state => ({
        sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, isAiThinking: false } : s)
      }));
      delete abortControllersMap.current[initiatingSessionId];
    }
  };

  const handleStop = () => {
    if (session && abortControllersMap.current[session.id]) {
      abortControllersMap.current[session.id].abort();
      updateActiveSession({ isAiThinking: false });
    }
  };

  const handleSend = () => {
    sendMessage(input);
    setInput('');
  };

  // Helper to extract clean text from MCP JSON tool output
  const getCleanToolContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed[0]?.text) {
        return parsed[0].text;
      }
      return content;
    } catch (e) {
      return content;
    }
  };

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  const getPlaceholder = () => {
    if (!session) return "Select a session...";
    return session.type === 'poly' 
      ? 'Describe a synthesizer... (e.g. "classic Moog")' 
      : 'Describe an effect... (e.g. "stereo delay")';
  };

  const getEmptyHint = () => {
    if (!apiKey) return "Please configure your API Key in Settings first.";
    if (!session) return "Create a session to start building.";
    return session.type === 'poly'
      ? "Synth session active. Describe an instrument to begin."
      : "Effect session active. Describe a processor to begin.";
  };

  return (
    <div className="panel-container">
      <div className="panel-header" style={{ height: '32px', fontSize: '0.75rem' }}>CHAT ({providerLabel})</div>
      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
        
        <div ref={scrollRef} style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
          {messages.length === 0 && (
            <div style={{ color: '#888', fontSize: '0.75rem', textAlign: 'center', marginTop: '12px' }}>
              {getEmptyHint()}
            </div>
          )}
          {messages.map((m, i) => {
            const isTool = m.role === 'tool';
            const cleanContent = isTool ? getCleanToolContent(m.content) : m.content;
            const isError = isTool && cleanContent.toLowerCase().includes('error');
            
            return (
              <div key={i} style={{ 
                backgroundColor: m.role === 'user' ? '#3b82f633' : isError ? '#ef444411' : '#222', 
                padding: '8px 10px', 
                borderRadius: '6px', 
                marginBottom: '8px', 
                fontSize: '0.8rem',
                maxWidth: '92%',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginLeft: m.role === 'user' ? 'auto' : '0',
                whiteSpace: 'pre-wrap',
                border: isError ? '1px solid #ef444433' : m.role === 'assistant' ? '1px solid #333' : 'none',
              }}>
                <strong style={{ 
                  color: m.role === 'user' ? '#60a5fa' : m.role === 'assistant' ? '#10b981' : '#ef4444', 
                  fontSize: '0.65rem' 
                }}>
                  {isError ? 'COMPILER ERROR' : m.role.toUpperCase()}:
                </strong>
                {m.reasoning_content && (
                  <div style={{ 
                    marginTop: '4px', 
                    padding: '6px', 
                    backgroundColor: 'rgba(0,0,0,0.3)', 
                    borderRadius: '4px', 
                    fontSize: '0.75rem', 
                    color: '#777',
                    borderLeft: '2px solid #444',
                    fontStyle: 'italic'
                  }}>
                    {m.reasoning_content}
                  </div>
                )}
                {cleanContent && (
                  <div style={{ marginTop: '3px', fontSize: isTool ? '0.7rem' : '0.8rem', color: isError ? '#fca5a5' : '#ccc' }}>
                    {cleanContent}
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div style={{ fontSize: '0.7rem', color: '#666', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {providerLabel} is working...
              <button 
                onClick={handleStop}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  backgroundColor: '#ef444411',
                  border: '1px solid #ef444422',
                  color: '#ef4444',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '0.6rem',
                  cursor: 'pointer'
                }}
              >
                <Square size={8} fill="currentColor" /> STOP
              </button>
            </div>
          )}
        </div>
        
        <div style={{ padding: '12px', borderTop: '1px solid #222' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              placeholder={apiKey ? getPlaceholder() : "Enter API Key in Settings"}
              value={input}
              disabled={!apiKey || isLoading}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              style={{
                flex: 1,
                backgroundColor: '#222',
                border: '1px solid #333',
                color: 'white',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                opacity: (!apiKey || isLoading) ? 0.5 : 1,
                outline: 'none'
              }}
            />
            {isLoading ? (
              <button 
                onClick={handleStop}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px',
                  cursor: 'pointer'
                }}
              >
                <Square size={14} fill="white" />
              </button>
            ) : (
              <button 
                onClick={handleSend}
                disabled={isLoading || !apiKey}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px',
                  cursor: 'pointer',
                  opacity: (isLoading || !apiKey) ? 0.5 : 1
                }}
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
