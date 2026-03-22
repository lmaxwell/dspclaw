import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Knob } from './Knob';
import { Menu } from './Menu';

const FaustUIPanel: React.FC = () => {
  const { getActiveSession } = useStore();
  const session = getActiveSession();
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!session) return;
    const initialValues: Record<string, number> = {};
    const walk = (items: any[]) => {
      for (const item of items) {
        if (item.items) {
          walk(item.items);
        } else if (item.address) {
          initialValues[item.address] = item.init;
        }
      }
    };
    walk(session.uiLayout);
    setValues(initialValues);
  }, [session?.uiLayout, session?.id]);

  const handleParamChange = (address: string, value: number) => {
    if (session?.dspNode) {
      session.dspNode.setParamValue(address, value);
      setValues(prev => ({ ...prev, [address]: value }));
    }
  };

  const parseMetadata = (item: any) => {
    const label = item.label || '';
    const meta = item.meta || [];
    
    // Helper to find a meta value by key
    const findMeta = (key: string) => {
      const entry = meta.find((m: any) => m[key] !== undefined);
      return entry ? entry[key] : null;
    };

    const unitMatch = label.match(/\[unit:(.*?)\]/);
    const styleMatch = label.match(/\[style:(.*?)\]/);
    
    const unit = findMeta('unit') || (unitMatch ? unitMatch[1] : '');
    const styleStr = findMeta('style') || (styleMatch ? styleMatch[1] : '');
    const cleanLabel = label.replace(/\[.*?\]/g, '').trim();
    
    let menuOptions: { label: string; value: number }[] | null = null;
    
    if (styleStr && styleStr.startsWith('menu')) {
      const optionsMatch = styleStr.match(/menu\{(.*?)\}/);
      if (optionsMatch) {
        menuOptions = optionsMatch[1].split(';').map((opt: string) => {
          const [l, v] = opt.split(':');
          return {
            label: l.replace(/'/g, '').trim(),
            value: parseFloat(v)
          };
        });
      }
    }

    return { cleanLabel, unit, style: styleStr, menuOptions };
  };

  const renderItem = (item: any): React.ReactNode => {
    const labelLower = item.label?.toLowerCase() || '';
    const isWrapperGroup = labelLower.includes('polyphonic') || labelLower.includes('voices') || labelLower === 'poly' || labelLower === 'faustdsp';

    if (item.type === 'vgroup' || item.type === 'hgroup' || item.type === 'tgroup') {
      if (isWrapperGroup) {
        return <React.Fragment key={item.label}>{item.items.map(renderItem)}</React.Fragment>;
      }

      return (
        <div key={item.label} style={{
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '28px 10px 10px 10px',
          backgroundColor: '#18181a',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '8px',
          position: 'relative',
          marginTop: '12px',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 8px 16px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          flex: '1 1 auto',
          minWidth: '140px',
          maxWidth: '100%',
          borderTop: '2px solid #444'
        }}>
          <div style={{
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            height: '22px',
            backgroundColor: '#222225',
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: '0.6rem',
            fontWeight: 900,
            color: '#888',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            borderTopLeftRadius: '3px',
            borderTopRightRadius: '3px',
            pointerEvents: 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', marginRight: '8px', boxShadow: '0 0 4px var(--accent)' }} />
            {item.label}
          </div>
          {item.items.map(renderItem)}
        </div>
      );
    }

    const { cleanLabel, unit, style, menuOptions } = parseMetadata(item);
    const currentValue = values[item.address] ?? item.init;
    const isCheck = item.type === 'checkbox';
    const isButton = item.type === 'button';
    
    // Check if it's a menu
    if (menuOptions) {
      return (
        <Menu 
          key={item.address}
          label={cleanLabel}
          value={currentValue}
          options={menuOptions}
          onChange={(val) => handleParamChange(item.address, val)}
        />
      );
    }

    const isKnob = style === 'knob' || (item.min !== undefined && !isCheck && !isButton);

    if (isKnob) {
      return (
        <div key={item.address} style={{ flex: '0 0 auto' }}>
          <Knob 
            label={cleanLabel}
            value={currentValue}
            min={item.min}
            max={item.max}
            step={item.step}
            unit={unit}
            onChange={(val) => handleParamChange(item.address, val)}
          />
        </div>
      );
    }

    return (
      <div key={item.address} style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '8px', 
        backgroundColor: '#0a0a0c',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #222',
        minHeight: '36px',
        flex: '1 1 140px',
        maxWidth: '320px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
      }}>
        <span style={{ fontSize: '0.55rem', fontWeight: 900, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
          {cleanLabel}
        </span>
        {isCheck ? (
          <input 
            type="checkbox" 
            checked={currentValue === 1}
            onChange={(e) => handleParamChange(item.address, e.target.checked ? 1 : 0)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        ) : isButton ? (
          <button 
            onMouseDown={() => handleParamChange(item.address, 1)}
            onMouseUp={() => handleParamChange(item.address, 0)}
            onMouseLeave={() => handleParamChange(item.address, 0)}
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.6rem', 
              backgroundColor: currentValue === 1 ? 'var(--accent)' : '#333338', 
              border: '1px solid #444',
              color: '#fff',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: 900,
              textTransform: 'uppercase',
              marginLeft: 'auto',
              boxShadow: currentValue === 1 ? '0 0 8px var(--accent-glow)' : '0 2px 4px rgba(0,0,0,0.3)',
              transition: 'all 0.1s',
              letterSpacing: '0.05em'
            }}
          >
            {currentValue === 1 ? 'ON' : 'Go'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <input 
              type="range" 
              min={item.min} max={item.max} step={item.step} 
              value={currentValue}
              onChange={(e) => handleParamChange(item.address, parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 800, minWidth: '35px', textAlign: 'right', fontFamily: '"JetBrains Mono", monospace' }}>
              {currentValue}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="panel-container" style={{ border: 'none', background: '#121214' }}>
      <div className="panel-header" style={{ borderBottom: '2px solid #000', height: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>UI - {session?.name || 'STANDBY'}</span>
        </div>
      </div>
      <div className="panel-content" style={{ 
        padding: '16px', 
        background: 'radial-gradient(circle at center, #252529 0%, #121214 100%)',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        justifyContent: 'center',
        gap: '12px',
        overflowY: 'auto'
      }}>
        {session?.uiLayout && session.uiLayout.length > 0 ? (
          session.uiLayout.map(renderItem)
        ) : (
          <div style={{ 
            color: '#333', 
            textAlign: 'center', 
            width: '100%', 
            marginTop: '80px', 
            fontSize: '0.7rem',
            letterSpacing: '0.3em',
            fontWeight: 900
          }}>
            SYSTEM STANDBY
          </div>
        )}
      </div>
    </div>
  );
};

export default FaustUIPanel;
