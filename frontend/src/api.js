const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || 'Request failed');
  return json;
}

export const getWallets = () => req('/wallets');
export const addWallet = (address, label) => req('/wallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, label }) });
export const removeWallet = (id) => req(`/wallets/${id}`, { method: 'DELETE' });
export const getTrades = (walletId) => req(walletId ? `/trades?wallet_id=${walletId}` : '/trades');
export const addTrade = (data) => req('/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export const closeTrade = (id) => req(`/trades/${id}/close`, { method: 'POST' });
export const getPnl = () => req('/pnl');
export const getWalletPnl = (id) => req(`/pnl/${id}`);
