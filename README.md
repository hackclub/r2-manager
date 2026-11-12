<img width="614" height="768" alt="image" src="https://github.com/user-attachments/assets/3269c940-87ac-4192-8b91-046f0de7876f" />

### Bucket access

Administrators can add and remove people and change their role on **Admin → Buckets**.
People must have signed in once and still need app access. Administrators retain
full access to every bucket.

| Bucket role | Object access                                                 | API keys           | Settings / empty / delete bucket |
| ----------- | ------------------------------------------------------------- | ------------------ | -------------------------------- |
| Viewer      | Browse, preview, download                                     | Read only          | No                               |
| Editor      | Viewer access plus upload, replace, delete individual objects | Read or read/write | No                               |
| Manager     | Full object access                                            | Read or read/write | Yes                              |

New assignments default to Viewer. Existing members and bucket creators receive
Manager. Role assignment is restricted to app administrators.

Before deploying this change to an existing database, run `db/bucket-members.sql`
against the application's database (for example, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/bucket-members.sql`).
It preserves existing owners as members and can be rerun without restoring removed
people. New installations can use `db/schema.sql` after Better Auth's migration.
Then apply `db/bucket-roles.sql` before deploying role-aware code. It preserves
existing members as Managers and can be rerun without overwriting assigned roles.
The `owner_id` field records the original assignment; authorization uses membership
and role.

Removing someone revokes their unexpired API keys containing that bucket, including
other buckets covered by those keys. If revocation fails, membership is retained so
an administrator can retry. Previously issued presigned object URLs remain valid
until they expire. Changing someone to Viewer revokes their unexpired read/write
keys containing that bucket before the role changes; read-only keys are retained.
If revocation fails, the role is unchanged and the change can be retried.

### Rule editors

Managers can edit CORS and lifecycle policies visually in bucket Settings, or use
Advanced JSON. CORS presets add public browser reads or uploads from the current
app origin. Lifecycle rules support prefixes, enabling/disabling, object expiration,
incomplete multipart upload cleanup, and transitions to Infrequent Access. Ages
use days or seconds; date conditions use UTC. Edits preserve extra JSON fields.
Saving replaces the bucket's entire policy. Lifecycle changes require explicit
confirmation because they can permanently delete existing matching objects.

The formats follow Cloudflare's [CORS documentation](https://developers.cloudflare.com/r2/buckets/cors/)
and [lifecycle API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/).

Run the integration tests against a disposable PostgreSQL database:

```sh
BUCKET_TEST_DATABASE_URL=postgresql://localhost/r2_manager_test bun test
```

Tests create and remove isolated schemas and mock Cloudflare operations. Without
`BUCKET_TEST_DATABASE_URL`, database tests are skipped; rule validation tests still run.
