import React, { useState, useEffect } from 'react';
import { useStore, type AIProvider } from '../store';
import { Play, Square, Activity, Settings, X, DownloadCloud, Github } from 'lucide-react';
import { aiFetch, isElectron } from '../utils/env';

const Header: React.FC = () => {
  const { 
    isAudioRunning, 
    setAudioRunning, 
    getAudioCtx,
    provider,
    apiKey,
    model,
    models,
    setSettings,
    getActiveSession,
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Update state
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'downloaded'>('idle');

  const activeSession = getActiveSession();
  const dspNode = activeSession?.dspNode;

  useEffect(() => {
    if (isElectron) {
      const ipcRenderer = (window as any).ipcRenderer;
      if (ipcRenderer) {
        ipcRenderer.on('update-available', () => setUpdateStatus('available'));
        ipcRenderer.on('update-downloaded', () => setUpdateStatus('downloaded'));
      }
    }
  }, []);

  const handleInstallUpdate = () => {
    if (isElectron) {
      (window as any).ipcRenderer.send('install-update');
    }
  };

  const fetchModels = async () => {
    console.log(`[DSPCLAW] Fetching models for '${provider}' with key: '${apiKey ? 'sk-...' + apiKey.slice(-4) : 'none'}'`);
    if (!apiKey) {
      setSettings({ models: [] });
      return;
    }
    try {
      let url = '';
      let headers: any = { 'Authorization': `Bearer ${apiKey}` };

      switch (provider) {
        case 'moonshot': url = 'https://api.moonshot.cn/v1/models'; break;
        case 'deepseek': url = 'https://api.deepseek.com/v1/models'; break;
        case 'gemini': url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey; headers = {}; break;
        case 'glm': url = 'https://open.bigmodel.cn/api/paas/v4/models'; break;
      }

      if (!url) return;

      const response = await aiFetch({
        url,
        method: 'GET',
        headers
      });
      
      let fetchedModels: string[] = [];
      if (provider === 'gemini' && response.data.models) {
        fetchedModels = response.data.models.map((m: any) => m.name.replace('models/', ''));
      } else if (response.data && response.data.data) {
        fetchedModels = response.data.data.map((m: any) => m.id);
      }

      fetchedModels.sort((a, b) => {
        const keywords = ['gpt-4', 'sonnet', 'opus', 'v3', 'chat', 'latest', 'reasoner'];
        const aScore = keywords.reduce((s, k) => s + (a.toLowerCase().includes(k) ? 1 : 0), 0);
        const bScore = keywords.reduce((s, k) => s + (b.toLowerCase().includes(k) ? 1 : 0), 0);
        return bScore - aScore;
      });

      setSettings({ models: fetchedModels });
      if (!model && fetchedModels.length > 0) setSettings({ model: fetchedModels[0] });
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
    }
  };

  useEffect(() => {
    if (apiKey && isSettingsOpen) fetchModels();
  }, [apiKey, provider, isSettingsOpen]);

  // SILENT START: Automatically resume audio on the very first user interaction
  useEffect(() => {
    if (isAudioRunning) return;

    const handleFirstInteraction = async () => {
      const audioCtx = getAudioCtx();
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
          console.log("[DSPCLAW] Audio Engine silently initialized via user interaction");
          
          if (dspNode) {
            dspNode.connect(audioCtx.destination);
          }
          setAudioRunning(true);
        } catch (e) {
          console.error("[DSPCLAW] Failed to silently initialize audio:", e);
        }
      }
      
      // Cleanup: only need to trigger once
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('mousedown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    window.addEventListener('mousedown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('mousedown', handleFirstInteraction);
    };
  }, [getAudioCtx, dspNode, setAudioRunning, isAudioRunning]);

  const handleToggleAudio = async () => {
    const audioCtx = getAudioCtx();
    if (!isAudioRunning) {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (dspNode) {
        dspNode.connect(audioCtx.destination);
      }
      setAudioRunning(true);
    } else {
      if (dspNode) {
        dspNode.disconnect();
      }
      setAudioRunning(false);
    }
  };

  return (
    <header style={{
      height: '48px', // Smaller header
      backgroundColor: 'var(--bg-header)',
      borderBottom: '1px solid var(--border-main)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      justifyContent: 'space-between',
      zIndex: 100,
      gap: '12px',
      // @ts-ignore
      WebkitAppRegion: 'drag',
    }}>
      {/* Left: Logo & GitHub */}
      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent)" />
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
            DSPCLAW
          </span>
        </div>
        <a 
          href="https://github.com/lmaxwell/dspclaw" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            color: '#555', 
            display: 'flex', 
            alignItems: 'center', 
            transition: 'color 0.2s',
            // @ts-ignore
            WebkitAppRegion: 'no-drag'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#555'}
        >
          <Github size={16} />
        </a>
      </div>

      {/* Center: Global Toggle */}
      <div style={{ 
        flex: '2 1 0',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        <button
          onClick={handleToggleAudio}
          style={{
            position: 'relative',
            backgroundColor: '#1a1a1e',
            backgroundImage: 'linear-gradient(180deg, #2d2d33 0%, #1a1a1e 100%)',
            color: '#fff', 
            border: '1px solid #000', 
            borderTop: '1px solid #444',
            borderRadius: '4px',
            padding: '6px 20px', // Smaller padding
            fontSize: '0.85rem', // Smaller font
            fontWeight: 900,
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            cursor: 'pointer',
            minWidth: '160px', // Smaller min-width
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
            transition: 'all 0.05s ease',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(1px)';
            e.currentTarget.style.backgroundImage = 'linear-gradient(180deg, #1a1a1e 0%, #2d2d33 100%)';
            e.currentTarget.style.boxShadow = '0 1px 1px rgba(0,0,0,0.5), inset 0 1px 1px rgba(0,0,0,0.2)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.backgroundImage = 'linear-gradient(180deg, #2d2d33 0%, #1a1a1e 100%)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)';
          }}
        >
          {/* Hardware LED Indicator */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isAudioRunning ? '#3b82f6' : '#222',
            boxShadow: isAudioRunning 
              ? `0 0 10px rgba(59, 130, 246, 0.6), inset 0 1px 2px rgba(255,255,255,0.4)` 
              : 'inset 0 1px 2px rgba(0,0,0,0.8)',
            border: '1px solid #000'
          }} />

          <span style={{ 
            color: isAudioRunning ? '#fff' : '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isAudioRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {isAudioRunning ? 'STOP ENGINE' : 'START ENGINE'}
          </span>
        </button>
      </div>

      {/* Right: Settings & Updates */}
      <div style={{ 
        flex: '1 1 0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end', 
        gap: '12px',
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        {updateStatus === 'available' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>
            <DownloadCloud size={14} />
            DOWNLOADING...
          </div>
        )}
        {updateStatus === 'downloaded' && (
          <button 
            onClick={handleInstallUpdate}
            style={{ 
              backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px',
              padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <DownloadCloud size={12} /> RESTART
          </button>
        )}
        <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', color: '#555', border: 'none', cursor: 'pointer' }}><Settings size={18} /></button>
      </div>

      {isSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1a1a1e', width: '400px', borderRadius: '10px', border: '1px solid var(--border-main)', padding: '24px', position: 'relative', boxShadow: '0 15px 30px rgba(0,0,0,0.5)' }}>
            <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', fontWeight: 800 }}>Global Settings</h2>
            
            {(() => {
              const inputStyle: React.CSSProperties = { 
                width: '100%', 
                height: '40px',
                padding: '0 12px', 
                backgroundColor: '#111', 
                color: 'white', 
                border: '1px solid #333', 
                borderRadius: '4px', 
                boxSizing: 'border-box',
                fontSize: '1rem',
                outline: 'none',
                WebkitAppearance: 'none',
                appearance: 'none'
              };

              return (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>AI PROVIDER</label>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={provider} 
                        onChange={(e) => setSettings({ provider: e.target.value as AIProvider })} 
                        style={{ ...inputStyle, cursor: 'pointer', paddingRight: '28px' }}
                      >
                        <option value="moonshot">Kimi (Moonshot)</option>
                        <option value="gemini">Gemini (Google)</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="glm">GLM (Zhipu AI)</option>
                      </select>
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666', fontSize: '0.7rem' }}>▼</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>MODEL</label>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={model} 
                        onChange={(e) => setSettings({ model: e.target.value })} 
                        style={{ ...inputStyle, cursor: 'pointer', paddingRight: '28px' }}
                      >
                        {models.length > 0 ? (
                          models.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))
                        ) : (
                          <option value={model}>{model || 'Fetching...'}</option>
                        )}
                      </select>
                      <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666', fontSize: '0.7rem' }}>▼</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>API KEY</label>
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={(e) => setSettings({ apiKey: e.target.value })} 
                      style={inputStyle} 
                    />
                  </div>
                </>
              );
            })()}

            <button onClick={() => setIsSettingsOpen(false)} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 800, cursor: 'pointer', fontSize: '1rem', letterSpacing: '0.05em' }}>CLOSE</button>
          </div>
        </div>
      )}
      <style>{`
        .spinner { border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 2px solid #fff; animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
};

export default Header;