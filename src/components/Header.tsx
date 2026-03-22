import React, { useState, useEffect } from 'react';
import { useStore, type AIProvider } from '../store';
import { Play, Square, Activity, Settings, X, DownloadCloud } from 'lucide-react';
import { getApiUrl, aiFetch, isElectron } from '../utils/env';

const Header: React.FC = () => {
  const { 
    isAudioRunning, 
    setAudioRunning, 
    getAudioCtx,
    provider,
    apiKey,
    model,
    customBaseUrl,
    setSettings,
    getActiveSession,
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  
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
    if (!apiKey) {
      setSettings({ models: [] });
      return;
    }
    try {
      let url = '';
      let headers: any = { 'Authorization': `Bearer ${apiKey}` };

      switch (provider) {
        case 'openai': url = getApiUrl('/api/openai/models'); break;
        case 'moonshot': url = getApiUrl('/api/moonshot/models'); break;
        case 'anthropic': 
          url = getApiUrl('/api/anthropic/models'); 
          headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
          break;
      }

      if (!url) return;

      const response = await aiFetch({
        url,
        method: 'GET',
        headers
      });
      let fetchedModels: string[] = response.data.data.map((m: any) => m.id);

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

  // Listen for first click to clear blocked state
  useEffect(() => {
    const handleFirstClick = () => {
      if (isAudioBlocked) {
        const audioCtx = getAudioCtx();
        audioCtx.resume().then(() => {
          if (audioCtx.state !== 'suspended') {
            setIsAudioBlocked(false);
            setAudioRunning(true);
            if (dspNode) dspNode.connect(audioCtx.destination);
          }
        });
      }
    };
    window.addEventListener('click', handleFirstClick);
    return () => window.removeEventListener('click', handleFirstClick);
  }, [isAudioBlocked, getAudioCtx, dspNode, setAudioRunning]);

  const handleToggleAudio = async () => {
    const audioCtx = getAudioCtx();
    if (!isAudioRunning) {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      if (dspNode) {
        dspNode.connect(audioCtx.destination);
      }
      setAudioRunning(true);
      setIsAudioBlocked(false);
    } else {
      if (dspNode) {
        dspNode.disconnect();
      }
      setAudioRunning(false);
    }
  };

  return (
    <header style={{
      height: '48px',
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
      {/* Left: Logo */}
      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Activity size={18} color="var(--accent)" />
        <span style={{ fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.05em', color: 'var(--text-main)' }}>
          DSPCLAW
        </span>
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
          className={(!isAudioRunning || isAudioBlocked) ? 'pulse-button' : ''}
          style={{
            backgroundColor: isAudioRunning ? '#ef4444' : '#3b82f6',
            color: 'white', border: isAudioBlocked ? '2px solid #fff' : 'none', borderRadius: '4px',
            padding: '6px 20px', fontSize: '0.75rem', fontWeight: 900,
            display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
            minWidth: '160px',
            justifyContent: 'center'
          }}
        >
          {isAudioRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
          {isAudioBlocked ? 'CLICK TO ENABLE AUDIO' : isAudioRunning ? 'STOP ENGINE' : 'START ENGINE'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 'bold' }}>
            <DownloadCloud size={14} className="pulse-button" />
            DOWNLOADING UPDATE...
          </div>
        )}
        {updateStatus === 'downloaded' && (
          <button 
            onClick={handleInstallUpdate}
            style={{ 
              backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px',
              padding: '4px 10px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <DownloadCloud size={12} /> RESTART TO UPDATE
          </button>
        )}
        <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', color: '#555', border: 'none', cursor: 'pointer' }}><Settings size={18} /></button>
      </div>

      {isSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', width: '400px', borderRadius: '8px', border: '1px solid var(--border-main)', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1rem', marginBottom: '20px' }}>Global Settings</h2>
            
            {(() => {
              const inputStyle: React.CSSProperties = { 
                width: '100%', 
                height: '36px',
                padding: '0 10px', 
                backgroundColor: '#222', 
                color: 'white', 
                border: '1px solid #444', 
                borderRadius: '4px', 
                boxSizing: 'border-box',
                fontSize: '0.8rem',
                outline: 'none',
                WebkitAppearance: 'none', // For Electron/Chromium consistency
                appearance: 'none'
              };

              return (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>Provider</label>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={provider} 
                        onChange={(e) => setSettings({ provider: e.target.value as AIProvider })} 
                        style={{ ...inputStyle, cursor: 'pointer', paddingRight: '24px' }}
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="moonshot">Moonshot</option>
                        <option value="custom">Custom (OpenAI Compatible)</option>
                      </select>
                      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#666', fontSize: '0.6rem' }}>▼</div>
                    </div>
                  </div>

                  {provider === 'custom' && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>Base URL</label>
                      <input 
                        type="text" 
                        value={customBaseUrl} 
                        placeholder="https://api.your-provider.com/v1/chat/completions" 
                        onChange={(e) => setSettings({ customBaseUrl: e.target.value })} 
                        style={inputStyle} 
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>API Key</label>
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

            <button onClick={() => setIsSettingsOpen(false)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}>CLOSE</button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(59, 130, 246, 0.6); } 100% { transform: scale(1); } }
        .pulse-button { animation: pulse 1.5s infinite ease-in-out; }
        .spinner { border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 2px solid #fff; animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
};

export default Header;
