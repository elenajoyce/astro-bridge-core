-- Upgrade database schema to add Solana support and search indexes for faster event polling.
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_hashlock ON orders(hashlock);

UPDATE schema_version SET version = 2;
