import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { Plus, Music, Waves, Trash2, Settings2, Keyboard, Disc, Play, Pause, Volume2 } from 'lucide-react';

import { isElectron } from '../utils/env';

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
      if (isElectron) {
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
    if (isInitialized && (window as any).mcpClient) {
      try {
        await (window as any).mcpClient.callTool({
          name: "compile_and_run",
          arguments: {}
        });
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

  // Stop audio if session changes
  useEffect(() => {
    stopRefAudio();
  }, [activeSessionId]);

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
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlayingRef(false);
  };

  const toggleRefAudio = async () => {
    if (!activeSession?.dspNode || !isAudioRunning) return;
    const audioCtx = getAudioCtx();
    
    if (isPlayingRef) {
      stopRefAudio();
      return;
    }

    setIsRefLoading(true);
    try {
      if (!bufferRef.current || (bufferRef.current as any).label !== activeSession.audioInputUrl) {
        const response = await fetch(activeSession.audioInputUrl);
        const arrayBuffer = await response.arrayBuffer();
        bufferRef.current = await audioCtx.decodeAudioData(arrayBuffer);
        (bufferRef.current as any).label = activeSession.audioInputUrl;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = bufferRef.current;
      source.loop = true;
      
      const gain = audioCtx.createGain();
      gain.gain.value = activeSession.audioInputVolume;
      gainNodeRef.current = gain;
      
      source.connect(gain);
      gain.connect(activeSession.dspNode);
      source.start(0);
      
      sourceNodeRef.current = source;
      setIsPlayingRef(true);
    } catch (e) {
      console.error("Ref Audio Error:", e);
    } finally {
      setIsRefLoading(false);
    }
  };

  const handleVolumeChange = (val: number) => {
    updateActiveSession({ audioInputVolume: val });
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = val;
    }
  };

  return (
    <div className="panel-container" style={{ height: '100%', borderRight: '1px solid var(--border-main)', backgroundColor: 'var(--bg-header)' }}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.1em' }}>SESSIONS</span>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="panel-content" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isAdding && (
          <div style={{ backgroundColor: '#222', padding: '10px', borderRadius: '4px', border: '1px solid #333', marginBottom: '10px' }}>
            <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '8px' }}>NEW SESSION TYPE</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={() => handleAddSession('New Synth', 'poly')}
                style={{ flex: 1, padding: '6px', fontSize: '0.6rem', backgroundColor: '#3b82f6', border: 'none', color: 'white', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Music size={10} /> SYNTH
              </button>
              <button 
                onClick={() => handleAddSession('New Effect', 'mono')}
                style={{ flex: 1, padding: '6px', fontSize: '0.6rem', backgroundColor: '#10b981', border: 'none', color: 'white', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Waves size={10} /> EFFECT
              </button>
            </div>
          </div>
        )}

        {sessions.map(s => (
          <div 
            key={s.id}
            onClick={() => switchSession(s.id)}
            onDoubleClick={() => startEditing(s)}
            style={{
              padding: '10px',
              borderRadius: '6px',
              backgroundColor: s.id === activeSessionId ? '#333' : 'transparent',
              border: `1px solid ${s.id === activeSessionId ? '#444' : 'transparent'}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                {s.type === 'poly' ? <Music size={12} color="#3b82f6" /> : <Waves size={12} color="#10b981" />}
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
                      backgroundColor: '#111',
                      border: '1px solid var(--accent)',
                      color: 'white',
                      fontSize: '0.75rem',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.id === activeSessionId ? 'white' : '#888' }}>{s.name}</span>
                )}
              </div>
              {sessions.length > 1 && s.id === activeSessionId && editingId !== s.id && (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        ))}

        {activeSession && (
          <div style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#666' }}>
              <Settings2 size={12} />
              <span style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.05em' }}>INPUT ROUTING</span>
            </div>

            {activeSession.type === 'poly' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: '#555' }}>MIDI SOURCE</span>
                    {lastMidiNote !== null && (
                      <div style={{ 
                        backgroundColor: '#3b82f6', color: 'white', fontSize: '0.6rem', 
                        padding: '1px 5px', borderRadius: '4px', fontWeight: 800,
                        display: 'flex', alignItems: 'center', gap: '3px'
                      }}>
                        <Music size={8} /> {lastMidiNote}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1a1a1a', padding: '6px', borderRadius: '4px', border: '1px solid #333' }}>
                    <Keyboard size={12} color="#3b82f6" />
                    <select 
                      value={activeSession.midiInputId}
                      onChange={(e) => updateActiveSession({ midiInputId: e.target.value })}
                      style={{ flex: 1, background: 'none', border: 'none', color: '#ccc', fontSize: '0.7rem', outline: 'none' }}
                    >
                      <option value="none">None</option>
                      <option value="keyboard">Computer Keyboard</option>
                      <option value="all">All MIDI Devices</option>
                      {midiDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.6rem', color: '#555' }}>AUDIO INPUT</span>
                    <button 
                      onClick={toggleRefAudio}
                      disabled={!isAudioRunning || isRefLoading || !activeSession.dspNode}
                      style={{ 
                        backgroundColor: isPlayingRef ? '#ef4444' : '#3b82f6', 
                        border: 'none', color: 'white', borderRadius: '50%', 
                        width: '20px', height: '20px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: (!isAudioRunning || isRefLoading || !activeSession.dspNode) ? 0.5 : 1
                      }}
                    >
                      {isRefLoading ? <div className="spinner" style={{ width: '8px', height: '8px' }} /> : isPlayingRef ? <Pause size={10} fill="white" /> : <Play size={10} fill="white" />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1a1a1a', padding: '6px', borderRadius: '4px', border: '1px solid #333' }}>
                    <Disc size={12} color="#10b981" />
                    <select 
                      value={activeSession.audioInputUrl}
                      onChange={(e) => updateActiveSession({ audioInputUrl: e.target.value })}
                      style={{ flex: 1, background: 'none', border: 'none', color: '#ccc', fontSize: '0.7rem', outline: 'none' }}
                    >
                      {availableSamples.map(s => <option key={s.url} value={s.url}>{s.name}</option>)}
                    </select>
                  </div>
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.6rem', color: '#555' }}>VOLUME</span>
                     <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 800 }}>{Math.round(activeSession.audioInputVolume * 100)}%</span>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Volume2 size={12} color="#555" />
                     <input 
                       type="range" min="0" max="1" step="0.01" 
                       value={activeSession.audioInputVolume}
                       onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                       style={{ flex: 1, height: '2px', cursor: 'pointer', accentColor: 'var(--accent)' }} 
                     />
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPanel;
