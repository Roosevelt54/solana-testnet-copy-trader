import React, { useEffect, useState } from 'react';
import { getTrades, getWallets, addTrade, closeTrade } from '../api';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const fmt = n => n == null ? '—' : (n < 0 ? '-$' : '+$') + Math.abs(n).toFixed(2);
const fmtDate = ts => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtPrice = v => !v ? '—' : v < 0.001 ? v.toExponential(3) : v < 1 ? v.toFixed(5) : v.toFixed(3);

export default function Trades() {
  const [trades, setTrades] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [filterWallet, setFilterWallet] = useState('');
  const [closing, setClosing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ wallet_id: '', token_out_mint: '', token_out_amount: '', token_in_amount: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    const [t, w] = await Promise.all([getTrades(filterWallet || undefined), getWallets()]);
    setTrades(t); setWallets(w);
    if (!form.wallet_id && w.length) setForm(f => ({ ...f, wallet_id: String(w[0].id) }));
  };

  useEffect(() => { load(); }, [filterWallet]);

  async function handleClose(id) {
    setClosing(id);
    try { await closeTrade(id); await load(); } catch {}
    setClosing(null);
  }

  async function handleManualTrade(e) {
    e.preventDefault(); setFormError('');
    if (!form.wallet_id || !form.token_out_mint || !form.token_out_amount || !form.token_in_amount) {
      setFormError('All fields required'); return;
    }
    setSubmitting(true);
    try {
      await addTrade({
        wallet_id: Number(form.wallet_id),
        token_in_mint: SOL_MINT,
        token_in_amount: parseFloat(form.token_in_amount),
        token_out_mint: form.token_out_mint.trim(),
        token_out_amount: parseFloat(form.token_out_amount)
      });
      setShowForm(false);
      setForm(f => ({ ...f, token_out_mint: '', token_out_amount: '', token_in_amount: '' }));
      await load();
    } catch (err) { setFormError(err.message); }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-semibold text-gray-200">Trade History</h1>
        <div className="flex gap-3">
          <select value={filterWallet} onChange={e => setFilterWallet(e.target.value)}
            className="bg-black/30 border border-[#21262d] rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none">
            <option value="">All Wallets</option>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.label || w.address.slice(0, 8) + '...'}</option>)}
          </select>
          <button onClick={() => setShowForm(s => !s)}
            className="px-4 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium transition-colors">
            + Manual Trade
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleManualTrade} style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-5 space-y-4">
          <p className="text-sm font-medium text-gray-300">Enter Manual Trade (SOL → Token)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.wallet_id} onChange={e => setForm(f => ({ ...f, wallet_id: e.target.value }))}
              className="bg-black/30 border border-[#21262d] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none">
              {wallets.map(w => <option key={w.id} value={w.id}>{w.label || w.address.slice(0, 8) + '...'}</option>)}
            </select>
            <input value={form.token_out_mint} onChange={e => setForm(f => ({ ...f, token_out_mint: e.target.value }))}
              placeholder="Token mint address" className="bg-black/30 border border-[#21262d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-mono" />
            <input value={form.token_in_amount} onChange={e => setForm(f => ({ ...f, token_in_amount: e.target.value }))}
              placeholder="SOL spent" type="number" step="any" className="bg-black/30 border border-[#21262d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
            <input value={form.token_out_amount} onChange={e => setForm(f => ({ ...f, token_out_amount: e.target.value }))}
              placeholder="Tokens received" type="number" step="any" className="bg-black/30 border border-[#21262d] rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
          </div>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting}
              className="px-5 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 text-sm font-medium disabled:opacity-40">
              {submitting ? 'Saving...' : 'Save Trade'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {!trades.length ? (
        <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-10 text-center text-gray-600 text-sm">No trades yet.</div>
      ) : (
        <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {['Date', 'Wallet', 'Pair', 'Entry', 'Exit', 'PnL', 'Status', 'Type', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map(t => {
                const pnl = t.status === 'closed' ? t.realized_pnl_usd : null;
                const pnlColor = pnl == null ? 'text-gray-500' : pnl >= 0 ? 'text-green-400' : 'text-red-400';
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #21262d' }} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{t.wallet_label || (t.wallet_address?.slice(0, 6) + '...')}</td>
                    <td className="px-4 py-3 font-medium text-gray-200">{t.token_in_symbol} → {t.token_out_symbol}</td>
                    <td className="px-4 py-3 text-gray-400">${fmtPrice(t.entry_price_usd)}</td>
                    <td className="px-4 py-3 text-gray-400">{t.exit_price_usd ? '$' + fmtPrice(t.exit_price_usd) : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${pnlColor}`}>{fmt(pnl)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-500'}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.source === 'copy' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>{t.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      {t.status === 'open' && (
                        <button onClick={() => handleClose(t.id)} disabled={closing === t.id}
                          className="text-xs px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                          {closing === t.id ? '...' : 'Close'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
