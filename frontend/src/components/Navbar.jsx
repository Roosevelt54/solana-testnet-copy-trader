import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const link = ({ isActive }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:text-gray-200'}`;

  return (
    <nav style={{ backgroundColor: '#0d1117', borderBottom: '1px solid #21262d' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-green-400 font-bold tracking-widest text-sm">◎ COPY TRADER</span>
        <div className="flex gap-1">
          <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
          <NavLink to="/wallets" className={link}>Wallets</NavLink>
          <NavLink to="/trades" className={link}>Trades</NavLink>
        </div>
      </div>
    </nav>
  );
}
