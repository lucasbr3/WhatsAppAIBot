import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Brain, Music, Phone, Users, ScrollText, LogOut, Menu, X } from 'lucide-react';
import { logout } from '../api/client';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conversations', icon: MessageSquare, label: 'Conversas' },
  { to: '/users', icon: Users, label: 'Usuários' },
  { to: '/music', icon: Music, label: 'Música' },
  { to: '/calls', icon: Phone, label: 'Chamadas' },
  { to: '/ai', icon: Brain, label: 'Inteligência Artificial' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen(true)}>
        <Menu size={22} />
      </button>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <MessageSquare size={22} color="#7c5cfc" />
          WhatsApp AI Bot
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setOpen(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout}>
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </>
  );
}
