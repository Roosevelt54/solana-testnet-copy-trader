const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const RAYDIUM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const DEX_PROGRAMS = new Set([JUPITER_V6, RAYDIUM]);

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function getNewSignatures(address, lastSignature) {
  const opts = { limit: 15, commitment: 'confirmed' };
  if (lastSignature) opts.until = lastSignature;
  const result = await rpc('getSignaturesForAddress', [address, opts]);
  return (result || []).filter(s => !s.err).map(s => s.signature);
}

async function getLatestSignature(address) {
  const result = await rpc('getSignaturesForAddress', [address, { limit: 1, commitment: 'confirmed' }]);
  return result?.[0]?.signature || null;
}

async function getParsedTx(signature) {
  return rpc('getTransaction', [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]);
}

function parseSwap(tx, walletAddress) {
  if (!tx || !tx.meta || tx.meta.err) return null;
  const { meta, transaction, blockTime } = tx;

  const keys = (transaction.message.accountKeys || []).map(k =>
    typeof k === 'string' ? k : (k.pubkey || '')
  );
  if (!keys.some(k => DEX_PROGRAMS.has(k))) return null;

  const walletIdx = keys.indexOf(walletAddress);
  if (walletIdx === -1) return null;

  const preMap = {}, postMap = {};
  for (const b of meta.preTokenBalances || []) {
    if (b.owner === walletAddress) preMap[b.mint] = b.uiTokenAmount.uiAmount || 0;
  }
  for (const b of meta.postTokenBalances || []) {
    if (b.owner === walletAddress) postMap[b.mint] = b.uiTokenAmount.uiAmount || 0;
  }

  const allMints = new Set([...Object.keys(preMap), ...Object.keys(postMap)]);
  let tokenIn = null, tokenOut = null;
  for (const mint of allMints) {
    const diff = (postMap[mint] || 0) - (preMap[mint] || 0);
    if (diff < -0.000001) tokenIn = { mint, amount: Math.abs(diff) };
    if (diff > 0.000001) tokenOut = { mint, amount: diff };
  }

  const fee = (meta.fee || 0) / 1e9;
  const netSol = ((meta.postBalances[walletIdx] - meta.preBalances[walletIdx]) / 1e9) + fee;
  if (!tokenIn && netSol < -0.001) tokenIn = { mint: SOL_MINT, amount: Math.abs(netSol) };
  if (!tokenOut && netSol > 0.001) tokenOut = { mint: SOL_MINT, amount: netSol };

  if (!tokenIn || !tokenOut || tokenIn.mint === tokenOut.mint) return null;

  return {
    tokenInMint: tokenIn.mint,
    tokenInAmount: tokenIn.amount,
    tokenOutMint: tokenOut.mint,
    tokenOutAmount: tokenOut.amount,
    signature: transaction.signatures[0],
    blockTime
  };
}

module.exports = { getNewSignatures, getLatestSignature, getParsedTx, parseSwap, SOL_MINT };
