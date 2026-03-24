import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Square, User, Bot, Loader2, Sparkles, Terminal, Copy, Check, ChevronDown, ChevronRight, BrainCircuit } from 'lucide-react';
import { useStore } from '../../store';
import { runAgentLoop } from '../../agent/factory';

const renderContent = (content: any) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c: any) => {
      if (c.type === 'text') return c.text;
      if (c.type === 'toolCall') return `\n\n> 🔧 **Calling tool:** \`${c.name}\`...\n\n`;
      return '';
    }).join('');
  }
  return '';
};

/**
 * Renders a collapsible reasoning/thought block with minimal overhead.
 */
const ThoughtBlock = ({ content }: { content: string }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  
  // Clean up the tags for display
  const cleanContent = content
    .replace('<think>', '')
    .replace('</think>', '')
    .trim();

  if (!cleanContent) return null;

  return (
    <div style={{ 
      margin: '12px 0', 
      borderLeft: '2px solid var(--accent)', 
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderRadius: '0 8px 8px 0',
      overflow: 'hidden'
    }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          fontSize: '0.65rem',
          fontWeight: 800,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          textAlign: 'left'
        }}
      >
        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <BrainCircuit size={12} color="var(--accent)" />
        Reasoning Process
      </button>
      {isOpen && (
        <div style={{ 
          padding: '0 12px 12px 12px', 
          fontSize: '0.75rem', 
          color: 'var(--text-dim)', 
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          fontStyle: 'italic',
          opacity: 0.8
        }}>
          {cleanContent}
        </div>
      )}
    </div>
  );
};

/**
 * Memoized Markdown segment to prevent re-parsing stable parts of the conversation.
 */
const MemoizedMarkdown = React.memo(({ content, isStreaming, messageIdx, segmentIdx }: { 
  content: string, 
  isStreaming: boolean, 
  messageIdx: number, 
  segmentIdx: number 
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeText = String(children).replace(/\n$/, '');
          const codeId = `code-${messageIdx}-${segmentIdx}-${Math.random().toString(36).substr(2, 5)}`;
          
          if (inline || !match) {
            return (
              <code style={{ backgroundColor: 'var(--bg-input)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid var(--border-main)' }} {...props}>
                {children}
              </code>
            );
          }

          // DEFERRED SYNTAX HIGHLIGHTING: 
          // If this specific segment is still part of an active stream, 
          // use a lightweight pre block.
          return (
            <div style={{ marginTop: '16px', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-main)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              <div style={{ backgroundColor: 'var(--bg-header)', padding: '8px 16px', borderBottom: '1px solid var(--border-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={12} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '0.05em' }}>{match[1].toUpperCase()}</span>
                </div>
                <button 
                  onClick={() => copyToClipboard(codeText, codeId)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
                  className="icon-hover"
                >
                  {copiedId === codeId ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>
              
              {isStreaming ? (
                <pre style={{ margin: 0, padding: '16px', background: '#0d0d0f', fontSize: '0.8rem', lineHeight: '1.5', overflowX: 'auto', color: '#ccc' }}>
                  <code>{codeText}</code>
                </pre>
              ) : (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, padding: '16px', background: '#0d0d0f', fontSize: '0.8rem', lineHeight: '1.5' }}
                  {...props}
                >
                  {codeText}
                </SyntaxHighlighter>
              )}
            </div>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

// Memoized message component to orchestrate chunked rendering
const ChatMessageItem = React.memo(({ msg, idx, isStreaming }: { msg: any, idx: number, isStreaming: boolean }) => {
  const fullContent = renderContent(msg.content);
  
  // 1. Split content by <think> tags first
  const baseParts = fullContent.split(/(<think>[\s\S]*?(?:<\/think>|$))/g);

  // 2. Further split Markdown content into paragraphs/chunks to enable incremental rendering
  // We only do this for the streaming message to optimize performance
  const renderSegments = () => {
    let globalSegmentIdx = 0;
    
    return baseParts.map((part, pIdx) => {
      if (part.startsWith('<think>')) {
        return <ThoughtBlock key={`think-${pIdx}`} content={part} />;
      }
      
      if (!part.trim() && part !== '\n' && part !== '\n\n') return null;

      // If the message is NOT streaming, we can render the whole part at once
      if (!isStreaming) {
        return (
          <MemoizedMarkdown 
            key={`part-${pIdx}`} 
            content={part} 
            isStreaming={false} 
            messageIdx={idx} 
            segmentIdx={globalSegmentIdx++} 
          />
        );
      }

      // If it IS streaming, split into stable chunks (by double newline) 
      // and an active tail
      const chunks = part.split(/(\n\n)/g);
      const processedChunks: string[] = [];
      for (let i = 0; i < chunks.length; i += 2) {
        let chunk = chunks[i];
        if (i + 1 < chunks.length) {
          chunk += chunks[i + 1];
        }
        if (chunk) processedChunks.push(chunk);
      }

      return processedChunks.map((chunk, cIdx) => {
        const isLastChunkOfLastPart = isStreaming && pIdx === baseParts.length - 1 && cIdx === processedChunks.length - 1;
        
        return (
          <MemoizedMarkdown 
            key={`chunk-${pIdx}-${cIdx}`} 
            content={chunk} 
            isStreaming={isLastChunkOfLastPart} 
            messageIdx={idx} 
            segmentIdx={globalSegmentIdx++} 
          />
        );
      });
    });
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '16px', 
      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', 
      alignItems: 'flex-start',
      width: '100%'
    }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: '6px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-header)',
        border: '1px solid var(--border-main)',
        flexShrink: 0
      }}>
        {msg.role === 'user' ? <User size={18} color="#fff" /> : <Bot size={18} color="var(--accent)" />}
      </div>
      <div style={{ 
        maxWidth: '80%', 
        backgroundColor: msg.role === 'user' ? 'var(--bg-panel)' : 'transparent',
        padding: msg.role === 'user' ? '12px 16px' : '0',
        borderRadius: '12px',
        border: msg.role === 'user' ? '1px solid var(--border-main)' : 'none',
        fontSize: '0.85rem',
        lineHeight: '1.6',
        color: 'var(--text-main)'
      }}>
        {renderSegments()}
      </div>
    </div>
  );
});

const ChatPanel: React.FC = () => {
  const { apiKey, getActiveSession, provider, model } = useStore();
  const session = getActiveSession();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllersMap = useRef<Record<string, AbortController>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAutoScrollEnabledRef = useRef(true);

  const scrollToBottom = (force = false) => {
    if (force || isAutoScrollEnabledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
    }
  };

  // Detect manual scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // If the user is within 50px of the bottom, enable auto-scroll
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    isAutoScrollEnabledRef.current = isAtBottom;
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, session?.isAiThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  if (!session) return <div className="panel-container"><div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>No session active...</div></div>;

  const sendMessage = async () => {
    if (!inputValue.trim() || !apiKey || session.isAiThinking) return;

    const messageText = inputValue.trim();
    setInputValue('');
    const initiatingSessionId = session.id;

    // Force scroll to bottom when sending a message
    isAutoScrollEnabledRef.current = true;

    useStore.setState(state => ({
      sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, isAiThinking: true } : s)
    }));

    const controller = new AbortController();
    abortControllersMap.current[initiatingSessionId] = controller;

    try {
      await runAgentLoop(initiatingSessionId, messageText, (updatedHistory) => {
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === initiatingSessionId ? { ...s, messages: updatedHistory } : s)
        }));
      }, controller.signal);
    } catch (error: any) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) {
        useStore.setState(state => ({
          sessions: state.sessions.map(s => s.id === initiatingSessionId ? { 
            ...s, 
            messages: [...s.messages, { role: 'assistant', content: `Error: ${error.message}`, timestamp: Date.now() } as any] 
          } : s)
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
    if (abortControllersMap.current[session.id]) {
      abortControllersMap.current[session.id].abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="panel-container" style={{ backgroundColor: 'var(--bg-app)' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>AI ASSISTANT</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-dim)', backgroundColor: 'var(--bg-input)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border-main)' }}>
          {provider.toUpperCase()} / {model}
        </div>
      </div>

      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', padding: '20px' }}
        >
          {session.messages.length === 0 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3, textAlign: 'center', gap: '16px' }}>
              <Bot size={48} />
              <div style={{ fontSize: '0.8rem', maxWidth: '240px', lineHeight: '1.4' }}>
                Describe a synthesizer or effect to begin developing your Faust DSP.
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {session.messages.map((msg, idx) => {
              // A message is considered "streaming" if it's the last message and the session is currently thinking
              const isStreaming = idx === session.messages.length - 1 && session.isAiThinking;
              return <ChatMessageItem key={idx} msg={msg} idx={idx} isStreaming={isStreaming} />;
            })}
            
            {session.isAiThinking && (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--bg-header)', border: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={18} color="var(--accent)" className="animate-spin" />
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div className="dot-pulse" style={{ animationDelay: '0s' }}></div>
                  <div className="dot-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="dot-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} style={{ height: '20px' }} />
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--border-main)', backgroundColor: 'var(--bg-panel)' }}>
          {!apiKey && (
            <div style={{ marginBottom: '12px', fontSize: '0.65rem', color: 'var(--error)', fontWeight: 800, textAlign: 'center', letterSpacing: '0.1em' }}>
              CONFIGURE API KEY IN SETTINGS TO CHAT
            </div>
          )}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'var(--bg-input)', 
            border: '1px solid var(--border-main)', 
            borderRadius: '8px',
            padding: '8px',
            transition: 'border-color 0.2s',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }} className="input-focus-container">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Faust AI..."
              rows={1}
              style={{ 
                width: '100%', 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                color: 'var(--text-main)', 
                fontSize: '0.9rem',
                resize: 'none',
                minHeight: '24px',
                maxHeight: '200px',
                padding: '8px',
                lineHeight: '1.5'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', padding: '0 4px 4px 0' }}>
              {session.isAiThinking ? (
                <button 
                  onClick={handleStop}
                  style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', fontWeight: 700, transition: 'background 0.2s' }}
                >
                  <Square size={12} fill="currentColor" /> STOP
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || !apiKey}
                  style={{ 
                    backgroundColor: inputValue.trim() && apiKey ? 'var(--accent)' : '#2a2a2e', 
                    color: '#fff', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '6px', 
                    cursor: inputValue.trim() && apiKey ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    transition: 'all 0.2s',
                    opacity: inputValue.trim() && apiKey ? 1 : 0.3
                  }}
                >
                  <Send size={14} /> SEND
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .dot-pulse { width: 6px; height: 6px; border-radius: 50%; background-color: var(--accent); animation: pulse 1.4s infinite ease-in-out; opacity: 0.4; }
        @keyframes pulse { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; } 40% { transform: scale(1.2); opacity: 1; } }

        .icon-hover:hover { background-color: rgba(255,255,255,0.05) !important; }
        .input-focus-container:focus-within { border-color: var(--accent) !important; }

        /* Professional Markdown Adjustments */
        .panel-content p { margin: 0 0 16px 0; }
        .panel-content p:last-child { margin-bottom: 0; }
        .panel-content ul, .panel-content ol { margin: 0 0 16px 24px; padding: 0; }
        .panel-content li { margin-bottom: 6px; }
        .panel-content h1, .panel-content h2, .panel-content h3 { margin: 24px 0 12px 0; font-weight: 800; color: var(--text-main); letter-spacing: -0.01em; }
        .panel-content blockquote { border-left: 4px solid var(--border-main); padding: 4px 0 4px 16px; margin: 16px 0; color: var(--text-dim); font-style: italic; }
        .panel-content strong { color: var(--accent); font-weight: 700; }
      `}</style>
    </div>
  );
};

export default ChatPanel;