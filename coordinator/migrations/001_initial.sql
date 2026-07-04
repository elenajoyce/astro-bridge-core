CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  source_chain TEXT NOT NULL,
  dest_chain TEXT NOT NULL,
  source_asset TEXT NOT NULL,
  dest_asset TEXT NOT NULL,
  amount TEXT NOT NULL,
  dest_amount TEXT NOT NULL,
  hashlock TEXT NOT NULL,
  secret TEXT,
  timelock INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'LOCKED', 'RESOLVER_LOCKED', 'CLAIMED', 'SETTLED', 'REFUNDED', 'FAILED')),
  tx_hash_source TEXT,
  tx_hash_dest TEXT,
  tx_hash_claim TEXT,
  resolver_address TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS secrets (
  hashlock TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  revealed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

INSERT INTO schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
