CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('pause', 'unpause', 'upgrade')),
  actor TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('submitted', 'pending_signatures')),
  transaction_id TEXT NOT NULL,
  wasm_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON admin_audit_log (created_at DESC);