# Current PostgreSQL setup — 25 October 2026

For the current empty product catalogue, dynamic categories and permanent deletion, follow **../POSTGRESQL-SETUP.md** and **../POSTGRESQL-SETUP.sql**, or run `npm run db:setup`. These are repeatable schema upgrades and do not seed products. The local launcher also uses the current initializer. Existing data is preserved; use the administrator's Delete all products control to clear an older catalogue.

The historical cutover notes below describe the original 23 October seeded release. They are retained for migration history, not as instructions for creating the new empty catalogue. Do not rerun that import over edited or deleted records.

---

# LYCA PostgreSQL migration

The catalogue backend is converted to PostgreSQL using the Neon HTTP driver. The admin and customer API contracts are preserved. Uploaded images remain in the existing R2 bucket.

## Activation status

PostgreSQL was activated on 23 October 2026. The live `/api/ingredients` endpoint returns HTTP 200, `storage: "postgresql"`, 108 published ingredients and seven families. Catalogue saves are enabled. The existing D1 database is retained as a migration backup, with no automatic fallback.

The dedicated Neon project is `quiet-mountain-09830170` in Singapore (`aws-ap-southeast-1`). The production branch is `br-flat-bird-b3qr1g4b`, database `lyca`, role `lyca_owner`. The separate validation branch is `br-purple-wildflower-b3t7qxxn`. These identifiers are not credentials. The production pooled connection is stored only in the hosting secret `DATABASE_URL`; never commit or print it.

Migration was verified first on the validation branch and then against the final D1 snapshot captured while writes were paused. The final D1 override tables were empty; the complete existing bundled catalogue and default settings were materialized into PostgreSQL: 108 ingredients, 94 legacy products and one settings record. Record-level migration verification passed before activation.

## Schema and runtime

- `lyca.ingredients`: JSONB ingredient details, visibility status, optimistic-lock version and timestamp.
- `lyca.products`: legacy product details and archive flags.
- `lyca.settings`: existing contact-delivery settings.
- `lyca.migration_runs`: source snapshot digest and migration completion record.

PostgreSQL is the default provider in this source. Set `DATABASE_URL` as an encrypted server-only hosting secret and `CATALOGUE_DATABASE=postgresql`. Never prefix database credentials with `VITE_` or `NEXT_PUBLIC_`. A PostgreSQL failure returns an error; it never silently reads from D1.

`CATALOGUE_DATABASE=d1` is an explicit migration/rollback mode. The existing D1 binding and its applied `drizzle/` migrations are retained; runtime PostgreSQL queries use only the `lyca` schema. PostgreSQL schema history is separate in `postgres/migrations/`.

## Cutover

1. Create or select a dedicated Neon PostgreSQL database through the connected Neon app. Store its connection string securely; do not paste it into chat or commit it.
2. Deploy this compatible backend with `CATALOGUE_DATABASE=d1` and `CATALOGUE_READ_ONLY=true`. Reads stay available while ingredient, product and settings saves receive a temporary migration response.
3. Export complete D1 `ingredients`, `products` and `settings` rows after the write lock is active. Use the exact current records, including hidden items and versions. Reject any truncated export.
4. Run `npm run db:migrate:postgres`. The command reads one JSON object from hidden stdin containing `databaseUrl` and a `snapshot` object. The snapshot shape is `{ "tables": { "ingredients": [], "products": [], "settings": [] } }`, with complete D1 rows in each array. The connection string may alternatively come from the process's protected `DATABASE_URL` environment.
5. The script creates the schema and imports records in one transaction. It includes all 108 current brochure ingredients, all 94 legacy product defaults, existing overrides, draft/archive states and contact settings. It verifies complete records and counts after import. A repeat with the same snapshot verifies existing data; a different snapshot is refused rather than overwrite PostgreSQL records.
6. Configure encrypted `DATABASE_URL`, set `CATALOGUE_DATABASE=postgresql`, set `CATALOGUE_READ_ONLY=false`, and deploy the same tested version. Verify `/api/ingredients` returns `storage: "postgresql"` and the expected catalogue. Existing client polling then reads PostgreSQL automatically.

D1 is preserved for rollback before new PostgreSQL writes. After users save new PostgreSQL changes, a rollback must first copy those changes back; switching to the old database alone would show stale records.

## Validation

`npm run test:postgres` runs the real repository/API/migration SQL against a local PostgreSQL engine (PGlite). It covers 108 initial ingredient records, preserving legacy products and settings, Unicode, draft/archive/version preservation, idempotent imports, refusal to overwrite a different snapshot, publishing, stale/concurrent edit protection, R2 photo references, the migration write lock and failure without a configured PostgreSQL connection. No hosted test product is created.

TypeScript and the production build passed. The hosted Neon migration verified complete records and counts. After cutover, the hosted catalogue returned PostgreSQL storage and all 108 published ingredients, the connected customer HTML returned HTTP 200, and a request without the administrator identity remained HTTP 403. No hosted test product was created. Full protected browser interaction still requires the signed-in owner; the isolated API tests cover publishing and concurrent saves.
