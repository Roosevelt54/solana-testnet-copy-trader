-- Add user_id to wallets and trades
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Wallets: users manage only their own
CREATE POLICY "wallets_user" ON wallets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trades: users manage only their own
CREATE POLICY "trades_user" ON trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
