import { useEffect, useState, Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeApp } from './init'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#fb7185',
          padding: '40px',
          textAlign: 'center'
        }}>
          <h2 style={{ letterSpacing: '0.1em' }}>APPLICATION CRASHED</h2>
          <p style={{ color: '#888', maxWidth: '600px', fontFamily: 'monospace', fontSize: '0.9rem' }}>
            {this.state.error?.toString()}
          </p>
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
            RELOAD INTERFACE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Root = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp()
      .then(() => setReady(true))
      .catch((e) => {
        console.error("Initialization Failed:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage || "An unknown initialization error occurred.");
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

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
