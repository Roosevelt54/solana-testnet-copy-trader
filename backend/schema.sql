-- Run this once in your Supabase SQL editor
-- Dashboard → SQL Editor → New Query → paste → Run

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  address TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  virtual_sol REAL NOT NULL DEFAULT 1,
  last_signature TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'copy',
  token_in_mint TEXT NOT NULL,
  token_in_symbol TEXT NOT NULL DEFAULT '',
  token_in_amount REAL NOT NULL,
  token_out_mint TEXT NOT NULL,
  token_out_symbol TEXT NOT NULL DEFAULT '',
  token_out_amount REAL NOT NULL,
  entry_price_usd REAL NOT NULL DEFAULT 0,
  sol_spent REAL NOT NULL DEFAULT 0,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  exit_price_usd REAL,
  realized_pnl_usd REAL,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE trades DISABLE ROW LEVEL SECURITY;
