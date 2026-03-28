import { useStore } from "../store";

const KEY_TO_NOTE: Record<string, number> = {
  'a': 60, 'w': 61, 's': 62, 'e': 63, 'd': 64, 'f': 65, 't': 66, 'g': 67, 'y': 68, 'h': 69, 'u': 70, 'j': 71, 'k': 72
};

const activeKeys = new Set<string>();

export const initMidi = async () => {
  const isTyping = () => {
    const el = document.activeElement;
    if (!el) return false;
    const name = el.tagName?.toLowerCase();
    if (!name) return false;
    return name === 'input' || name === 'textarea' || (el as HTMLElement).isContentEditable;
  };

  // 1. Setup Computer Keyboard MIDI
  window.addEventListener('keydown', (e) => {
    if (!e.key) return;
    if (e.repeat || isTyping()) return;
    const note = KEY_TO_NOTE[e.key.toLowerCase()];
    if (note !== undefined) {
      const store = useStore.getState();
      const session = store.getActiveSession();
      if (session && (session.midiInputId === 'keyboard' || session.midiInputId === 'all')) {
        activeKeys.add(e.key.toLowerCase());
        const msg = [144, note, 100]; // Note On
        session.dspNode?.midiMessage(msg);
        store.setLastMidiNote(note);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (!e.key) return;
    if (isTyping() && !activeKeys.has(e.key.toLowerCase())) return;
    const note = KEY_TO_NOTE[e.key.toLowerCase()];
    if (note !== undefined) {
      const store = useStore.getState();
      const session = store.getActiveSession();
      if (session && (session.midiInputId === 'keyboard' || session.midiInputId === 'all')) {
        activeKeys.delete(e.key.toLowerCase());
        const msg = [128, note, 0]; // Note Off
        session.dspNode?.midiMessage(msg);
        if (activeKeys.size === 0) store.setLastMidiNote(null);
      }
    }
  });

  // 2. Setup Web MIDI API
  if (!navigator.requestMIDIAccess) return;

  try {
    const midiAccess = await navigator.requestMIDIAccess();
    const updateDevices = () => {
      const inputs = Array.from(midiAccess.inputs.values()).map(input => ({
        id: input.id,
        name: input.name || "Unknown Device"
      }));
      useStore.getState().setMidiDevices(inputs);
    };

    midiAccess.onstatechange = updateDevices;
    updateDevices();

    const handleMidiMessage = (event: any) => {
      const store = useStore.getState();
      const session = store.getActiveSession();
      const input = event.currentTarget as any;
      
      if (session && (session.midiInputId === 'all' || session.midiInputId === input.id)) {
        const data = Array.from(event.data as Uint8Array);
        session.dspNode?.midiMessage(data as any);
        
        // Update display for Note On
        if (data[0] >= 144 && data[0] <= 159 && data[2] > 0) {
          store.setLastMidiNote(data[1]);
        } else if ((data[0] >= 128 && data[0] <= 143) || (data[0] >= 144 && data[0] <= 159 && data[2] === 0)) {
          if (store.lastMidiNote === data[1]) store.setLastMidiNote(null);
        }
      }
    };

    midiAccess.inputs.forEach(input => {
      input.onmidimessage = handleMidiMessage as any;
    });

  } catch (error) {
    console.error("Could not access MIDI devices.", error);
  }
};
