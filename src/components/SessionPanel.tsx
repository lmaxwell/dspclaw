import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Plus, Music, Waves, Trash2, Settings2, Keyboard, Disc, Play, Pause, Volume2 } from 'lucide-react';

import { IS_ELECTRON_APP } from '../utils/env';
import { compileAndRun } from '../agent/tools/compile_and_run';

const SessionPanel: React.FC = () => {
  const { 
    sessions, 
    activeSessionId, 
    addSession, 
    switchSession, 
    deleteSession, 
    renameSession,
    updateActiveSession,
    midiDevices,
    lastMidiNote,
    isAudioRunning,
    getAudioCtx,
    isInitialized
  } = useStore();

  const [availableSamples, setAvailableSamples] = useState<{name: string, url: string}[]>([
    { name: "STAY A WHILE", url: "./audio/stay-a-while.mp3" }
  ]);

  useEffect(() => {
    const loadSamples = async () => {
      if (IS_ELECTRON_APP) {
        try {
          const files = await (window as any).ipcRenderer.invoke('list-audio-files');
          if (files && files.length > 0) {
            setAvailableSamples(files);
          }
        } catch (e) {
          console.error("Failed to load local samples:", e);
        }
      } else {
        // Web fallback
        setAvailableSamples([
          { name: "STAY A WHILE", url: "./audio/stay-a-while.mp3" },
          { name: "DRY DRUMS", url: "./audio/dry_drums.wav" },
          { name: "CLEAN GUITAR", url: "./audio/clean_guitar.wav" },
          { name: "SYNTH CHORDS", url: "./audio/synth_chords.wav" },
          { name: "FULL MIX", url: "./audio/full_mix.wav" }
        ]);
      }
    };
    loadSamples();
  }, []);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditingName] = useState('');
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const startEditing = (s: any) => {
    setEditingId(s.id);
    setEditingName(s.name);
  };

  const saveName = () => {
    if (editingId && editName.trim()) {
      renameSession(editingId, editName.trim());
    }
    setEditingId(null);
  };
  const dspNode = activeSession?.dspNode;

  const triggerAutoCompile = async () => {
    if (isInitialized) {
      try {
        await compileAndRun.execute!({ __sessionId: activeSessionId }, {} as any);
      } catch (e) {
        console.error("Auto-compile failed:", e);
      }
    }
  };

  const handleAddSession = (name: string, type: 'poly' | 'mono') => {
    addSession(name, type);
    setIsAdding(false);
    setTimeout(triggerAutoCompile, 50);
  };

  // Audio Playback State (Local UI state, synced with session)
  const [isPlayingRef, setIsPlayingRef] = useState(false);
  const [isRefLoading, setIsRefLoading] = useState(false);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  // Stop audio ONLY if session changes. URL change will trigger smooth reload.
  useEffect(() => {
    stopRefAudio();
    bufferRef.current = null;
  }, [activeSessionId]);

  // Handle URL change: If playing, reload and restart without toggling off
  useEffect(() => {
    if (isPlayingRef && activeSession?.audioInputUrl && activeSession.type === 'mono') {
      startRefAudio();
    }
  }, [activeSession?.audioInputUrl]);

  // Reconnect audio input if dspNode changes (e.g. after compilation)
  useEffect(() => {
    if (isPlayingRef && dspNode && gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
        gainNodeRef.current.connect(dspNode);
      } catch (e) {
        console.error("Failed to reconnect audio input:", e);
      }
    }
  }, [dspNode, isPlayingRef]);

  const stopRefAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      try {
        gainNodeRef.current.disconnect();
      } catch (e) {}
      gainNodeRef.current = null;
    }
    setIsPlayingRef(false);
  };

  const startRefAudio = async () => {
    if (!activeSession?.dspNode || !isAudioRunning) return;
    const audioCtx = getAudioCtx();

    setIsRefLoading(true);
    try {
      // 1. Load the new buffer
      if (!bufferRef.current || (bufferRef.current as any).label !== activeSession.audioInputUrl) {
        const response = await fetch(activeSession.audioInputUrl);
        const arrayBuffer = await response.arrayBuffer();
        bufferRef.current = await audioCtx.decodeAudioData(arrayBuffer);
        (bufferRef.current as any).label = activeSession.audioInputUrl;
      }
      
      // 2. Stop existing source if any
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); sourceNodeRef.current.disconnect(); } catch(e) {}
      }

      // 3. Create new source
      const source = audioCtx.createBufferSource();
      source.buffer = bufferRef.current;
      source.loop = true;
      
      // 4. Create or reuse gain node
      if (!gainNodeRef.current) {
        const gain = audioCtx.createGain();
        gain.gain.value = activeSession.audioInputVolume;
        gainNodeRef.current = gain;
      }
      
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(activeSession.dspNode);
      source.start(0);
      
      sourceNodeRef.current = source;
      setIsPlayingRef(true);
    } catch (e) {
      console.error("Ref Audio Error:", e);
      setIsPlayingRef(false);
    } finally {
      setIsRefLoading(false);
    }
  };

  const toggleRefAudio = async () => {
    if (isPlayingRef) {
      stopRefAudio();
    } else {
      await startRefAudio();
    }
  };

  const handleVolumeChange = (val: number) => {
    updateActiveSession({ audioInputVolume: val });
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = val;
    }
  };

  return (
    <div className="panel-container" style={{ height: '100%', borderRight: '1px solid var(--border-main)', backgroundColor: 'var(--bg-app)' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '40px', boxSizing: 'border-box' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.15em' }}>SESSIONS</span>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '4px' }}
          className="icon-hover"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="panel-content" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {isAdding && (
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-main)', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: '10px', letterSpacing: '0.05em' }}>NEW SESSION TYPE</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleAddSession('New Synth', 'poly')}
                style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--accent)', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Music size={12} /> SYNTH
              </button>
              <button 
                onClick={() => handleAddSession('New Effect', 'mono')}
                style={{ flex: 1, padding: '8px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#10b981', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Waves size={12} /> EFFECT
              </button>
            </div>
          </div>
        )}

        {sessions.map(s => {
          const isActive = s.id === activeSessionId;
          return (
            <div 
              key={s.id}
              onClick={() => switchSession(s.id)}
              onDoubleClick={() => startEditing(s)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'all 0.15s ease',
                position: 'relative',
                border: isActive ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.015)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isActive && (
                <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '2px', backgroundColor: 'var(--accent)', borderRadius: '0 2px 2px 0' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <div style={{ opacity: isActive ? 1 : 0.5 }}>
                    {s.type === 'poly' ? <Music size={14} color="var(--accent)" /> : <Waves size={14} color="#10b981" />}
                  </div>
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--accent)',
                        color: 'white',
                        fontSize: '0.9rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ 
                      fontSize: '0.9rem', 
                      fontWeight: isActive ? 700 : 500, 
                      color: isActive ? 'var(--text-main)' : 'var(--text-dim)',
                      letterSpacing: '0.01em'
                    }}>
                      {s.name}
                    </span>
                  )}
                </div>
                {sessions.length > 1 && isActive && editingId !== s.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', opacity: 0.5, cursor: 'pointer', padding: '4px' }}
                    className="icon-hover"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {activeSession && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-main)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-dim)', opacity: 0.6 }}>
              <Settings2 size={12} />
              <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.1em' }}>ROUTING</span>
            </div>

            {activeSession.type === 'poly' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>MIDI SOURCE</span>
                    {lastMidiNote !== null && (
                      <div style={{ 
                        backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '0.7rem', 
                        padding: '1px 6px', borderRadius: '4px', fontWeight: 800,
                        display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--accent-glow)'
                      }}>
                        <Music size={8} /> {lastMidiNote}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-main)' }}>
                    <Keyboard size={14} color="var(--accent)" style={{ opacity: 0.7 }} />
                    <select 
                      value={activeSession.midiInputId}
                      onChange={(e) => updateActiveSession({ midiInputId: e.target.value })}
                      style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                      <option value="none" style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>None</option>
                      <option value="keyboard" style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>Computer Keyboard</option>
                      <option value="all" style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>All MIDI Devices</option>
                      {midiDevices.map(d => <option key={d.id} value={d.id} style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>{d.name}</option>)}
                    </select>
                  </div>
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>AUDIO SOURCE</span>
                    <button 
                      onClick={toggleRefAudio}
                      disabled={!isAudioRunning || isRefLoading || !activeSession.dspNode}
                      style={{ 
                        backgroundColor: isPlayingRef ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-soft)', 
                        border: isPlayingRef ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--accent-glow)', 
                        color: isPlayingRef ? '#ef4444' : 'var(--accent)', 
                        borderRadius: '50%', 
                        width: '24px', height: '24px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: (!isAudioRunning || isRefLoading || !activeSession.dspNode) ? 0.5 : 1,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {isRefLoading ? <div className="spinner" style={{ width: '10px', height: '10px' }} /> : isPlayingRef ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-main)' }}>
                    <Disc size={14} color="#10b981" style={{ opacity: 0.7 }} />
                    <select 
                      value={activeSession.audioInputUrl}
                      onChange={(e) => updateActiveSession({ audioInputUrl: e.target.value })}
                      style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                      {availableSamples.map(s => <option key={s.url} value={s.url} style={{ backgroundColor: 'var(--bg-panel)', color: 'var(--text-main)' }}>{s.name}</option>)}
                    </select>
                  </div>
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>VOLUME</span>
                     <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 800 }}>{Math.round(activeSession.audioInputVolume * 100)}%</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                     <Volume2 size={12} color="var(--text-dim)" style={{ opacity: 0.5 }} />
                     <input 
                       type="range" min="0" max="1" step="0.01" 
                       value={activeSession.audioInputVolume}
                       onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                       style={{ flex: 1, height: '3px', cursor: 'pointer', accentColor: 'var(--accent)' }} 
                     />
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        .icon-hover:hover { background-color: rgba(255,255,255,0.05) !important; color: var(--text-main) !important; }
        .spinner { border: 2px solid rgba(255,255,255,0.1); border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SessionPanel;