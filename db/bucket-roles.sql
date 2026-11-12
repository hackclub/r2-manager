-- Run before deploying role-aware code. Existing members retain full control.
BEGIN;
ALTER TABLE bucket_members ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'manager'
  CHECK (role IN ('viewer', 'editor', 'manager'));
COMMIT;
