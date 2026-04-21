require('dotenv').config();
const express = require('express');
const cors = require('cors');
const storage = require('./storage');
const { getPrices, getSolPrice, getTokenInfo, SOL_MINT } = require('./jupiter');
const { getLatestSignature } = require('./solana');
const { start: startWatcher } = require('./watcher');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/wallets', async (req, res) => {
  try { res.json(await storage.getWallets()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/wallets', async (req, res) => {
  const { address, label } = req.body;
  if (!address || address.length < 32) return res.status(400).json({ error: 'Invalid Solana address' });
  try {
    const wallets = await storage.getWallets();
    if (wallets.find(w => w.address === address.trim())) return res.status(409).json({ error: 'Wallet already added' });
    const wallet = await storage.addWallet({ address: address.trim(), label });
    try { const sig = await getLatestSignature(address.trim()); if (sig) await storage.updateWallet(wallet.id, { last_signature: sig }); } catch {}
    res.json(await storage.getWallet(wallet.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/wallets/:id', async (req, res) => {
  try { await storage.deleteWallet(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trades', async (req, res) => {
  try {
    const trades = await storage.getTrades(req.query.wallet_id ? { wallet_id: req.query.wallet_id } : {});
    const wallets = await storage.getWallets();
    const walletsById = Object.fromEntries(wallets.map(w => [w.id, w]));
    res.json(trades.map(t => ({ ...t, wallet_address: walletsById[t.wallet_id]?.address, wallet_label: walletsById[t.wallet_id]?.label })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/trades', async (req, res) => {
  const { wallet_id, token_in_mint, token_in_amount, token_out_mint, token_out_amount } = req.body;
  if (!wallet_id || !token_in_mint || !token_out_mint || !token_in_amount || !token_out_amount)
    return res.status(400).json({ error: 'Missing required fields' });
  try {
    const [inInfo, outInfo, prices] = await Promise.all([getTokenInfo(token_in_mint), getTokenInfo(token_out_mint), getPrices([token_out_mint])]);
    res.json(await storage.addTrade({
      wallet_id: Number(wallet_id), source: 'manual',
      token_in_mint, token_in_symbol: inInfo.symbol, token_in_amount: parseFloat(token_in_amount),
      token_out_mint, token_out_symbol: outInfo.symbol, token_out_amount: parseFloat(token_out_amount),
      entry_price_usd: prices[token_out_mint] || 0,
      sol_spent: token_in_mint === SOL_MINT ? parseFloat(token_in_amount) : 0
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/trades/:id/close', async (req, res) => {
  try {
    const trade = await storage.getTrade(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Not found' });
    if (trade.status === 'closed') return res.status(400).json({ error: 'Already closed' });
    const prices = await getPrices([trade.token_out_mint]);
    const exitPrice = prices[trade.token_out_mint] || trade.entry_price_usd;
    const realizedPnl = (exitPrice - trade.entry_price_usd) * trade.token_out_amount;
    const updated = await storage.updateTrade(trade.id, { status: 'closed', exit_price_usd: exitPrice, realized_pnl_usd: realizedPnl });
    if (trade.sol_spent > 0) {
      const solPrice = await getSolPrice();
      const w = await storage.getWallet(trade.wallet_id);
      if (w) await storage.updateWallet(w.id, { virtual_sol: w.virtual_sol + (trade.token_out_amount * exitPrice) / solPrice });
    }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pnl', async (req, res) => {
  try {
    const [open, closed] = await Promise.all([storage.getTrades({ status: 'open' }), storage.getTrades({ status: 'closed' })]);
    const prices = await getPrices([...new Set(open.map(t => t.token_out_mint))]);
    let unrealized = 0;
    const openWithPnl = open.map(t => {
      const cur = prices[t.token_out_mint] || 0;
      const pnl = (cur - t.entry_price_usd) * t.token_out_amount;
      unrealized += pnl;
      return { ...t, current_price_usd: cur, unrealized_pnl_usd: pnl };
    });
    const realized = closed.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
    const wins = closed.filter(t => (t.realized_pnl_usd || 0) > 0).length;
    res.json({
      total_pnl: realized + unrealized, realized_pnl: realized, unrealized_pnl: unrealized,
      open_count: open.length, closed_count: closed.length,
      win_rate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      sol_price: await getSolPrice(), open_trades: openWithPnl
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pnl/:walletId', async (req, res) => {
  try {
    const wallet = await storage.getWallet(req.params.walletId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    const [open, closed] = await Promise.all([
      storage.getTrades({ wallet_id: req.params.walletId, status: 'open' }),
      storage.getTrades({ wallet_id: req.params.walletId, status: 'closed' })
    ]);
    const prices = await getPrices([...new Set(open.map(t => t.token_out_mint))]);
    let unrealized = 0;
    const openWithPnl = open.map(t => {
      const cur = prices[t.token_out_mint] || 0;
      const pnl = (cur - t.entry_price_usd) * t.token_out_amount;
      unrealized += pnl;
      return { ...t, current_price_usd: cur, unrealized_pnl_usd: pnl };
    });
    const realized = closed.reduce((s, t) => s + (t.realized_pnl_usd || 0), 0);
    const wins = closed.filter(t => (t.realized_pnl_usd || 0) > 0).length;
    res.json({
      wallet, total_pnl: realized + unrealized, realized_pnl: realized, unrealized_pnl: unrealized,
      open_count: open.length, closed_count: closed.length,
      win_rate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      open_trades: openWithPnl, closed_trades: closed
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => { console.log(`API at http://localhost:${PORT}`); startWatcher(); });
