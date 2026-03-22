import React from 'react';

interface MenuProps {
  label: string;
  value: number;
  options: { label: string; value: number }[];
  onChange: (value: number) => void;
}

export const Menu: React.FC<MenuProps> = ({ label, value, options, onChange }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      backgroundColor: '#0a0a0c',
      padding: '8px 12px',
      borderRadius: '4px',
      border: '1px solid #222',
      minHeight: '48px',
      width: '140px',
      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
      position: 'relative'
    }}>
      <span style={{ 
        fontSize: '0.55rem', 
        fontWeight: 900, 
        color: '#555', 
        textTransform: 'uppercase', 
        letterSpacing: '0.1em',
        marginBottom: '2px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {label}
      </span>
      
      <div style={{ position: 'relative', width: '100%' }}>
        <select
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            backgroundColor: '#1a1a1e',
            color: 'var(--accent)',
            border: '1px solid #333',
            borderRadius: '3px',
            padding: '4px 24px 4px 8px',
            fontSize: '0.7rem',
            fontWeight: 700,
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            outline: 'none',
            fontFamily: 'inherit',
            textOverflow: 'ellipsis'
          }}
        >
          {options.map((opt, i) => (
            <option key={i} value={opt.value} style={{ backgroundColor: '#1a1a1e', color: 'white' }}>
              {opt.label}
            </option>
          ))}
        </select>
        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          fontSize: '0.5rem',
          color: '#555'
        }}>
          ▼
        </div>
      </div>
    </div>
  );
};
