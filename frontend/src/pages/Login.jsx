import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(form.email, form.password);
      } else {
        if (!form.username.trim()) { setError('Username required'); setLoading(false); return; }
        await signUp(form.email, form.password, form.username.trim());
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#050812' }}>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-green-400 font-bold tracking-widest text-lg">◎ COPY TRADER</p>
          <p className="text-gray-500 text-xs mt-1">Solana paper trading simulator</p>
        </div>

        <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-6 space-y-5">
          <div className="flex rounded-lg overflow-hidden border border-[#21262d]">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors capitalize ${mode === m ? 'bg-green-500/10 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}>
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <input value={form.username} onChange={set('username')} placeholder="Username"
                className="w-full bg-black/30 border border-[#21262d] rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
            )}
            <input value={form.email} onChange={set('email')} placeholder="Email" type="email" required
              className="w-full bg-black/30 border border-[#21262d] rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
            <input value={form.password} onChange={set('password')} placeholder="Password" type="password" required
              className="w-full bg-black/30 border border-[#21262d] rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium transition-colors disabled:opacity-40">
              {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-xs text-gray-600 text-center">You get 1 virtual SOL per wallet you add.</p>
          )}
        </div>
      </div>
    </div>
  );
}
