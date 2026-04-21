const SOL_MINT = 'So11111111111111111111111111111111111111112';
let tokenMap = null, tokenMapExpiry = 0;

async function loadTokenMap() {
  if (tokenMap && Date.now() < tokenMapExpiry) return tokenMap;
  try {
    const res = await fetch('https://token.jup.ag/all');
    const tokens = await res.json();
    tokenMap = {};
    for (const t of tokens) tokenMap[t.address] = { symbol: t.symbol, name: t.name };
    tokenMapExpiry = Date.now() + 3_600_000;
  } catch { tokenMap = tokenMap || {}; }
  return tokenMap;
}

async function getTokenInfo(mint) {
  if (mint === SOL_MINT) return { symbol: 'SOL', name: 'Solana' };
  const map = await loadTokenMap();
  return map[mint] || { symbol: mint.slice(0, 4) + '...' + mint.slice(-4), name: mint };
}

async function getPrices(mints) {
  if (!mints.length) return {};
  try {
    const ids = [...new Set(mints)].join(',');
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${ids}`);
    const data = await res.json();
    const out = {};
    for (const [mint, info] of Object.entries(data.data || {})) out[mint] = parseFloat(info.price) || 0;
    return out;
  } catch { return {}; }
}

async function getSolPrice() {
  const p = await getPrices([SOL_MINT]);
  return p[SOL_MINT] || 150;
}

module.exports = { getTokenInfo, getPrices, getSolPrice, SOL_MINT };
