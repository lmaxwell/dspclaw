import React from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../../store';
import { Play } from 'lucide-react';
import { useActiveSession } from '../../hooks/useSession';

import { compileAndRun } from '../../agent/tools/compile_and_run';

interface EditorPanelProps {
  showHeader?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({ showHeader = true }) => {
  const { updateActiveSession, activeSessionId } = useStore();
  const session = useActiveSession();

  const handleCompile = async () => {
    try {
      await compileAndRun.execute!({ __sessionId: activeSessionId }, {} as any);
    } catch (e) {
      console.error("Manual compile failed:", e);
    }
  };

  if (!session) return <div className="panel-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>No active session</div>;

  return (
    <div className="panel-container" style={{ height: '100%' }}>
      {showHeader && (
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '40px', boxSizing: 'border-box' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.15em' }}>EDITOR - {session.name.toUpperCase()}</span>
          <button 
            onClick={handleCompile}
            disabled={session.isCompiling}
            style={{
              backgroundColor: session.isCompiling ? 'transparent' : 'var(--accent-soft)',
              border: session.isCompiling ? '1px solid var(--border-main)' : '1px solid var(--accent-glow)',
              color: session.isCompiling ? 'var(--text-dim)' : 'var(--accent)',
              padding: '4px 12px',
              borderRadius: '15px',
              fontSize: '0.7rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: session.isCompiling ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.05em'
            }}
          >
            <Play size={10} fill="currentColor" /> {session.isCompiling ? 'COMPILING...' : 'RUN'}
          </button>
        </div>
      )}
      <div className="panel-content" style={{ height: '100%', position: 'relative' }}>
        <Editor
          height="100%"
          language="cpp"
          theme="vs-dark"
          value={session.code}
          onChange={(value) => updateActiveSession({ code: value || '' })}
          options={{
            minimap: { enabled: false },
            fontSize: 18,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fixedOverflowWidgets: true,
            padding: { top: 10, bottom: 10 },
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false,
            }
          }}
        />
      </div>
    </div>
  );
};

export default EditorPanel;
