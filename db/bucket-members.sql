-- Apply once before deploying membership-aware code. Safe to rerun: removed members stay removed.
BEGIN;
DO $$
BEGIN
  IF to_regclass('bucket_members') IS NULL THEN
    CREATE TABLE bucket_members (
      bucket_name text NOT NULL REFERENCES managed_buckets(name) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (bucket_name, user_id)
    );
    CREATE INDEX bucket_members_user_idx ON bucket_members(user_id);
    INSERT INTO bucket_members(bucket_name,user_id)
      SELECT name,owner_id FROM managed_buckets;
  END IF;
END $$;
COMMIT;
