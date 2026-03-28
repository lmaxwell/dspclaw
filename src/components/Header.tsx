import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Play, Square, Activity, Settings, X, DownloadCloud, Github, Plus, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { aiFetch, IS_ELECTRON_APP } from '../utils/env';

const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { provider, apiKeys, setSettings, setApiKey, customProviders, addCustomProvider, removeCustomProvider } = useStore();

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('http://localhost:11434/v1');
  
  const [testStatuses, setTestStatuses] = useState<Record<string, 'testing' | 'success' | 'error'>>({});

  const handleAddCustom = () => {
    if (customName.trim() && customUrl.trim()) {
      const id = 'custom-' + Math.random().toString(36).substr(2, 9);
      addCustomProvider({ id, name: customName.trim(), baseUrl: customUrl.trim() });
      setSettings({ provider: id });
      setIsAddingCustom(false);
      setCustomName('');
    }
  };

  const handleTestConnection = async (pId: string) => {
    setTestStatuses(prev => ({ ...prev, [pId]: 'testing' }));
    try {
      let url = '';
      const keyToTest = apiKeys[pId] || '';
      let headers: any = { 'Authorization': `Bearer ${keyToTest}` };

      if (pId === 'moonshot') url = 'https://api.moonshot.cn/v1/models';
      else if (pId === 'deepseek') url = 'https://api.deepseek.com/v1/models';
      else if (pId === 'gemini') { url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + keyToTest; headers = {}; }
      else if (pId === 'glm') url = 'https://open.bigmodel.cn/api/paas/v4/models';
      else {
        // Custom provider
        const cp = customProviders.find(p => p.id === pId);
        if (cp) {
          url = cp.baseUrl.replace(/\/$/, '') + '/models';
        }
      }

      if (!url) throw new Error("No URL");

      await aiFetch({ url, method: 'GET', headers });
      setTestStatuses(prev => ({ ...prev, [pId]: 'success' }));
      setTimeout(() => setTestStatuses(prev => ({ ...prev, [pId]: 'idle' as any })), 3000);
    } catch (error) {
      console.error(error);
      setTestStatuses(prev => ({ ...prev, [pId]: 'error' }));
      setTimeout(() => setTestStatuses(prev => ({ ...prev, [pId]: 'idle' as any })), 3000);
    }
  };

  const providersList: { id: string; name: string; isCustom?: boolean; baseUrl?: string }[] = [
    { id: 'moonshot', name: 'Kimi (Moonshot)' },
    { id: 'gemini', name: 'Gemini (Google)' },
    { id: 'deepseek', name: 'DeepSeek' },
    { id: 'glm', name: 'GLM (Zhipu AI)' },
    ...customProviders.map(p => ({ id: p.id, name: p.name + ' (Custom)', isCustom: true, baseUrl: p.baseUrl }))
  ];

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#1a1a1e', width: '560px', borderRadius: '10px', border: '1px solid var(--border-main)', padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
        <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>AI Providers</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {providersList.map(p => {
            const isSelected = provider === p.id;
            const status = testStatuses[p.id];
            const pKey = apiKeys[p.id] || '';

            return (
              <div 
                key={p.id}
                style={{
                  backgroundColor: isSelected ? '#1c1c21' : '#111',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-main)',
                  borderRadius: '8px',
                  padding: '16px',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="provider_select" 
                      checked={isSelected}
                      onChange={() => setSettings({ provider: p.id })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: isSelected ? 'var(--accent)' : 'var(--text-main)' }}>
                      {p.name}
                    </span>
                  </label>
                  {p.isCustom && (
                    <button onClick={() => removeCustomProvider(p.id)} style={{ background: 'none', border: 'none', color: '#fb7185', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {p.isCustom && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>Base URL</label>
                    <input readOnly value={p.baseUrl} style={{ width: '100%', height: '32px', padding: '0 10px', backgroundColor: '#0a0a0c', color: '#888', border: '1px solid #333', borderRadius: '4px', fontSize: '0.85rem', outline: 'none' }} />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>API Key</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="password" 
                      name={`faust-api-key-${p.id}`}
                      autoComplete="new-password"
                      data-1p-ignore
                      value={pKey} 
                      onChange={(e) => setApiKey(p.id, e.target.value)} 
                      style={{ flex: 1, height: '36px', padding: '0 12px', backgroundColor: '#0a0a0c', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '0.9rem', outline: 'none' }} 
                    />
                    <button 
                      onClick={() => handleTestConnection(p.id)}
                      disabled={status === 'testing' || !pKey}
                      style={{ 
                        height: '36px', padding: '0 16px', 
                        backgroundColor: status === 'success' ? '#10b981' : status === 'error' ? '#fb7185' : '#333', 
                        color: 'white', border: '1px solid #444', borderRadius: '4px', 
                        fontSize: '0.8rem', fontWeight: 700, cursor: pKey ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        transition: 'all 0.2s',
                        opacity: pKey ? 1 : 0.5
                      }}
                    >
                      {status === 'testing' ? <Loader2 size={14} className="animate-spin" /> : 
                       status === 'success' ? <Check size={14} /> :
                       status === 'error' ? <AlertCircle size={14} /> : 'Test'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isAddingCustom ? (
          <button 
            onClick={() => setIsAddingCustom(true)} 
            style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: '6px', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Plus size={16} /> ADD CUSTOM PROVIDER
          </button>
        ) : (
          <div style={{ backgroundColor: '#111', border: '1px solid var(--border-main)', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)' }}>NEW CUSTOM PROVIDER</div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>Name</label>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Local Ollama" style={{ width: '100%', height: '32px', padding: '0 8px', backgroundColor: '#000', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>Base URL (OpenAI Compatible)</label>
              <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="http://localhost:11434/v1" style={{ width: '100%', height: '32px', padding: '0 8px', backgroundColor: '#000', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '0.9rem', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button onClick={() => setIsAddingCustom(false)} style={{ padding: '6px 12px', background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleAddCustom} style={{ padding: '6px 12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 800, cursor: 'pointer', fontSize: '1rem', marginTop: '8px' }}>DONE</button>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const { 
    isAudioRunning, 
    setAudioRunning, 
    getAudioCtx,
    getActiveSession,
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'downloaded'>('idle');
  
  const activeSession = getActiveSession();
  const dspNode = activeSession?.dspNode;

  useEffect(() => {
    if (IS_ELECTRON_APP) {
      const ipcRenderer = (window as any).ipcRenderer;
      if (ipcRenderer) {
        ipcRenderer.on('update-available', () => setUpdateStatus('available'));
        ipcRenderer.on('update-downloaded', () => setUpdateStatus('downloaded'));
      }
    }
  }, []);

  const handleInstallUpdate = () => {
    if (IS_ELECTRON_APP) {
      (window as any).ipcRenderer.send('install-update');
    }
  };

  useEffect(() => {
    if (isAudioRunning) return;
    const handleFirstInteraction = async () => {
      const audioCtx = getAudioCtx();
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
          if (dspNode) dspNode.connect(audioCtx.destination);
          setAudioRunning(true);
        } catch (e) { console.error("[DSPCLAW] Silent init failed:", e); }
      }
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
      if (dspNode) dspNode.connect(audioCtx.destination);
      setAudioRunning(true);
    } else {
      if (dspNode) dspNode.disconnect();
      setAudioRunning(false);
    }
  };

  return (
    <header style={{ height: '48px', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between', zIndex: 100, gap: '12px', WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent)" />
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-main)' }}>DSPCLAW</span>
        </div>
        <a href="https://github.com/lmaxwell/dspclaw" target="_blank" rel="noopener noreferrer" style={{ color: '#555', display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Github size={16} />
        </a>
      </div>

      <div style={{ flex: '2 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={handleToggleAudio} style={{ position: 'relative', backgroundColor: '#1a1a1e', backgroundImage: 'linear-gradient(180deg, #2d2d33 0%, #1a1a1e 100%)', color: '#fff', border: '1px solid #000', borderTop: '1px solid #444', borderRadius: '4px', padding: '6px 20px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: '160px', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', transition: 'all 0.05s ease', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isAudioRunning ? '#3b82f6' : '#222', boxShadow: isAudioRunning ? `0 0 10px rgba(59, 130, 246, 0.6)` : 'none', border: '1px solid #000' }} />
          <span style={{ color: isAudioRunning ? '#fff' : '#888', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAudioRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {isAudioRunning ? 'STOP ENGINE' : 'START ENGINE'}
          </span>
        </button>
      </div>

      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {updateStatus === 'downloaded' && <button onClick={handleInstallUpdate} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}><DownloadCloud size={12} /> RESTART</button>}
        <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', color: '#555', border: 'none', cursor: 'pointer' }}><Settings size={18} /></button>
      </div>

      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </header>
  );
};

export default Header;