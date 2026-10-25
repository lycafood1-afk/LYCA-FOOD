# Deploy LYCA as two separate Vercel websites

The customer website and Ingredient Studio are two Vercel projects with separate
addresses. Both connect directly to the **same Neon database** and the **same
public Vercel Blob store**. An admin edit saves once to Neon. Customer pages read
those records and refresh within about 10 seconds, and when the tab regains focus.
Draft and archived ingredients remain private. No cross-site API proxy or CORS
configuration is required.

The root `vercel.json` and `package.json` are the Vercel entrypoints. The preserved
`admin-site` and `customer-and-backend` folders contain the original source;
**do not select either subfolder as the Vercel Root Directory**.

## 1. Extract and upload the project

1. Extract the complete ZIP. Keep the whole project together.
2. Create a GitHub repository and upload/commit the extracted project contents,
   including root `package.json`, `package-lock.json`, `vercel.json`, `api`,
   `vercel-runtime`, `shared`, `local-runtime/public`, `admin-site`, and
   `customer-and-backend`. Upload the files, not the ZIP itself.
3. Keep `.gitignore` in the repository. It excludes local databases, installed
   dependencies and private environment files. GitHub Desktop can publish the
   extracted folder as a repository without entering Git commands.

## 2. Finish the Neon SQL setup

In Neon, open your LYCA project -> SQL Editor -> production -> neondb.

- If you already ran `POSTGRESQL-SETUP.sql`, run **VERCEL-SETUP.sql** now.
- For a new database, run **POSTGRESQL-SETUP.sql**, then **VERCEL-SETUP.sql**.

The additional table is used for administrator sign-in limits across server
instances. Both scripts can be repeated without clearing products or restoring
deleted categories. They do not import demonstration products.

Click **Connect**, select the same `neondb` database, and copy its full private
connection string. Keep the SSL parameters supplied by Neon. You will enter the
same string in both Vercel projects' private settings, never browser code.

## 3. Create the CUSTOMER Vercel project

1. In Vercel, select **Add New -> Project** and import your GitHub repository.
2. Name it, for example, `lyca-customer` (choose an available name).
3. Set **Framework Preset: Other** and **Root Directory: repository root**
   (normally shown as `./`).
4. The included configuration sets Install Command `npm ci --include=dev`,
   Build Command `npm run build`, and Output Directory `vercel-public`.
   Use Node.js **22.x**. Do not choose Next.js or Vite auto-detection overrides.
5. Add these server environment variables to **Production**:

| Name | Customer value |
| --- | --- |
| `LYCA_SITE_ROLE` | `customer` |
| `DATABASE_URL` | Your exact private Neon connection string |

6. Deploy. Record the resulting customer URL. The sample name in this guide is
   not an already-created website.

The customer frontend will work with catalogue data after database settings are
applied. Add the Blob setting in step 5 before testing uploaded photos.

## 4. Generate your ADMIN sign-in settings

Open a terminal in the extracted ZIP root. On Windows, open the folder in File
Explorer, type `cmd` in its address bar and press Enter. Run:

```bat
node scripts/create-admin.mjs
```

Enter your email, choose a password of at least 14 characters, and repeat it.
Password entry is hidden. The command prints three settings:

```text
ADMIN_EMAIL=your email
ADMIN_PASSWORD_HASH=generated value
SESSION_SECRET=generated value
```

Copy the actual generated values into the admin Vercel project. The command does
not save a password file and does not require `npm install`. You sign in using
your email and the password you chose, not the generated hash.

## 5. Create the ADMIN project and shared photograph store

1. Import the **same GitHub repository again** as another Vercel project,
   for example `lyca-admin`. Use the same root directory and build settings.
2. Add the following server environment variables to **Production**:

| Name | Admin value |
| --- | --- |
| `LYCA_SITE_ROLE` | `admin` |
| `DATABASE_URL` | Exactly the same Neon connection string as customer |
| `ADMIN_EMAIL` | Email from the helper |
| `ADMIN_PASSWORD_HASH` | Hash from the helper |
| `SESSION_SECRET` | Secret from the helper |
| `CUSTOMER_SITE_URL` | Your customer HTTPS origin, e.g. `https://lyca-customer.vercel.app` |

3. Deploy the admin project. Then open its **Storage** area and create a
   **Vercel Blob** store with **Public** access. These are public catalogue photos.
4. Connect this one store to **both** Vercel projects, with the environment
   variable name **BLOB_READ_WRITE_TOKEN**, for Production. Alternatively, copy
   the existing store's token from its settings into that variable on both
   projects. Both tokens must grant access to the same store.
5. Redeploy both projects after adding the Blob setting.

If the customer URL changes, update `CUSTOMER_SITE_URL` on admin and redeploy
admin once. Enter an origin only: no `/api`, path, query or fragment.

## 6. Test your two live websites

1. Open `https://YOUR-ADMIN-PROJECT.vercel.app/`. Click **Sign in securely**,
   then enter the email/password you chose. Sign-in uses a secure browser cookie;
   ChatGPT/Cloudflare authentication is not required on Vercel.
2. Add a category and upload your chosen JPEG, PNG or WebP photo, **up to 4 MB**.
3. Open the separate customer URL. The category and photograph should appear.
4. Add an ingredient as a draft. It should be visible only in admin.
5. Publish it. It should appear on the customer site within about 10 seconds.
6. Search for it on both sites. Edit it and verify the customer details update.
7. Delete the ingredient, then delete the category. Check that both disappear
   on the customer site. A category containing ingredients requires explicit
   confirmation before those ingredients are deleted too.
8. Use **Open customer site** in admin to verify `CUSTOMER_SITE_URL`.

The customer site's `/api/catalogue` should return HTTP 200 with
`storage: "postgresql"`, `categories`, and `ingredients`. A new database has
seven starting categories and zero products.

## Later deployments

Vercel retains each project's environment settings. You do **not** reconnect
Neon or recreate tables after every deployment. New deployments reuse the same
database and Blob store. Database records and uploaded photos remain there.
After adding or changing a Vercel environment value, deploy again to apply it.
Changing the password hash or session secret invalidates existing admin sessions.

The administrator session expires after eight hours. Sign out asks for confirmation.
Ten sign-in attempts from one IP within 15 minutes, or 40 attempts for the admin
account, trigger a temporary limit shared across server instances.

Set Preview variables separately if you want preview deployments. A preview
pointing at this same database edits the same catalogue; a separate Neon branch
can be used when you need independent test data.

## Local data and existing photographs

`START-WINDOWS.cmd` still runs the original local-only workspace with its own
`.local-data` database and uploaded files. Local changes are **not** copied to
Neon or Blob by deploying. Add the real catalogue through the deployed admin
if you want it available online. Existing local or Cloudflare R2 photo references
need their files uploaded to the shared Blob store and selected again; a database
connection alone cannot transfer image files.

Deleting a product or category removes its catalogue reference. Uploaded photo
objects stay in Blob because another item may share the same photo. Unused files
can be managed from the store dashboard.

## Editing the source later

The package includes the tested, prebuilt customer and admin designs so Vercel
does not install the original Cloudflare toolchains. Root `npm run build`
bundles the current API source and copies the frontend builds for the selected
role. No environment secrets are embedded in browser JavaScript.

After changing frontend source, rebuild its assets locally before committing:

```bat
node scripts/setup-source.mjs
cd admin-site
npm run build:local
cd ..\customer-and-backend
npm run build:customer
```

Commit the refreshed `local-runtime/public/admin` and
`customer-and-backend/public/customer` assets too. API source changes are rebuilt
automatically by Vercel.

To run the Vercel integration checks locally from the extracted root:

```bat
npm ci --include=dev
npm test
```

These checks use the included embedded PostgreSQL runtime and a test photograph
store. They do not access your private Neon database or Vercel account.

## Troubleshooting

- **Build says LYCA_SITE_ROLE is missing:** set it to exactly `admin` or
  `customer` in the corresponding project and deployment environment, then redeploy.
- **Catalogue unavailable:** check both `DATABASE_URL` values, Neon database
  selection, and completion of `POSTGRESQL-SETUP.sql`.
- **Sign-in temporarily unavailable:** run `VERCEL-SETUP.sql` in that same database
  and confirm all three administrator settings on the admin project.
- **Photos fail:** both projects need `BLOB_READ_WRITE_TOKEN` for the same
  **public** Blob store. Redeploy after connecting it. Use a file up to 4 MB.
- **Customer link fails:** correct `CUSTOMER_SITE_URL` on admin and redeploy it.
- **Old data is missing:** confirm that the connection string identifies the same
  Neon branch and database. Local workstation data is separate.

## Official documentation

- Vercel projects: https://vercel.com/docs/projects
- Environment variables: https://vercel.com/docs/environment-variables
- Node.js functions: https://vercel.com/docs/functions/runtimes/node-js
- Blob stores: https://vercel.com/docs/vercel-blob
- Blob SDK: https://vercel.com/docs/vercel-blob/using-blob-sdk
- Function upload limits: https://vercel.com/docs/functions/limitations
- Neon connections: https://neon.com/docs/connect/connect-from-any-app
