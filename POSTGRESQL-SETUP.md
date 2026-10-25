# Connect LYCA to PostgreSQL

## Deploying on Vercel (new)

Follow **VERCEL-DEPLOY.md** to deploy admin and customer as two separate Vercel projects using this repository's root configuration. Both use the same Neon `DATABASE_URL` and public Vercel Blob store. After the SQL below has been run, also run **VERCEL-SETUP.sql** for administrator sign-in limits. Generate the admin settings using `node scripts/create-admin.mjs`.

The Cloudflare-specific hosting instructions in sections 3–5 below describe the preserved original deployment. Vercel uses the root `package.json`/`vercel.json`, the role-specific `vercel.*.env.example` files, and its own authentication/photo adapter; it does not require Cloudflare R2 or the original service/bridge tokens.

## Which database does the ZIP use?

START-WINDOWS.cmd runs a local workspace with embedded PostgreSQL (PGlite). No separate database installation is needed. It stores data in .local-data and now starts with **zero products** on a new installation. Existing .local-data records are preserved on upgrade; use **Admin → Product delete → Delete all products** to clear an older catalogue.

For a hosted website, the original backend uses the **Neon serverless PostgreSQL HTTP driver**. Follow the Neon setup below. The local launcher continues to use its local database; setting hosting secrets does not move local data or switch that launcher to Neon.

## 1. Create the PostgreSQL database

1. Open https://console.neon.tech and create or select your PostgreSQL project/database.
2. In the Connect panel, select the database and role for this site and copy the PostgreSQL connection string. Keep its required SSL parameters.
3. Keep this connection string private. The general format is `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`; use the exact string supplied by Neon, not this example.

The included hosted driver talks to Neon's HTTP endpoint. A normal localhost:5432 connection is not a drop-in replacement for that driver.

## 2. Create or upgrade the LYCA tables

In Neon's SQL Editor, select the correct database, paste the complete **POSTGRESQL-SETUP.sql** supplied beside this guide and run it.

This creates `lyca.ingredients`, `lyca.products`, `lyca.categories`, `lyca.catalogue_metadata` and `lyca.settings`, plus the category-name uniqueness index. It adds seven default categories once, but **does not add any products**. A persistent bootstrap marker prevents repeated setup from restoring categories that were later deleted. Category versions protect against stale edits and deletion. Repeating setup preserves existing products, uploaded category photo references and categories.

When upgrading from an older ZIP on hosted PostgreSQL, run this updated SQL before deploying the new source. It adds the category version column and metadata table without removing existing records. The local launcher applies this upgrade automatically.

Alternatively, use the included Node setup command after installing the backend source dependencies:

```bat
node scripts/setup-source.mjs --project customer-and-backend
cd customer-and-backend
npm run db:setup
```

At the hidden prompt, paste one JSON object containing your actual connection string:

```json
{"databaseUrl":"YOUR_PRIVATE_NEON_CONNECTION_STRING"}
```

Press Enter. A successful response includes `ready: true` and `database: "postgresql"`. This command uses the same repeatable schema initializer as the tested local workspace. It preserves existing data and imports no demo products.

Do not run the historical `db:migrate:postgres` import command to initialize a new empty catalogue. It is retained for the original D1 snapshot migration and contains the old demonstration seed.

## 3. Configure the customer/backend hosting

Add these **server-only** environment variables/secrets to the Cloudflare/Vinext backend hosting:

| Variable | Value |
| --- | --- |
| DATABASE_URL | Your private Neon connection string |
| CATALOGUE_DATABASE | postgresql |
| CATALOGUE_READ_ONLY | false |
| ADMIN_EMAIL | Email of the approved hosted administrator |
| ADMIN_BRIDGE_KEY | A long randomly generated secret shared with the admin server |

Keep the existing R2 bucket binding named `BUCKET` for uploaded photographs. PostgreSQL stores catalogue and category records; photographs remain in R2. Keep the original hosted authentication integration enabled.

## 4. Configure the administrator hosting

| Variable | Value |
| --- | --- |
| ADMIN_EMAIL | The same approved administrator email |
| ADMIN_BRIDGE_KEY | Exactly the same private bridge key as the backend |
| CATALOGUE_ORIGIN | The HTTPS origin of your customer/backend site, without /api |
| CATALOGUE_SERVICE_TOKEN | The server-to-server service token issued by your site's hosting access controls |

The existing admin proxy requires the service token. A Neon database password does not replace that token. Keep database credentials, bridge keys and service tokens in server settings; do not prefix them with VITE_ or NEXT_PUBLIC_.

## 5. Build and deploy both applications

From the extracted ZIP root:

```bat
node scripts/setup-source.mjs
cd customer-and-backend
npm run build
```

Then, in another terminal from the extracted root:

```bat
cd admin-site
npm run build
```

Deploy each application using its original Cloudflare/Vinext hosting configuration, including its environment variables, R2 binding and authentication integration. This source is not a Vercel Next.js build. The SQL setup command does not deploy a website.

## 6. Verify the connection

1. Open your customer/backend site's `/api/catalogue` endpoint. It should return HTTP 200 with `storage: "postgresql"`, a `categories` array and an `ingredients` array.
2. Sign in to the hosted admin using the approved administrator account.
3. Add a category and upload your own photograph; both should appear on customer category listings. Use Manage categories → Edit / photo to replace it later. The new category also appears in the enquiry selector.
4. Add an ingredient in that category and publish it. The connected customer catalogue refreshes within about 10 seconds, and also on tab focus.
5. Delete that ingredient. It should disappear from both catalogues and stay gone after restarting or refreshing.
6. Delete an empty category, or confirm deleting a category with its ingredients. It should disappear from both sites and stay deleted after restart.
7. Test searches such as a product name plus a partner name; Clear search should restore the results.
8. To remove old products from an existing database, choose **Delete all products** in the admin and type **DELETE ALL PRODUCTS**. This permanently clears ingredients and legacy products while keeping categories, settings and uploaded files.

No private production database or hosting credentials are included in the ZIP. No live database was accessed or changed while preparing it.

## Official references

- Neon connection strings: https://neon.com/docs/connect/connect-from-any-app
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- PostgreSQL table creation: https://www.postgresql.org/docs/current/sql-createtable.html
- PostgreSQL deletion: https://www.postgresql.org/docs/current/sql-delete.html
