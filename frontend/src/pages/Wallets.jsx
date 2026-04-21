import React, { useEffect, useState } from 'react';
import { getWallets, addWallet, removeWallet, getWalletPnl, updateWalletSol } from '../api';

const fmt = n => n == null ? '—' : (n < 0 ? '-$' : '+$') + Math.abs(n).toFixed(2);
const short = a => a.slice(0, 4) + '...' + a.slice(-4);

function SolModal({ wallet, onClose, onSave }) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('deposit');
  const [error, setError] = useState('');

  async function handleSave() {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Enter a valid amount'); return; }
    const newSol = mode === 'deposit'
      ? wallet.virtual_sol + val
      : Math.max(0, wallet.virtual_sol - val);
    if (mode === 'withdraw' && val > wallet.virtual_sol) { setError('Insufficient virtual SOL'); return; }
    await onSave(wallet.id, newSol);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-6 w-80 space-y-4">
        <p className="text-sm font-semibold text-gray-200">Manage Virtual SOL</p>
        <p className="text-xs text-gray-500">Current: ◎{wallet.virtual_sol.toFixed(4)}</p>
        <div className="flex rounded-lg overflow-hidden border border-[#21262d]">
          {['deposit', 'withdraw'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${mode === m ? 'bg-green-500/10 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
        <input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="any" placeholder="Amount in SOL"
          className="w-full bg-black/30 border border-[#21262d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium hover:bg-green-500/20">Save</button>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function WalletCard({ wallet, onRemove, onUpdateSol }) {
  const [pnl, setPnl] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [currentSol, setCurrentSol] = useState(wallet.virtual_sol);

  useEffect(() => { getWalletPnl(wallet.id).then(setPnl).catch(() => {}); }, [wallet.id]);

  const totalColor = !pnl?.total_pnl ? 'text-gray-400' : pnl.total_pnl >= 0 ? 'text-green-400' : 'text-red-400';

  async function handleSolUpdate(id, newSol) {
    await onUpdateSol(id, newSol);
    setCurrentSol(newSol);
  }

  return (
    <>
      {showModal && <SolModal wallet={{ ...wallet, virtual_sol: currentSol }} onClose={() => setShowModal(false)} onSave={handleSolUpdate} />}
      <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-200">{wallet.label || 'Unnamed'}</p>
            <a href={`https://solscan.io/account/${wallet.address}`} target="_blank" rel="noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 font-mono">{short(wallet.address)}</a>
          </div>
          <button onClick={() => onRemove(wallet.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Virtual SOL</p>
            <p className="text-sm font-medium text-gray-300">◎{currentSol.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total PnL</p>
            <p className={`text-sm font-semibold ${totalColor}`}>{fmt(pnl?.total_pnl)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Win Rate</p>
            <p className="text-sm font-medium text-blue-400">{pnl?.win_rate ?? '—'}%</p>
          </div>
        </div>

        <div className="flex gap-4 text-xs text-gray-600">
          <span>{pnl?.open_count ?? 0} open</span>
          <span>{pnl?.closed_count ?? 0} closed</span>
          <span>Unrealized {fmt(pnl?.unrealized_pnl)}</span>
        </div>

        {pnl?.open_trades?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Open Positions</p>
            {pnl.open_trades.map(t => {
              const pnlColor = (t.unrealized_pnl_usd || 0) >= 0 ? 'text-green-400' : 'text-red-400';
              return (
                <div key={t.id} className="flex justify-between text-xs py-1" style={{ borderBottom: '1px solid #21262d' }}>
                  <span className="text-gray-300 font-medium">{t.token_in_symbol} → {t.token_out_symbol}</span>
                  <span className={pnlColor}>{fmt(t.unrealized_pnl_usd)}</span>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={() => setShowModal(true)}
          className="w-full py-1.5 rounded-lg text-xs text-gray-400 border border-[#21262d] hover:border-green-500/30 hover:text-green-400 transition-colors">
          Manage Virtual SOL
        </button>
      </div>
    </>
  );
}

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => getWallets().then(setWallets).catch(() => {});
  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault(); setError('');
    if (!address.trim()) return;
    setLoading(true);
    try { await addWallet(address.trim(), label.trim()); setAddress(''); setLabel(''); await load(); }
    catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleRemove(id) {
    if (!confirm('Remove this wallet and all its trades?')) return;
    await removeWallet(id); await load();
  }

  async function handleUpdateSol(id, newSol) {
    await updateWalletSol(id, newSol);
    await load();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-gray-200">Copy Wallets</h1>
      <form onSubmit={handleAdd} style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-5 space-y-4">
        <p className="text-sm font-medium text-gray-300">Add Wallet to Copy Trade</p>
        <div className="flex flex-col md:flex-row gap-3">
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Solana wallet address (base58)"
            className="flex-1 bg-black/30 border border-[#21262d] rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-mono" />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional)"
            className="w-40 bg-black/30 border border-[#21262d] rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500/50" />
          <button type="submit" disabled={loading}
            className="px-5 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium transition-colors disabled:opacity-40">
            {loading ? 'Adding...' : '+ Add'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <p className="text-xs text-gray-600">Paste any mainnet Solana wallet. Future Jupiter/Raydium swaps will be mirrored with 1 virtual SOL.</p>
      </form>

      {!wallets.length ? (
        <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-10 text-center text-gray-600 text-sm">
          No wallets yet. Add one above to start copy trading.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wallets.map(w => <WalletCard key={w.id} wallet={w} onRemove={handleRemove} onUpdateSol={handleUpdateSol} />)}
        </div>
      )}
    </div>
  );
}
