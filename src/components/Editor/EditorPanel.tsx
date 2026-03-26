import React from 'react';
import Editor from '@monaco-editor/react';
import { useStore } from '../../store';
import { Play } from 'lucide-react';

import { compileAndRun } from '../../agent/tools/compile_and_run';

interface EditorPanelProps {
  showHeader?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({ showHeader = true }) => {
  const { getActiveSession, updateActiveSession, activeSessionId } = useStore();
  const session = getActiveSession();

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
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>EDITOR - {session.name}</span>
          <button 
            onClick={handleCompile}
            disabled={session.isCompiling}
            style={{
              backgroundColor: session.isCompiling ? '#222' : '#333',
              color: session.isCompiling ? '#555' : '#888',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: session.isCompiling ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={10} /> {session.isCompiling ? 'COMPILING...' : 'COMPILE'}
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
