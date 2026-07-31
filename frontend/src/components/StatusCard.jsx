import React from 'react';

export default function StatusCard({ label, value, icon: Icon, color, sub }) {
  const bgMap = { green: 'var(--green-bg)', red: 'var(--red-bg)', blue: 'var(--blue-bg)', yellow: 'var(--yellow-bg)', accent: 'var(--accent-light)' };
  const colorMap = { green: 'var(--green)', red: 'var(--red)', blue: 'var(--blue)', yellow: 'var(--yellow)', accent: 'var(--accent)' };

  const bg = bgMap[color] || bgMap.accent;
  const clr = colorMap[color] || colorMap.accent;

  return (
    <div className="card">
      <div className="card-header">
        <span className="label">{label}</span>
        <div className="icon" style={{ background: bg, color: clr }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="card-value">{value ?? '—'}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}
