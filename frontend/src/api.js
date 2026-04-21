import { supabase } from './supabase';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

let _tokenCache = null;
async function tokenList() {
  if (_tokenCache) return _tokenCache;
  try {
    const r = await fetch('https://token.jup.ag/all');
    _tokenCache = await r.json();
  } catch { _tokenCache = []; }
  return _tokenCache;
}

async function getTokenInfo(mint) {
  if (mint === SOL_MINT) return { symbol: 'SOL' };
  try {
    const r = await fetch(`https://token.jup.ag/token/${mint}`);
    if (r.ok) return await r.json();
  } catch {}
  return { symbol: mint.slice(0, 6) };
}

async function getPrices(mints) {
  if (!mints.length) return {};
  try {
    const r = await fetch(`https://price.jup.ag/v6/price?ids=${mints.join(',')}`);
    const json = await r.json();
    return Object.fromEntries(mints.map(m => [m, json.data?.[m]?.price || 0]));
  } catch { return Object.fromEntries(mints.map(m => [m, 0])); }
}

async function getSolPrice() {
  try {
    const r = await fetch(`https://price.jup.ag/v6/price?ids=${SOL_MINT}`);
    const json = await r.json();
    return json.data?.[SOL_MINT]?.price || 0;
  } catch { return 0; }
}

export async function getWallets() {
  const { data, error } = await supabase.from('wallets').select('*').order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function addWallet(address, label) {
  const { data, error } = await supabase
    .from('wallets').insert({ address, label: label || null, virtual_sol: 1, active: true })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeWallet(id) {
  const { error } = await supabase.from('wallets').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getTrades(walletId) {
  let q = supabase.from('trades').select('*, wallets(address, label)').order('created_at', { ascending: false });
  if (walletId) q = q.eq('wallet_id', walletId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data.map(t => ({ ...t, wallet_address: t.wallets?.address, wallet_label: t.wallets?.label }));
}

export async function addTrade({ wallet_id, token_in_mint, token_in_amount, token_out_mint, token_out_amount }) {
  const [inInfo, outInfo, prices] = await Promise.all([
    getTokenInfo(token_in_mint), getTokenInfo(token_out_mint), getPrices([token_out_mint])
  ]);
  const { data: w } = await supabase.from('wallets').select('virtual_sol').eq('id', wallet_id).single();
  const solSpent = token_in_mint === SOL_MINT ? parseFloat(token_in_amount) : 0;
  if (solSpent > 0 && w && w.virtual_sol < solSpent) throw new Error('Insufficient virtual SOL');
  if (solSpent > 0 && w) {
    await supabase.from('wallets').update({ virtual_sol: Math.max(0, w.virtual_sol - solSpent) }).eq('id', wallet_id);
  }
  const { data, error } = await supabase.from('trades').insert({
    wallet_id: Number(wallet_id), source: 'manual', status: 'open',
    token_in_mint, token_in_symbol: inInfo.symbol, token_in_amount: parseFloat(token_in_amount),
    token_out_mint, token_out_symbol: outInfo.symbol, token_out_amount: parseFloat(token_out_amount),
    entry_price_usd: prices[token_out_mint] || 0, sol_spent: solSpent
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function closeTrade(id) {
  const { data: trade, error: e1 } = await supabase.from('trades').select('*').eq('id', id).single();
  if (e1) throw new Error(e1.message);
  const prices = await getPrices([trade.token_out_mint]);
  const exitPrice = prices[trade.token_out_mint] || trade.entry_price_usd;
  const realizedPnl = (exitPrice - trade.entry_price_usd) * trade.token_out_amount;
  const { data, error } = await supabase.from('trades')
    .update({ status: 'closed', exit_price_usd: exitPrice, realized_pnl_usd: realizedPnl })
    .eq('id', id).select().single();
  if (error) throw new Error(error.message);
  if (trade.sol_spent > 0) {
    const solPrice = await getSolPrice();
    const { data: w } = await supabase.from('wallets').select('virtual_sol').eq('id', trade.wallet_id).single();
    if (w) await supabase.from('wallets').update({ virtual_sol: w.virtual_sol + (trade.token_out_amount * exitPrice) / solPrice }).eq('id', trade.wallet_id);
  }
  return data;
}

export async function getPnl() {
  const [{ data: open }, { data: closed }] = await Promise.all([
    supabase.from('trades').select('*').eq('status', 'open'),
    supabase.from('trades').select('*').eq('status', 'closed')
  ]);
  const mints = [...new Set((open || []).map(t => t.token_out_mint))];
  const [prices, solPrice] = await Promise.all([getPrices(mints), getSolPrice()]);
  let unrealized = 0;
  const openWithPnl = (open || []).map(t => {
    const cur = prices[t.token_out_mint] || 0;
    const pnl = (cur - t.entry_price_usd) * t.token_out_amount;
    unrealized += pnl;
    return { ...t, current_price_usd: cur, unrealized_pnl_usd: pnl };
  });
  const realized = (closed || []).reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const wins = (closed || []).filter(t => (t.realized_pnl_usd || 0) > 0).length;
  return {
    total_pnl: realized + unrealized, realized_pnl: realized, unrealized_pnl: unrealized,
    open_count: (open || []).length, closed_count: (closed || []).length,
    win_rate: (closed || []).length ? Math.round((wins / closed.length) * 100) : 0,
    sol_price: solPrice, open_trades: openWithPnl
  };
}

export async function getWalletPnl(walletId) {
  const [{ data: wallet }, { data: open }, { data: closed }] = await Promise.all([
    supabase.from('wallets').select('*').eq('id', walletId).single(),
    supabase.from('trades').select('*').eq('wallet_id', walletId).eq('status', 'open'),
    supabase.from('trades').select('*').eq('wallet_id', walletId).eq('status', 'closed')
  ]);
  const mints = [...new Set((open || []).map(t => t.token_out_mint))];
  const prices = await getPrices(mints);
  let unrealized = 0;
  const openWithPnl = (open || []).map(t => {
    const cur = prices[t.token_out_mint] || 0;
    const pnl = (cur - t.entry_price_usd) * t.token_out_amount;
    unrealized += pnl;
    return { ...t, current_price_usd: cur, unrealized_pnl_usd: pnl };
  });
  const realized = (closed || []).reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
  const wins = (closed || []).filter(t => (t.realized_pnl_usd || 0) > 0).length;
  return {
    wallet, total_pnl: realized + unrealized, realized_pnl: realized, unrealized_pnl: unrealized,
    open_count: (open || []).length, closed_count: (closed || []).length,
    win_rate: (closed || []).length ? Math.round((wins / closed.length) * 100) : 0,
    open_trades: openWithPnl, closed_trades: closed || []
  };
}
