import React, { useEffect, useState } from 'react';
import { getWallets, addWallet, removeWallet, getWalletPnl } from '../api';

const fmt = n => n == null ? '—' : (n < 0 ? '-$' : '+$') + Math.abs(n).toFixed(2);
const short = a => a.slice(0, 4) + '...' + a.slice(-4);

function WalletCard({ wallet, onRemove }) {
  const [pnl, setPnl] = useState(null);
  useEffect(() => { getWalletPnl(wallet.id).then(setPnl).catch(() => {}); }, [wallet.id]);
  const totalColor = !pnl?.total_pnl ? 'text-gray-400' : pnl.total_pnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
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
        <div><p className="text-xs text-gray-500 mb-0.5">Virtual SOL</p><p className="text-sm font-medium text-gray-300">◎{wallet.virtual_sol.toFixed(2)}</p></div>
        <div><p className="text-xs text-gray-500 mb-0.5">Total PnL</p><p className={`text-sm font-semibold ${totalColor}`}>{fmt(pnl?.total_pnl)}</p></div>
        <div><p className="text-xs text-gray-500 mb-0.5">Win Rate</p><p className="text-sm font-medium text-blue-400">{pnl?.win_rate ?? '—'}%</p></div>
      </div>
      <div className="flex gap-4 text-xs text-gray-600">
        <span>{pnl?.open_count ?? 0} open</span>
        <span>{pnl?.closed_count ?? 0} closed</span>
        <span>Unrealized {fmt(pnl?.unrealized_pnl)}</span>
      </div>
    </div>
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
        <p className="text-xs text-gray-600">Paste any mainnet Solana wallet. Future Jupiter/Raydium swaps will be mirrored with your 100 virtual SOL.</p>
      </form>

      {!wallets.length ? (
        <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-10 text-center text-gray-600 text-sm">
          No wallets yet. Add one above to start copy trading.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {wallets.map(w => <WalletCard key={w.id} wallet={w} onRemove={handleRemove} />)}
        </div>
      )}
    </div>
  );
}
