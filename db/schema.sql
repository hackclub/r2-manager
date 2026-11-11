-- Run after Better Auth's migration.
CREATE TABLE IF NOT EXISTS managed_buckets (
  name text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id),
  status text NOT NULL CHECK (status IN ('pending', 'active')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS managed_buckets_owner_idx ON managed_buckets(owner_id);

-- A hostname is reserved before calling Cloudflare, including uncertain operations.
CREATE TABLE IF NOT EXISTS managed_domains (
  hostname text PRIMARY KEY,
  bucket_name text NOT NULL REFERENCES managed_buckets(name) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'active')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Keep deleted names retired so credentials cannot grant access to a replacement bucket.
CREATE TABLE IF NOT EXISTS retired_bucket_names (
  name text PRIMARY KEY,
  retired_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_access (
 subject text PRIMARY KEY,
 allowed boolean NOT NULL DEFAULT true,
 admin boolean NOT NULL DEFAULT false
);
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
