const storage = require('./storage');
const { getNewSignatures, getParsedTx, parseSwap, SOL_MINT } = require('./solana');
const { getTokenInfo, getPrices } = require('./jupiter');

const POLL_MS = 30_000;

async function processWallet(wallet) {
  try {
    const sigs = await getNewSignatures(wallet.address, wallet.last_signature);
    if (!sigs.length) return;
    await storage.updateWallet(wallet.id, { last_signature: sigs[0] });

    for (const sig of [...sigs].reverse()) {
      try {
        const tx = await getParsedTx(sig);
        const swap = parseSwap(tx, wallet.address);
        if (!swap) continue;

        const existing = await storage.getTrades({ wallet_id: wallet.id });
        if (existing.find(t => t.tx_signature === swap.signature)) continue;

        const [inInfo, outInfo] = await Promise.all([getTokenInfo(swap.tokenInMint), getTokenInfo(swap.tokenOutMint)]);
        const prices = await getPrices([swap.tokenOutMint]);
        const entryPrice = prices[swap.tokenOutMint] || 0;
        const solSpent = swap.tokenInMint === SOL_MINT ? swap.tokenInAmount : 0;

        const w = await storage.getWallet(wallet.id);
        if (solSpent > 0 && w.virtual_sol < solSpent) continue;
        if (solSpent > 0) await storage.updateWallet(wallet.id, { virtual_sol: Math.max(0, w.virtual_sol - solSpent) });

        await storage.addTrade({
          wallet_id: wallet.id, source: 'copy',
          token_in_mint: swap.tokenInMint, token_in_symbol: inInfo.symbol, token_in_amount: swap.tokenInAmount,
          token_out_mint: swap.tokenOutMint, token_out_symbol: outInfo.symbol, token_out_amount: swap.tokenOutAmount,
          entry_price_usd: entryPrice, sol_spent: solSpent, tx_signature: swap.signature
        });
        console.log(`[COPIED] ${wallet.label || wallet.address.slice(0, 8)}: ${inInfo.symbol} → ${outInfo.symbol} @ $${entryPrice.toFixed(6)}`);
      } catch (e) { console.error('tx error:', e.message); }
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (e) { console.error('wallet error:', e.message); }
}

async function poll() {
  const wallets = (await storage.getWallets()).filter(w => w.active);
  for (const w of wallets) { await processWallet(w); await new Promise(r => setTimeout(r, 1000)); }
}

function start() {
  console.log('Watcher started — polling every 30s');
  poll().catch(e => console.error('poll error:', e.message));
  setInterval(() => poll().catch(e => console.error('poll error:', e.message)), POLL_MS);
}

module.exports = { start };
