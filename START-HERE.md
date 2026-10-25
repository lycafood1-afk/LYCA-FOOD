# LYCA Customer Website, Admin and PostgreSQL Backend

## Deploy on Vercel

Read **VERCEL-DEPLOY.md** for the complete setup. This version supports **two separate Vercel projects**, one administrator and one customer website, sharing one Neon database and one public Vercel Blob store. Use this extracted folder's root as the Root Directory for both projects, with `LYCA_SITE_ROLE=admin` or `LYCA_SITE_ROLE=customer` in the corresponding project settings. The root build configuration selects the correct website.

Run **VERCEL-SETUP.sql** in your existing Neon database, then follow the guide to generate administrator credentials. The Vercel upload limit is **4 MB** per photo; the local workspace retains its 5 MB limit. Both sites keep the requested category/product deletion, category photos, search and customer Back button.

## Start on Windows

1. Extract the WHOLE ZIP to a normal folder, for example `C:\LYCA`. Do not run it inside the ZIP viewer.
2. Keep Node.js 22.13 or newer installed. The Node.js 22.20.0 in your screenshot is supported.
3. Double-click **START-WINDOWS.cmd** in this folder. Keep its terminal window open.
4. Open **http://localhost:5173** for the administrator. Click **Sign in**, then **Open local administrator**.
5. Open **http://localhost:5174** for the customer website.

The local mode includes its built customer/admin pages and its three portable runtime dependencies. No npm/pnpm install, native Rolldown binding, database account, Cloudflare login or Bash is needed for normal startup. If the runtime dependencies are removed, the launcher can restore their exact locked versions with npm; that repair requires internet access.

On macOS/Linux, run `bash START-MAC-LINUX.sh`, or use `node scripts/start-local.mjs` on any supported operating system.

## What works locally

- Customer site, product categories, product details and enquiry pages.
- Ingredient administrator with search, filters, new/edit, drafts, publishing and archiving.
- One shared catalogue: published admin changes appear on the customer site through its existing refresh/polling behavior.
- Image uploads and serving, saved contact settings and concurrent edit protection.
- Persistent embedded PostgreSQL (PGlite) using the same repository SQL, migrations and API route source as the hosted application.
- An empty initial product catalogue, seven starting categories and the original website design/assets.
- Product delete controls, Delete all products, and Add category. Categories and published products sync to the customer catalogue.
- A Back button on customer pages, with a safe home/catalogue fallback for direct links.

Data and uploaded images are saved in **.local-data** next to this file. Stop the server with Ctrl+C before backing up or moving this folder. Keep .local-data if you extract an updated version. Do not open the same data folder in two running copies. If a port is occupied, close the other program using 5173/5174, then restart.

Local sign-in grants access only on this computer. It is separate from production authentication. This server listens on loopback and is intended for local use; it is not the production hosting entrypoint.

The enquiry form retains the original contact workflow: without a configured enquiry API it opens a prefilled email draft. Sending email needs a configured mail application or an enquiry service. WhatsApp links and external services need internet access.

## Product deletion and categories

Use **Add category** in the admin header to create a customer-visible category, then add ingredients to it. A category appears even when it has no published products.

The **Manage categories** panel lets you search categories, choose **Edit / photo** to upload or replace your own category photograph, and delete categories. The category editor accepts JPEG, PNG or WebP files up to 5 MB, shows a preview, and saves the chosen photo with the category. Stock photographs remain optional.

Deleting an empty category removes it from both sites. If it contains ingredients, the confirmation clearly asks whether to permanently delete the category AND those ingredients. Deleted default categories stay deleted after restarting. You can delete every category, then add a new one; Add ingredient is disabled until a category exists.

Ingredient search matches multiple words across names, category titles, groups, partners, descriptions and specifications. Capitalization, repeated spaces and common accent/punctuation differences are handled. The customer search uses the same matching rules, and Clear search restores the full visible collection. Admin visibility and category filters still apply when searching.

Use **Delete** on a product row or **Delete product** in the editor to permanently remove one ingredient. Use **Product delete → Delete all products** to clear an existing saved catalogue; type DELETE ALL PRODUCTS to confirm. This clears legacy products too. The new ZIP starts empty when no existing .local-data is copied. Existing .local-data is preserved, so use this control if you want to delete its old products.

Deleted products are not restored from a built-in fallback. Connected customer pages refresh within about 10 seconds and on tab focus. New categories also appear in the customer enquiry selector. Customer subpages have a **Back** button.

## Your live website and PostgreSQL database

Local changes stay on your computer. They are not automatically copied to your existing live website or Neon database. The ZIP does not contain your live database password, service token, administrator session, private database edits or R2 uploads. The original catalogue seed and bundled website photos are included.

The original hosted source is preserved in:

- `customer-and-backend/`: customer assets, Cloudflare Workers/Vinext application, Neon PostgreSQL repository and migrations.
- `admin-site/`: protected hosted administrator.
- `local-runtime/`: local adapter and prebuilt administrator; the adapter executes the original catalogue API route source.

Follow **POSTGRESQL-SETUP.md** and run **POSTGRESQL-SETUP.sql** for detailed PostgreSQL installation/upgrade steps.

For **Vercel**, use `vercel.admin.env.example`, `vercel.customer.env.example` and **VERCEL-DEPLOY.md**. Do not use the legacy bridge-key/service-token settings below on Vercel.

For the **original Cloudflare hosting**, configure the values listed in each subproject's `.env.example` through server-only hosting settings:

- Backend: `DATABASE_URL`, `CATALOGUE_DATABASE=postgresql`, `CATALOGUE_READ_ONLY=false`, `ADMIN_EMAIL`, `ADMIN_BRIDGE_KEY`, and its existing R2 binding.
- Admin: `ADMIN_EMAIL`, `ADMIN_BRIDGE_KEY`, `CATALOGUE_ORIGIN`, `CATALOGUE_SERVICE_TOKEN`.

The bridge key must match on both servers. Keep credentials out of browser variables and source control. Original migration and sync documentation is in `customer-and-backend/POSTGRESQL.md` and `INGREDIENT-SYNC.md`. Do not rerun the initial migration over existing live administrator edits.

The original Cloudflare Workers/Vinext source and its existing deployment identifiers are retained. The new root Vercel entrypoint runs Node.js functions and uses Vercel Blob plus independent administrator authentication. No live deployment or private database was changed while preparing this ZIP.

## Optional: edit or rebuild the source

Normal local startup does not need this step. For development, double-click **SETUP-SOURCE-WINDOWS.cmd** or run:

```bat
node scripts/setup-source.mjs
```

This uses the pinned **pnpm 11.25.0**, the existing frozen lockfiles, optional native dependencies and a Vite/Rolldown import check. It works without Linux-only Bash/flock setup scripts. To repair a previously broken source installation:

```bat
node scripts/setup-source.mjs --repair
```

The repair removes only the two source projects' installed node_modules folders. It preserves source, environment configuration, pnpm lockfiles and local catalogue data. Do not mix `npm install` into these two pnpm source projects.

Build the customer design/backend:

```bat
cd customer-and-backend
npm run build
```

Build the hosted admin and refresh the packaged local admin after editing it:

```bat
cd admin-site
npm run build
npm run build:local
```

The customer build refreshes `customer-and-backend/public/customer`. The local admin build refreshes `local-runtime/public/admin`. Restart the local launcher after changing the API route source.

For source development servers, `npm run dev` in each project runs the original Cloudflare/Vinext setup; this requires appropriate environment configuration. Use START-WINDOWS.cmd for the ready-to-run local workspace.

## Validation

See **VALIDATION.md** for executed checks and platform limits. Run the local integration test with:

```bat
cd local-runtime
npm test
```
