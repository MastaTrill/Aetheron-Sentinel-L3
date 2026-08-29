CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  sender TEXT NOT NULL,
  target TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  analysis_data JSONB,
  chain_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_security_events_tx_hash
  ON security_events (tx_hash);

CREATE INDEX IF NOT EXISTS idx_security_events_validated
  ON security_events (validated);

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp
  ON security_events (timestamp);