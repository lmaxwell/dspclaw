import React, { useState, useEffect, useRef } from 'react';
import { useStore, type AIProvider } from '../store';
import { Play, Square, Activity, Settings, X, DownloadCloud, Github } from 'lucide-react';
import { aiFetch, isElectron } from '../utils/env';

const Header: React.FC = () => {
  const { 
    isAudioRunning, 
    setAudioRunning, 
    getAudioCtx,
    provider,
    apiKeys,
    model,
    models,
    setSettings,
    getActiveSession,
  } = useStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'downloaded'>('idle');
  
  // Track the provider for the active fetch to prevent race conditions
  const currentFetchProviderRef = useRef<string | null>(null);

  const activeSession = getActiveSession();
  const dspNode = activeSession?.dspNode;
  const apiKey = apiKeys[provider];

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

    const fetchProvider = provider;
    currentFetchProviderRef.current = fetchProvider;

    console.log(`[DSPCLAW] Fetching models for '${fetchProvider}'...`);
    
    try {
      let url = '';
      let headers: any = { 'Authorization': `Bearer ${apiKey}` };

      switch (fetchProvider) {
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
      
      // RACE CONDITION GUARD: Only update if the provider hasn't changed since we started
      if (currentFetchProviderRef.current !== fetchProvider) {
        console.warn(`[DSPCLAW] Discarding model results for ${fetchProvider} (stale)`);
        return;
      }

      let fetchedModels: string[] = [];
      if (fetchProvider === 'gemini' && response.data.models) {
        fetchedModels = response.data.models
          .filter((m: any) => !m.name.includes('gemma')) // Filter out gemma (no tool support)
          .map((m: any) => m.name.replace('models/', ''));
      } else if (response.data && response.data.data) {
        fetchedModels = response.data.data.map((m: any) => m.id);
      }

      fetchedModels.sort((a, b) => {
        const keywords = ['gpt-4', 'sonnet', 'opus', 'v3', 'chat', 'latest', 'reasoner', 'pro', 'flash'];
        const aScore = keywords.reduce((s, k) => s + (a.toLowerCase().includes(k) ? 1 : 0), 0);
        const bScore = keywords.reduce((s, k) => s + (b.toLowerCase().includes(k) ? 1 : 0), 0);
        return bScore - aScore;
      });

      setSettings({ models: fetchedModels });
      
      // If the current model isn't in the fetched list and the list isn't empty, pick the first one
      if (fetchedModels.length > 0 && !fetchedModels.includes(model)) {
        setSettings({ model: fetchedModels[0] });
      }
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
      if (currentFetchProviderRef.current === fetchProvider) {
        setSettings({ models: [] });
      }
    }
  };

  useEffect(() => {
    if (apiKey && isSettingsOpen) {
      fetchModels();
    }
  }, [apiKey, provider, isSettingsOpen]);

  // SILENT START logic remains the same...
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
    <header style={{ height: '48px', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between', zIndex: 100, gap: '12px', WebkitAppRegion: 'drag' as any }}>
      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--accent)" />
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--text-main)' }}>DSPCLAW</span>
        </div>
        <a href="https://github.com/lmaxwell/dspclaw" target="_blank" rel="noopener noreferrer" style={{ color: '#555', display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' as any }}>
          <Github size={16} />
        </a>
      </div>

      <div style={{ flex: '2 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppRegion: 'no-drag' as any }}>
        <button onClick={handleToggleAudio} style={{ position: 'relative', backgroundColor: '#1a1a1e', backgroundImage: 'linear-gradient(180deg, #2d2d33 0%, #1a1a1e 100%)', color: '#fff', border: '1px solid #000', borderTop: '1px solid #444', borderRadius: '4px', padding: '6px 20px', fontSize: '0.85rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: '160px', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)', transition: 'all 0.05s ease', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isAudioRunning ? '#3b82f6' : '#222', boxShadow: isAudioRunning ? `0 0 10px rgba(59, 130, 246, 0.6)` : 'none', border: '1px solid #000' }} />
          <span style={{ color: isAudioRunning ? '#fff' : '#888', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isAudioRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            {isAudioRunning ? 'STOP ENGINE' : 'START ENGINE'}
          </span>
        </button>
      </div>

      <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', WebkitAppRegion: 'no-drag' as any }}>
        {updateStatus === 'downloaded' && <button onClick={handleInstallUpdate} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.75rem', fontWeight: 'bold' }}><DownloadCloud size={12} /> RESTART</button>}
        <button onClick={() => setIsSettingsOpen(true)} style={{ background: 'none', color: '#555', border: 'none', cursor: 'pointer' }}><Settings size={18} /></button>
      </div>

      {isSettingsOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1a1a1e', width: '400px', borderRadius: '10px', border: '1px solid var(--border-main)', padding: '24px', position: 'relative' }}>
            <button onClick={() => setIsSettingsOpen(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', fontWeight: 800 }}>Global Settings</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>AI PROVIDER</label>
              <select value={provider} onChange={(e) => setSettings({ provider: e.target.value as AIProvider })} style={{ width: '100%', height: '40px', padding: '0 12px', backgroundColor: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '1rem', outline: 'none' }}>
                <option value="moonshot">Kimi (Moonshot)</option>
                <option value="gemini">Gemini (Google)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="glm">GLM (Zhipu AI)</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>MODEL</label>
              <select value={model} onChange={(e) => setSettings({ model: e.target.value })} style={{ width: '100%', height: '40px', padding: '0 12px', backgroundColor: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '1rem', outline: 'none' }}>
                {models.length > 0 ? models.map(m => <option key={m} value={m}>{m}</option>) : <option value={model}>{model || (apiKey ? 'Fetching...' : 'Enter API Key first')}</option>}
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>API KEY</label>
              <input type="password" value={apiKey || ''} onChange={(e) => setSettings({ apiKey: e.target.value })} style={{ width: '100%', height: '40px', padding: '0 12px', backgroundColor: '#111', color: 'white', border: '1px solid #333', borderRadius: '4px', fontSize: '1rem', outline: 'none' }} />
            </div>

            <button onClick={() => setIsSettingsOpen(false)} style={{ width: '100%', padding: '12px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 800, cursor: 'pointer', fontSize: '1rem' }}>CLOSE</button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;