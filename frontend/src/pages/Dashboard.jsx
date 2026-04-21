import React, { useEffect, useState, useCallback } from 'react';
import { getPnl, closeTrade } from '../api';

function fmt(n, dec = 2) {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1000 ? abs.toLocaleString('en-US', { maximumFractionDigits: dec }) : abs.toFixed(dec);
  return (n < 0 ? '-$' : '+$') + s;
}

function pct(current, entry) {
  if (!entry || entry === 0) return '—';
  const p = ((current - entry) / entry) * 100;
  return (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData(await getPnl()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  async function handleClose(id) {
    setClosing(id);
    try { await closeTrade(id); await load(); } catch {}
    setClosing(null);
  }

  if (loading) return <p className="text-gray-500 text-sm mt-20 text-center">Loading...</p>;
  if (error) return <p className="text-red-400 text-sm mt-20 text-center">{error}</p>;

  const totalColor = !data?.total_pnl ? 'text-gray-400' : data.total_pnl >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-gray-200 mb-1">Portfolio Overview</h1>
        <p className="text-xs text-gray-500">Refreshes every 30s · SOL ${data?.sol_price?.toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total PnL" value={fmt(data?.total_pnl)} color={totalColor} />
        <StatCard label="Unrealized" value={fmt(data?.unrealized_pnl)} color={data?.unrealized_pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Realized" value={fmt(data?.realized_pnl)} color={data?.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Win Rate" value={`${data?.win_rate ?? 0}%`} color="text-blue-400" sub={`${data?.open_count} open · ${data?.closed_count} closed`} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Open Positions</h2>
        {!data?.open_trades?.length ? (
          <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl p-10 text-center text-gray-600 text-sm">
            No open positions — add wallets to copy trade.
          </div>
        ) : (
          <div style={{ background: '#0d1117', border: '1px solid #21262d' }} className="rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #21262d' }}>
                  {['Token', 'Entry', 'Current', 'Size', 'PnL', 'Chg %', 'Type', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.open_trades.map(t => {
                  const c = t.unrealized_pnl_usd >= 0 ? 'text-green-400' : 'text-red-400';
                  const fmtPrice = v => v < 0.001 ? v.toExponential(3) : v < 1 ? v.toFixed(5) : v.toFixed(3);
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #21262d' }} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-semibold text-gray-200">{t.token_out_symbol}</td>
                      <td className="px-4 py-3 text-gray-400">${fmtPrice(t.entry_price_usd)}</td>
                      <td className="px-4 py-3 text-gray-300">${fmtPrice(t.current_price_usd)}</td>
                      <td className="px-4 py-3 text-gray-400">{t.token_out_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                      <td className={`px-4 py-3 font-semibold ${c}`}>{fmt(t.unrealized_pnl_usd)}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${c}`}>{pct(t.current_price_usd, t.entry_price_usd)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.source === 'copy' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>
                          {t.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleClose(t.id)} disabled={closing === t.id}
                          className="text-xs px-3 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40">
                          {closing === t.id ? '...' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
