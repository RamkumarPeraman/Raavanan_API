# Raavanan API — PostgreSQL

The API uses PostgreSQL through Sequelize and `pg`. Mongoose is removed. The MongoDB driver is a development dependency used only for the one-time importer.

## Keep existing MongoDB records

1. Install Node.js 22+ and PostgreSQL. From `API`, run `npm ci` (include development dependencies for the importer).
2. Create a **new, empty** PostgreSQL database. If the running `raavanan` database already has any records, use `raavanan_migrated` and set `MONGO_IMPORT_DATABASE=raavanan_migrated` in `.env`. Keep the current database intact for rollback.
3. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `MONGODB_URI`, and `MONGODB_DATABASE=raavana_trust`. Preserve the previous `JWT_SECRET` if existing login sessions should remain valid. Keep `SEED_DEMO_DATA=false`.
4. In Atlas, **Connect → Drivers** provides a URI starting with `mongodb+srv://`. The `https://cloud.mongodb.com/...` database explorer link cannot authenticate a database driver. Use an existing database user with read access and an allowed client IP. URL-encode special characters in passwords; keep credentials in `.env`.
   If you have created a new database user, run `npm run db:configure-mongo` from `API`. Enter its username and password at the prompts; the password is hidden. The command tests Atlas access, encodes special characters, and updates `MONGODB_URI` automatically only after successful authentication.
   If the Node.js driver reports a DNS SRV lookup timeout while the Atlas cluster is otherwise reachable, set `MONGODB_DNS_SERVER` to a working DNS resolver for this machine. An Atlas `bad auth` response means the database username or password in the URI must be corrected; the Atlas website login is a separate account.
5. Stop writes to the MongoDB application for the duration of the backup and import. Keep the source database intact for rollback.
6. Run `npm run db:import:mongo` **before starting the API**. It creates the PostgreSQL schema, saves a local Extended JSON backup under `API/backups/`, imports application records in a transaction, and verifies record counts. Any import error rolls back all imported data and archive rows. Review the printed counts.
7. If `MONGO_IMPORT_DATABASE` was used, change the database name in `DATABASE_URL` to that imported database after verifying the import counts. Restart with `npm start`. Check `GET /api/health`, sign in with an existing account, and inspect projects, donations and conversations before directing users to this API.

An alternative to a live MongoDB connection is `MONGO_EXPORT_DIR=D:/path/to/export`. Supply one file per collection, named `users.json`, `projects.json`, etc. MongoDB Extended JSON arrays (`mongoexport --jsonArray`) and newline-delimited JSON are supported. Export **all** collections to preserve the full dataset. The importer's own backup directory can also be used as `MONGO_EXPORT_DIR`.

Existing IDs, password hashes and timestamps are retained. New records use UUIDs, while text primary keys allow existing 24-character IDs and their links to remain valid. Typed SQL columns hold scalar fields; JSONB holds embedded profiles, settings, event attendees, conversation participants and read receipts. Message and notification foreign keys cascade when their parent conversation/message is removed. Historical user IDs remain readable after account deletion.

Every original document, including unrecognized fields and collections, is retained in `legacy_documents` as canonical Extended JSON. Only fields represented by the current API models are exposed through application endpoints. Invalid source records cause the import to fail rather than being silently dropped. The importer refuses a populated target and never deletes or writes to MongoDB. It loads the selected source collections into memory; use a machine with enough memory for the dataset.

Backups contain the original private data and password hashes. They and `.env` are git-ignored. Store them with the same access restrictions as the database. After a successful cutover, remove the MongoDB credentials from the API environment. Retain the backup according to your own retention requirements.

## PostgreSQL configuration

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/raavanan
PGSSLMODE=disable
SEED_DEMO_DATA=false
```

For a remote service, set `PGSSLMODE=require` to encrypt the connection. For certificate and hostname verification, download the server root certificate, set `PGSSLMODE=verify-full`, and set `PGSSLROOTCERT` to the certificate file path. `DB_LOG_SQL=true` is available for local debugging.

On Supabase, use the Session pooler URI from the project's Connect dialog (port 5432). The username is `postgres.<actual-project-reference>`, and the database is `postgres`. Migration `002_public_table_rls.sql` enables RLS on the API's existing public tables and automatically enables it on future public tables. The API connects as the table owner; Supabase Data API roles need explicit policies before they can access the tables.

Versioned SQL files in `database/migrations/` are applied transactionally by `npm run db:migrate` and on API startup. An advisory lock prevents concurrent migration runs. Applied file checksums are verified; add a new migration instead of editing an applied one. No `sync({ force: true })` or automatic schema alteration runs in production.

For a fresh local demo only, set `SEED_DEMO_DATA=true`. This creates the sample content and known demo accounts from `server.js`; it is rejected in production. Normal startup creates missing role definitions only and preserves existing roles.

## Verification

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres:PASSWORD@localhost:5432/postgres'
npm test
```

The test connection needs permission to create/drop databases. Each run creates a randomly named `raavanan_test_*` database and removes only that database afterward. Existing databases are never cleared. Without `TEST_DATABASE_URL`, database integration tests are explicitly skipped.

Tests cover migrations, import rollback and preservation, existing-user login, signup, content writes, literal search, monetary totals, role assignment, password privacy, concurrent event registration, messaging authorization, notifications/read receipts and cascade deletion.

Query behavior follows the official [Sequelize query documentation](https://sequelize.org/docs/v6/core-concepts/model-querying-basics/) and [node-postgres parameterized query documentation](https://node-postgres.com/features/queries).
