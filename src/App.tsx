import React, { useState } from 'react';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import Header from './components/Header';
import ChatPanel from './components/Chat/ChatPanel';
import EditorPanel from './components/Editor/EditorPanel';
import FaustUIPanel from './components/FaustUI/FaustUIPanel';
import SessionPanel from './components/SessionPanel';
import { useStore } from './store';
import './App.css';

const App: React.FC = () => {
  const sessions = useStore((state) => state.sessions);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const provider = useStore((state) => state.provider);
  const [editorCollapsed, setEditorCollapsed] = useState(true);

  const handleEditorExpand = () => setEditorCollapsed(!editorCollapsed);

  return (
    <div className="app-container">
      <Header />
      <div className="main-layout">
        <Allotment>
          {/* Left Sidebar: Session Management */}
          <Allotment.Pane preferredSize={240} minSize={200}>
            <SessionPanel />
          </Allotment.Pane>

          {/* Center Column: UI (Top) and Editor (Bottom) */}
          <Allotment.Pane minSize={400}>
            <Allotment vertical>
              <Allotment.Pane preferredSize="50%" minSize={200}>
                <FaustUIPanel onEditorExpand={handleEditorExpand} editorCollapsed={editorCollapsed} />
              </Allotment.Pane>

              <Allotment.Pane preferredSize="50%" minSize={200} visible={!editorCollapsed}>
                <EditorPanel showHeader={true} />
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>

          {/* Right Sidebar: Chat */}
          <Allotment.Pane preferredSize={350} minSize={250}>
            <div style={{ height: '100%', width: '100%', position: 'relative' }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    display: session.id === activeSessionId ? 'block' : 'none',
                    height: '100%',
                    width: '100%'
                  }}
                >
                  {/* Add key prop to force remount when provider changes */}
                  <ChatPanel key={`${session.id}-${provider}`} sessionId={session.id} />
                </div>
              ))}
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};

export default App;
