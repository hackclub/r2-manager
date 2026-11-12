<img width="614" height="768" alt="image" src="https://github.com/user-attachments/assets/3269c940-87ac-4192-8b91-046f0de7876f" />

### Bucket access

Administrators can add and remove people on **Admin → Buckets**. Multiple people can
have full control of the same bucket. People must have signed in once and still need
app access. Administrators retain access to every bucket.

Before deploying this change to an existing database, run `db/bucket-members.sql`
against the application's database (for example, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bucket-members.sql`).
It preserves existing owners as members and can be rerun without restoring removed
people. New installations can use `db/schema.sql` after Better Auth's migration.
The `owner_id` field now records the original assignment; authorization uses membership.

Removing someone revokes their unexpired API keys containing that bucket, including
other buckets covered by those keys. If revocation fails, membership is retained so
an administrator can retry. Previously issued presigned object URLs remain valid
until they expire.

Run the integration tests against a disposable PostgreSQL database:

```sh
BUCKET_TEST_DATABASE_URL=postgresql://localhost/r2_manager_test bun test tests/bucket-access.test.mjs
```

Tests create and remove isolated schemas and mock Cloudflare operations.
