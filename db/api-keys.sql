CREATE TABLE IF NOT EXISTS managed_api_keys (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  permission text NOT NULL CHECK (permission IN ('read', 'read-write')),
  buckets text[] NOT NULL CHECK (cardinality(buckets) > 0),
  cloudflare_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked', 'failed', 'revoke_pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '365 days')
);
CREATE INDEX IF NOT EXISTS managed_api_keys_owner_idx ON managed_api_keys(owner_id, created_at DESC);
