import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const JUPITER_PROGRAM = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
const RAYDIUM_PROGRAM = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  })
  const json = await r.json()
  return json.result
}

async function getTokenInfo(mint: string) {
  if (mint === SOL_MINT) return { symbol: 'SOL' }
  try {
    const r = await fetch(`https://token.jup.ag/token/${mint}`)
    if (r.ok) return await r.json()
  } catch { /* ignore */ }
  return { symbol: mint.slice(0, 6) }
}

async function getPrice(mint: string): Promise<number> {
  try {
    const r = await fetch(`https://price.jup.ag/v6/price?ids=${mint}`)
    const json = await r.json()
    return json.data?.[mint]?.price || 0
  } catch { return 0 }
}

function parseSwap(tx: any, walletAddress: string) {
  if (!tx || tx.meta?.err) return null
  const accounts: string[] = (tx.transaction?.message?.accountKeys || [])
    .map((k: any) => typeof k === 'string' ? k : k.pubkey)
  if (!accounts.includes(JUPITER_PROGRAM) && !accounts.includes(RAYDIUM_PROGRAM)) return null

  const walletIdx = accounts.indexOf(walletAddress)
  if (walletIdx === -1) return null

  const preSol = (tx.meta?.preBalances?.[walletIdx] || 0) / 1e9
  const postSol = (tx.meta?.postBalances?.[walletIdx] || 0) / 1e9
  const solChange = postSol - preSol

  const preTokens: any[] = tx.meta?.preTokenBalances || []
  const postTokens: any[] = tx.meta?.postTokenBalances || []

  const tokenChanges = postTokens
    .filter((p: any) => p.owner === walletAddress)
    .map((p: any) => {
      const pre = preTokens.find((t: any) => t.mint === p.mint && t.owner === walletAddress)
      const preAmt = parseFloat(pre?.uiTokenAmount?.uiAmountString || '0')
      const postAmt = parseFloat(p.uiTokenAmount?.uiAmountString || '0')
      return { mint: p.mint, change: postAmt - preAmt }
    })
    .filter((t: any) => Math.abs(t.change) > 0)

  const signature = tx.transaction?.signatures?.[0] || ''

  if (solChange < -0.001) {
    const bought = tokenChanges.find((t: any) => t.change > 0)
    if (!bought) return null
    return { tokenInMint: SOL_MINT, tokenInAmount: Math.abs(solChange), tokenOutMint: bought.mint, tokenOutAmount: bought.change, signature }
  }

  if (solChange > 0.001) {
    const sold = tokenChanges.find((t: any) => t.change < 0)
    if (!sold) return null
    return { tokenInMint: sold.mint, tokenInAmount: Math.abs(sold.change), tokenOutMint: SOL_MINT, tokenOutAmount: solChange, signature }
  }

  return null
}

async function processWallet(wallet: any) {
  const opts: any = { limit: 10 }
  if (wallet.last_signature) opts.until = wallet.last_signature

  const sigs = await rpc('getSignaturesForAddress', [wallet.address, opts])
  if (!sigs?.length) return

  await supabase.from('wallets').update({ last_signature: sigs[0].signature }).eq('id', wallet.id)

  for (const sigInfo of [...sigs].reverse()) {
    try {
      const tx = await rpc('getTransaction', [sigInfo.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }])
      const swap = parseSwap(tx, wallet.address)
      if (!swap) continue

      const { data: existing } = await supabase.from('trades').select('id').eq('tx_signature', swap.signature).maybeSingle()
      if (existing) continue

      const [inInfo, outInfo, price] = await Promise.all([
        getTokenInfo(swap.tokenInMint),
        getTokenInfo(swap.tokenOutMint),
        getPrice(swap.tokenOutMint)
      ])

      const solSpent = swap.tokenInMint === SOL_MINT ? swap.tokenInAmount : 0
      if (solSpent > 0 && wallet.virtual_sol < solSpent) continue
      if (solSpent > 0) {
        await supabase.from('wallets').update({ virtual_sol: Math.max(0, wallet.virtual_sol - solSpent) }).eq('id', wallet.id)
        wallet.virtual_sol = Math.max(0, wallet.virtual_sol - solSpent)
      }

      await supabase.from('trades').insert({
        wallet_id: wallet.id,
        user_id: wallet.user_id,
        source: 'copy',
        status: 'open',
        token_in_mint: swap.tokenInMint,
        token_in_symbol: (inInfo as any).symbol,
        token_in_amount: swap.tokenInAmount,
        token_out_mint: swap.tokenOutMint,
        token_out_symbol: (outInfo as any).symbol,
        token_out_amount: swap.tokenOutAmount,
        entry_price_usd: price,
        sol_spent: solSpent,
        tx_signature: swap.signature
      })

      console.log(`[COPIED] ${wallet.label || wallet.address.slice(0, 8)}: ${(inInfo as any).symbol} → ${(outInfo as any).symbol} @ $${price}`)
    } catch (e) {
      console.error('tx error:', e)
    }
    await new Promise(r => setTimeout(r, 400))
  }
}

Deno.serve(async () => {
  try {
    const { data: wallets, error } = await supabase.from('wallets').select('*').eq('active', true)
    if (error) throw error
    if (!wallets?.length) return new Response(JSON.stringify({ ok: true, message: 'no active wallets' }), { headers: { 'Content-Type': 'application/json' } })

    for (const wallet of wallets) {
      await processWallet(wallet)
      await new Promise(r => setTimeout(r, 1000))
    }

    return new Response(JSON.stringify({ ok: true, processed: wallets.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
