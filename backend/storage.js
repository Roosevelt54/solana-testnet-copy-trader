const { supabase } = require('./supabase-client');

async function getWallets() {
  const { data, error } = await supabase.from('wallets').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function getWallet(id) {
  const { data } = await supabase.from('wallets').select('*').eq('id', Number(id)).single();
  return data || null;
}

async function addWallet({ address, label }) {
  const { data, error } = await supabase.from('wallets').insert({ address, label: label || '', virtual_sol: 1 }).select().single();
  if (error) throw error;
  return data;
}

async function updateWallet(id, patch) {
  const { data, error } = await supabase.from('wallets').update(patch).eq('id', Number(id)).select().single();
  if (error) throw error;
  return data;
}

async function deleteWallet(id) {
  const { error } = await supabase.from('wallets').delete().eq('id', Number(id));
  if (error) throw error;
}

async function getTrades(filter = {}) {
  let q = supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(200);
  if (filter.wallet_id) q = q.eq('wallet_id', Number(filter.wallet_id));
  if (filter.status) q = q.eq('status', filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getTrade(id) {
  const { data } = await supabase.from('trades').select('*').eq('id', Number(id)).single();
  return data || null;
}

async function addTrade(tradeData) {
  const { data, error } = await supabase.from('trades').insert(tradeData).select().single();
  if (error) throw error;
  return data;
}

async function updateTrade(id, patch) {
  const { data, error } = await supabase.from('trades').update(patch).eq('id', Number(id)).select().single();
  if (error) throw error;
  return data;
}

module.exports = { getWallets, getWallet, addWallet, updateWallet, deleteWallet, getTrades, getTrade, addTrade, updateTrade };
