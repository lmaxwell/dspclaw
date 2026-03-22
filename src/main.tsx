import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeApp } from './init'

const Root = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp()
      .then(() => setReady(true))
      .catch((e) => {
        console.error("Initialization Failed:", e);
        setError(e.message);
      });
  }, []);

  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        color: '#f75a5b',
        padding: '40px',
        textAlign: 'center'
      }}>
        <h2 style={{ letterSpacing: '0.1em' }}>ENGINE CRITICAL ERROR</h2>
        <p style={{ color: '#888', maxWidth: '500px' }}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            backgroundColor: '#333',
            color: '#fff',
            border: '1px solid #444',
            padding: '8px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          RESTART SYSTEM
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#121214',
        color: '#3b82f6',
        fontWeight: 700,
        letterSpacing: '0.2em',
        fontSize: '0.8rem'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div className="loader-ring"></div>
          INITIALIZING DSPCLAW...
        </div>
      </div>
    );
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
