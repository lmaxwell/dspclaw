import React, { useState, useEffect, useCallback } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  unit?: string;
}

export const Knob: React.FC<KnobProps> = ({ label, value, min, max, step, onChange, unit }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startValue, setStartValue] = useState(0);

  const rotation = ((value - min) / (max - min)) * 270 - 135;
  const percent = (value - min) / (max - min);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartValue(value);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const pixelsPerRange = 300; 
    const diff = startY - e.clientY;
    const range = max - min;
    let newValue = startValue + (diff / pixelsPerRange) * range;
    if (step > 0) newValue = Math.round(newValue / step) * step;
    newValue = Math.min(max, Math.max(min, newValue));
    onChange(Number(newValue.toFixed(3)));
  }, [isDragging, startY, startValue, min, max, step, onChange]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '6px', 
      minWidth: '80px',
      padding: '8px 4px',
      userSelect: 'none'
    }}>
      <div 
        onMouseDown={handleMouseDown}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#0a0a0c',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.9), 0 1px 1px rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'ns-resize',
          position: 'relative'
        }}
      >
        {/* Progress Ring (Industry Style) */}
        <svg style={{ position: 'absolute', transform: 'rotate(135deg)', width: '100%', height: '100%' }}>
          <circle cx="24" cy="24" r="20" fill="none" stroke="#1a1a1e" strokeWidth="4" />
          <circle 
            cx="24" cy="24" r="20" fill="none" 
            stroke={isDragging ? '#60a5fa' : '#3b82f6'}
            strokeWidth="4" 
            strokeDasharray={`${percent * 94.2}, 125.6`}
            strokeLinecap="round"
            style={{ 
              transition: isDragging ? 'none' : 'stroke-dasharray 0.15s ease-out',
              filter: `drop-shadow(0 0 4px ${isDragging ? 'rgba(96, 165, 250, 0.8)' : 'rgba(59, 130, 246, 0.5)'})`
            }}
          />
        </svg>

        {/* Knob Body (Metallic) */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #3a3a3e 0%, #4a4a4e 25%, #2a2a2e 50%, #4a4a4e 75%, #3a3a3e 100%)',
          boxShadow: '0 6px 12px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(${rotation}deg)`,
          position: 'relative',
          border: '1px solid #111'
        }}>
          {/* Machined Texture */}
          <div style={{
            position: 'absolute',
            inset: '0',
            borderRadius: '50%',
            background: 'repeating-radial-gradient(circle, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 3px)',
            pointerEvents: 'none'
          }} />
          
          {/* Indicator Needle */}
          <div style={{
            position: 'absolute',
            top: '3px',
            width: '3px',
            height: '10px',
            backgroundColor: '#fff',
            borderRadius: '1.5px',
            boxShadow: '0 0 4px rgba(255,255,255,0.8)',
            zIndex: 2
          }} />
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%' }}>
        <span style={{ 
          fontSize: '0.6rem', 
          fontWeight: 900, 
          color: '#777', 
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          textShadow: '0 1px 0 rgba(0,0,0,0.5)',
          maxWidth: '75px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }} title={label}>{label}</span>
        
        {/* OLED Value Display */}
        <div style={{
          background: '#050505',
          padding: '2px 6px',
          borderRadius: '3px',
          border: '1px solid #222',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
          minWidth: '45px',
          textAlign: 'center'
        }}>
          <span style={{ 
            fontSize: '0.7rem', 
            color: isDragging ? '#fff' : '#3b82f6', 
            fontWeight: 800,
            fontFamily: '"JetBrains Mono", "Courier New", monospace',
            letterSpacing: '0.01em',
            textShadow: isDragging ? '0 0 6px rgba(255,255,255,0.5)' : 'none'
          }}>
            {value}<span style={{ fontSize: '0.5rem', opacity: 0.5, marginLeft: '1px' }}>{unit}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
