import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, User, Bot, Loader2, Sparkles, Terminal, Copy, Check, ChevronDown, ChevronRight, BrainCircuit, RefreshCw, AlertCircle } from 'lucide-react';
import { type UIMessage as Message, DirectChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useStore } from '../../store';
import { getOrCreateAgent } from '../../agent/factory';
import { aiFetch } from '../../utils/env';
import { PROVIDERS } from '../../config';
import { useSession } from '../../hooks/useSession';

const formatTokens = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.round(num / 1000) + 'k';
  return num.toString();
};

/**
 * Renders a collapsible reasoning/thought block.
 */
const ThoughtBlock = ({ content }: { content: any }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const textContent = typeof content === 'string' ? content : JSON.stringify(content);
  const cleanContent = textContent.replace(/<think>|<\/think>/g, '').trim();

  return (
    <div style={{ margin: '12px 0', borderLeft: '1px solid var(--accent)', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '0 8px 8px 0', overflow: 'hidden' }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'left' }}>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <BrainCircuit size={14} color="var(--accent)" />
        Reasoning Process
      </button>
      {isOpen && (
        <div style={{ padding: '0 12px 12px 12px', fontSize: '0.95rem', color: 'var(--text-dim)', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontStyle: 'italic', opacity: 0.8 }}>
          {cleanContent || 'Thinking...'}
        </div>
      )}
    </div>
  );
};

const MemoizedMarkdown = React.memo(({ content, isStreaming, messageIdx, segmentIdx }: { content: string; isStreaming: boolean; messageIdx: number; segmentIdx: number; }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      code({ node: _node, inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '');
        const codeText = String(children).replace(/\n$/, '');
        const codeId = `code-${messageIdx}-${segmentIdx}-${Math.random().toString(36).substr(2, 5)}`;
        
        if (inline || !match) {
          return <code style={{ backgroundColor: 'var(--bg-input)', color: 'var(--accent)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.05)', fontSize: '1rem' }} {...props}>{children}</code>;
        }

        return (
          <div style={{ marginTop: '16px', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <div style={{ backgroundColor: 'var(--bg-header)', padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={14} color="var(--text-dim)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '0.05em' }}>{match[1].toUpperCase()}</span>
              </div>
              <button onClick={() => copyToClipboard(codeText, codeId)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }} className="icon-hover">
                {copiedId === codeId ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              </button>
            </div>
            {isStreaming ? (
              <pre style={{ margin: 0, padding: '16px', background: '#0d0d0f', fontSize: '1rem', lineHeight: '1.6', overflowX: 'auto', color: '#ccc' }}><code>{codeText}</code></pre>
            ) : (
              <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" customStyle={{ margin: 0, padding: '16px', background: '#0d0d0f', fontSize: '1rem', lineHeight: '1.6' }} {...props}>{codeText}</SyntaxHighlighter>
            )}
          </div>
        );
      }
    }}>{content}</ReactMarkdown>
  );
});

const ChatMessageItem = React.memo(({ msg, idx, isStreaming }: { msg: Message; idx: number; isStreaming: boolean; }) => {
  const renderTool = (toolName: string, state: string, key: string | number) => {
    const isExecuting = ['call', 'partial-call', 'input-available', 'input-streaming'].includes(state);
    const isDone = ['result', 'output-available'].includes(state);

    if (isExecuting) {
      if (isStreaming) {
        return <div key={key} style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.7 }}><Loader2 size={10} className="animate-spin" />{toolName}</div>;
      } else {
        return <div key={key} style={{ fontSize: '0.7rem', color: '#fb7185', marginBottom: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>Stopped: {toolName}</div>;
      }
    }
    if (isDone) {
      return <div key={key} style={{ fontSize: '0.7rem', color: '#10b981', marginBottom: '6px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}><Check size={8} />{toolName}</div>;
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', gap: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start', width: '100%' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.01)', flexShrink: 0, opacity: 0.8 }}>
        {msg.role === 'user' ? <User size={14} color="#fff" /> : <Bot size={14} color="var(--accent)" />}
      </div>
      <div style={{
        maxWidth: '88%',
        backgroundColor: msg.role === 'user' ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
        padding: msg.role === 'user' ? '10px 14px' : '0',
        borderRadius: '10px',
        border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.02)' : 'none',
        fontSize: '0.95rem',
        lineHeight: '1.5',
        color: 'var(--text-main)'
      }}>        {/* Iterate through parts (modern format) */}
        {msg.parts?.map((part: any, pIdx: number) => {
          if (part.type === 'text') {
            const text = part.text;
            if (text.includes('<think>') && text.includes('</think>')) {
              const regex = /<think>([\s\S]*?)<\/think>/g;
              const segments = [];
              let lastIndex = 0;
              let match;
              while ((match = regex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                  segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
                }
                segments.push({ type: 'reasoning', content: match[1] });
                lastIndex = regex.lastIndex;
              }
              if (lastIndex < text.length) {
                segments.push({ type: 'text', content: text.slice(lastIndex) });
              }
              
              return segments.map((seg, sIdx) => 
                seg.type === 'text' ? (
                  <MemoizedMarkdown key={`${pIdx}-${sIdx}`} content={seg.content} isStreaming={isStreaming && pIdx === msg.parts!.length - 1 && sIdx === segments.length - 1} messageIdx={idx} segmentIdx={pIdx} />
                ) : (
                  <ThoughtBlock key={`${pIdx}-${sIdx}`} content={seg.content} />
                )
              );
            } else if (text.includes('<think>')) {
              const [before, ...afterParts] = text.split('<think>');
              return (
                <React.Fragment key={pIdx}>
                  {before && <MemoizedMarkdown content={before} isStreaming={false} messageIdx={idx} segmentIdx={pIdx} />}
                  <ThoughtBlock content={afterParts.join('<think>')} />
                </React.Fragment>
              );
            }
            return <MemoizedMarkdown key={pIdx} content={text} isStreaming={isStreaming && pIdx === msg.parts!.length - 1} messageIdx={idx} segmentIdx={pIdx} />;
          }
          if (part.type === 'reasoning') {
            return <ThoughtBlock key={pIdx} content={part.text} />;
          }
          
          // Check for tool parts: generic 'tool-invocation' or typed 'tool-{name}'
          if (part.type === 'tool-invocation') {
            return renderTool(part.toolInvocation.toolName, part.toolInvocation.state, `part-tool-${pIdx}`);
          }
          if (part.type.startsWith('tool-')) {
            const toolName = part.type.replace('tool-', '');
            return renderTool(toolName, part.state, `part-tool-${pIdx}`);
          }
          
          return null;
        })}
      </div>
    </div>
  );
});

interface ChatPanelProps {
  sessionId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId }) => {
  const { provider, updateSession, setSessionModel, customProviders } = useStore();
  const session = useSession(sessionId);
  const apiKey = useStore(state => state.apiKeys[state.provider]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAutoScrollEnabledRef = useRef(true);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const fetchModels = async () => {
    if (!apiKey || !session) return;
    setIsFetchingModels(true);
    
    try {
      let url = '';
      let headers: any = { 'Authorization': `Bearer ${apiKey}` };

      switch (provider) {
        case 'moonshot': url = `/api/moonshot${PROVIDERS.moonshot.modelsEndpoint}`; break;
        case 'deepseek': url = `/api/deepseek${PROVIDERS.deepseek.modelsEndpoint}`; break;
        case 'gemini':
          url = `${PROVIDERS.gemini.apiBase}${PROVIDERS.gemini.modelsEndpoint}?key=${apiKey}`;
          headers = {};
          break;
        case 'glm': url = `/api/glm${PROVIDERS.glm.modelsEndpoint}`; break;
      }

      if (!url) return;

      const response = await aiFetch({ url, method: 'GET', headers });
      
      let modelObjects: { id: string, created?: number }[] = [];
      
      if (provider === 'gemini' && response.data.models) {
        modelObjects = response.data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            id: m.name.replace('models/', ''),
            created: 0 // Gemini doesn't provide timestamps
          }));
      } else if (response.data && response.data.data) {
        modelObjects = response.data.data.map((m: any) => ({
          id: m.id,
          created: m.created || 0
        }));
      }

      // Natural scoring function (strictly following requested priority)
      const getModelScore = (id: string) => {
        const lowerId = id.toLowerCase();
        let score = 0;
        
        // 1. Version priority (Highest: 3 > 2 > 1)
        const versionMatch = lowerId.match(/(\d+\.\d+)|\d+/);
        if (versionMatch) {
          const versionNum = parseFloat(versionMatch[0]);
          if (!isNaN(versionNum)) {
            score += versionNum * 1000; // Multiplier to dominate
          }
        }
        
        // 2. Tier priority (Secondary: pro > flash > flash-lite)
        if (lowerId.includes('pro')) score += 500;
        else if (lowerId.includes('flash-lite')) score += 100;
        else if (lowerId.includes('flash')) score += 300;
        
        // 3. Status priority (Tie-breaker)
        if (lowerId.includes('latest')) score += 50;
        if (lowerId.includes('preview')) score += 40;
        
        // Penalize legacy
        if (lowerId.includes('vision') || lowerId.includes('tuning')) score -= 5000;
        
        return score;
      };

      // Sort by timestamp descending, then by natural score
      modelObjects.sort((a, b) => {
        if (a.created !== b.created) return (b.created || 0) - (a.created || 0);
        return getModelScore(b.id) - getModelScore(a.id);
      });

      // If no timestamps provided (like Gemini), list all available.
      // Otherwise keep top 10 most recent (relevant for providers with many legacy models).
      const hasTimestamps = modelObjects.some(m => m.created && m.created > 0);
      const fetchedModels = hasTimestamps 
        ? modelObjects.slice(0, 10).map(m => m.id) 
        : modelObjects.map(m => m.id);

      updateSession(session.id, { models: fetchedModels });
      if (fetchedModels.length > 0 && !fetchedModels.includes(session.model)) {
        updateSession(session.id, { model: fetchedModels[0] });
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    if (apiKey && session && session.models.length === 0) {
      fetchModels();
    }
  }, [apiKey, provider, session?.id]);

  const agent = useMemo(() => {
    if (!session || !apiKey) return null;
    return getOrCreateAgent(session.id);
  }, [session?.id, apiKey, provider, session?.model]);

  const transport = useMemo(() => {
    return agent ? new DirectChatTransport({ 
      agent,
      sendReasoning: true
    }) : undefined;
  }, [agent]);

  const { messages, sendMessage, stop, status, setMessages, error, regenerate, clearError } = useChat({
    id: session?.id,
    // @ts-ignore
    initialMessages: session?.messages || [],
    transport,
    onFinish: (event) => {
      if (session) {
        updateSession(session.id, { messages: event.messages as any });
      }
    }
  });

  // Clear error when model or provider changes
  useEffect(() => {
    if (error && clearError) {
      clearError();
    }
  }, [session?.model, provider, clearError]);

  // Aggressive sync: Update store whenever useChat messages change
  const previousMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (session && messages.length !== previousMessagesLength.current) {
        previousMessagesLength.current = messages.length;
        updateSession(session.id, { messages: messages as any });
    } else if (session && messages.length > 0 && isAiThinking) {
        // Sync streaming content without triggering excessive re-renders
        // Using JSON stringify to check for deep changes
        const currentMessagesStr = JSON.stringify(messages);
        const storeMessagesStr = JSON.stringify(session.messages);
        if (currentMessagesStr !== storeMessagesStr) {
           updateSession(session.id, { messages: messages as any });
        }
    }
  }, [messages, session?.id, updateSession, status]);

  // Hydrate messages when session changes to prevent losing history in the UI
  // Note: less critical now that each session has its own panel, but good for initial load
  useEffect(() => {
    if (session?.id && messages.length === 0 && session.messages.length > 0) {
      setMessages((session.messages as any) || []);
    }
  }, [session?.id, setMessages]);

  const [input, setInput] = useState('');
  const isAiThinking = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (session) {
      updateSession(session.id, { isAiThinking });
    }
  }, [isAiThinking, session?.id]);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (input.trim() && apiKey && !isAiThinking) {
      isAutoScrollEnabledRef.current = true;
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isAiThinking) {
        stop();
      } else {
        handleSendMessage();
      }
    }
  };

  const scrollToBottom = (force = false) => {
    if (force || isAutoScrollEnabledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isAutoScrollEnabledRef.current = isAtBottom;
  };

  useEffect(() => { scrollToBottom(); }, [messages, isAiThinking]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [input]);

  if (!session) return <div className="panel-container"><div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '1rem' }}>No session active...</div></div>;

  return (
    <div className="panel-container" style={{ backgroundColor: 'var(--bg-app)', border: 'none' }}>
      <div className="panel-header" style={{ height: '40px', padding: '0 12px', boxSizing: 'border-box', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
          <Sparkles size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.15em' }}>AI</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
          {session.tokenUsage && session.tokenUsage.inputTokens > 0 && (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontWeight: 700, marginRight: '4px', opacity: 0.5, letterSpacing: '0.05em' }}>
              CTX: {formatTokens(session.tokenUsage.inputTokens + session.tokenUsage.outputTokens)}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)', overflow: 'hidden' }}>
            <div style={{ padding: '0 8px', fontSize: '0.6rem', fontWeight: 900, color: 'var(--accent)', borderRight: '1px solid rgba(255,255,255,0.03)', height: '22px', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.01)', whiteSpace: 'nowrap', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.05em' }}>
              {(customProviders.find(p => p.id === provider)?.name || provider).toUpperCase()}
            </div>
            <select
              value={session.model}
              onChange={(e) => setSessionModel(session.id, e.target.value)}
              style={{ background: 'none', color: 'var(--text-dim)', border: 'none', height: '22px', padding: '0 4px', fontSize: '0.7rem', outline: 'none', cursor: 'pointer', maxWidth: '130px', fontWeight: 600 }}
            >
              {session.models.length > 0 ? session.models.map(m => <option key={m} value={m} style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>{m}</option>) : <option value={session.model} style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>{session.model || 'No model'}</option>}
            </select>
            <button 
              onClick={fetchModels} 
              disabled={isFetchingModels || !apiKey}
              style={{ background: 'none', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.03)', height: '22px', width: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', opacity: 0.5 }}
              className="icon-hover"
            >
              <RefreshCw size={10} className={isFetchingModels ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>
      <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
        <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 12px' }}>
          {messages.length === 0 && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2, textAlign: 'center', gap: '16px' }}>
              <Bot size={48} />
              <div style={{ fontSize: '0.9rem', maxWidth: '260px', lineHeight: '1.5' }}>Describe a synthesizer or effect to begin developing your Faust DSP.</div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map((msg, idx) => <ChatMessageItem key={msg.id || idx} msg={msg} idx={idx} isStreaming={isAiThinking && idx === messages.length - 1} />)}
            
            {error && (
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: 'rgba(251, 113, 133, 0.05)', 
                border: '1px solid rgba(251, 113, 133, 0.1)', 
                borderRadius: '8px',
                color: '#fb7185',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                margin: '0 12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <AlertCircle size={14} />
                  AI Error
                </div>
                <div style={{ opacity: 0.9, lineHeight: '1.4' }}>{error.message || 'An unexpected error occurred during the AI request.'}</div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button 
                    onClick={() => regenerate()} 
                    style={{ background: 'none', border: 'none', color: '#fb7185', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    RETRY
                  </button>
                  <button 
                    onClick={() => clearError()} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            )}

            {isAiThinking && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', opacity: 0.6 }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--bg-header)', border: '1px solid rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={14} color="var(--accent)" className="animate-spin" />
                </div>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <div className="dot-pulse" style={{ width: '4px', height: '4px', animationDelay: '0s' }}></div>
                  <div className="dot-pulse" style={{ width: '4px', height: '4px', animationDelay: '0.2s' }}></div>
                  <div className="dot-pulse" style={{ width: '4px', height: '4px', animationDelay: '0.4s' }}></div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} style={{ height: '20px' }} />
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.02)', backgroundColor: 'transparent' }}>
          {!apiKey && <div style={{ marginBottom: '12px', fontSize: '0.7rem', color: 'var(--error)', fontWeight: 800, textAlign: 'center', letterSpacing: '0.1em', opacity: 0.6 }}>CONFIGURE API KEY IN SETTINGS</div>}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.03)', 
            borderRadius: '10px', 
            padding: '6px', 
            transition: 'all 0.2s ease'
          }} className="input-focus-container">
            <textarea 
              ref={textareaRef} 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder="Message Faust AI..." 
              rows={1} 
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-main)', fontSize: '0.95rem', resize: 'none', minHeight: '30px', maxHeight: '200px', padding: '8px 10px', lineHeight: '1.5' }} 
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                onClick={() => {
                  if (isAiThinking) {
                    stop();
                  } else {
                    handleSendMessage();
                  }
                }}
                disabled={(!input.trim() && !isAiThinking) || !apiKey}
                style={{
                  backgroundColor: isAiThinking ? 'transparent' : (input.trim() && apiKey ? 'var(--accent)' : 'transparent'), 
                  color: isAiThinking ? '#fb7185' : (input.trim() && apiKey ? '#fff' : 'var(--text-dim)'), 
                  border: 'none',
                  padding: '6px 16px', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: 800, 
                  transition: 'all 0.2s ease',
                  opacity: ((!input.trim() && !isAiThinking) || !apiKey) ? 0.3 : (isAiThinking ? 0.8 : 1),
                  minWidth: '70px', 
                  justifyContent: 'center'
                }}
              >
                {isAiThinking ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {isAiThinking ? 'STOP' : 'SEND'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dot-pulse { border-radius: 50%; background-color: var(--accent); animation: pulse 1.4s infinite ease-in-out; opacity: 0.4; }
        @keyframes pulse { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; } 40% { transform: scale(1.2); opacity: 1; } }
        .icon-hover:hover { background-color: rgba(255,255,255,0.05) !important; }
        .input-focus-container:focus-within { border-color: var(--accent) !important; }
        /* Professional Markdown Adjustments */
        .panel-content p { margin: 0 0 20px 0; }
        .panel-content p:last-child { margin-bottom: 0; }
        .panel-content ul, .panel-content ol { margin: 0 0 20px 28px; padding: 0; }
        .panel-content li { margin-bottom: 8px; }
        .panel-content h1, .panel-content h2, .panel-content h3 { margin: 32px 0 16px 0; font-weight: 800; color: var(--text-main); letter-spacing: -0.01em; }
        .panel-content blockquote { border-left: 4px solid var(--border-main); padding: 6px 0 6px 20px; margin: 20px 0; color: var(--text-dim); font-style: italic; }
        .panel-content strong { color: var(--accent); font-weight: 700; }
      `}</style>
    </div>
  );
};

export default ChatPanel;
