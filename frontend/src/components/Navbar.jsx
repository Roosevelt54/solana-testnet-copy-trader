import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-green-500/10 text-green-400' : 'text-gray-400 hover:text-gray-200'}`;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <nav style={{ backgroundColor: '#0d1117', borderBottom: '1px solid #21262d' }}>
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-green-400 font-bold tracking-widest text-sm">◎ COPY TRADER</span>
        {user && (
          <div className="flex gap-1">
            <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
            <NavLink to="/wallets" className={link}>Wallets</NavLink>
            <NavLink to="/trades" className={link}>Trades</NavLink>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{user.user_metadata?.username || user.email}</span>
            <button onClick={handleSignOut} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}
