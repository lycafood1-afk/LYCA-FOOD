# Validation — 25 October 2026

Executed on Linux with Node.js 24.22.1. No live hosting or private production database was changed.

## Vercel adaptation checks

- Both role builds succeed from the root package: separate administrator and customer HTML, JavaScript, fonts and stock photographs; bundled Node.js API has no Cloudflare runtime or Next.js headers dependency.
- Root `npm test`: all 16 checks passed, including the four shared search tests, ten Vercel integration scenarios and both frontend role builds. The route bundle runs against PostgreSQL semantics through PGlite, with an injected photograph store rather than a private Blob account.
- Separate admin/customer application instances share PostgreSQL records and photograph references. Category create/edit, publish/draft visibility, version conflicts, ingredient deletion, category cascade, repeated SQL setup and instance recreation were verified.
- Parallel private/public requests preserve draft isolation. Customer mutation attempts, forged hosting/bridge headers and cross-origin writes are rejected.
- Administrator password verification, Secure/HttpOnly/SameSite cookies, signed session tampering, expiry, origin binding, password/secret rotation, POST logout and PostgreSQL-backed login throttling across instances passed.
- Photograph signature validation, 4 MB limit, shared store writes, public CDN redirects through direct media and catalogue image routes, and missing-photo behavior passed with the test store.
- The actual Vercel Node runtime package (`@vercel/node` 27.0.2) loaded `api/index.mjs` and served HTTP requests successfully for both roles. Web Handler exports, rewritten API paths and administrator-only login exposure passed locally.
- Administrator credential helper passed an interactive terminal check: hidden password entry, confirmation, hash/secret generation and no password echo.
- Updated admin frontend build, admin TypeScript check and backend TypeScript check passed. The legacy local-runtime integration suite and PostgreSQL migration suite also passed.
- The packaged ZIP was extracted into a fresh folder with spaces; root dependency installation and both-role integration/build checks passed from the packaged files.

No live Vercel deployment, private Neon connection or real Vercel Blob upload was performed. Those account-specific checks must be completed using VERCEL-DEPLOY.md after entering your private settings. The original local launcher remains separate from Neon/Blob.

## Passed

- Customer TypeScript check, local asset verification and production builds for the customer design and Cloudflare/Vinext backend.
- Hosted admin production build and prebuilt local administrator build.
- Drizzle category schema, generated SQL migration, journal and snapshot.
- Existing PostgreSQL migration/API tests, including the historical 108-product migration fixture, Unicode, image handling, saved settings and optimistic concurrency.
- Bulk deletion of the historical seeded fixture and legacy products: neither API restores deleted seed records.
- New installation starts with zero ingredient records and zero legacy products.
- Category creation, case-insensitive duplicate-name rejection, public category metadata, category-only revision changes and persistence after restart.
- Category photograph upload, update with version checks, public image serving and persisted image references after restart.
- Authenticated category deletion, non-empty category refusal without cascade confirmation, stale delete refusal, confirmed cascade deleting published/draft ingredients, deleted defaults never reappearing and zero-category recovery.
- Shared search tests: multi-word matching across fields, case, common accents, punctuation, Tamil text, category names, group names, descriptions, specifications, partner names, empty categories, no results and clearing without modifying source data.
- DOM interaction tests ran the prebuilt admin/customer JavaScript against the actual local HTTP API: admin multi-field search and Clear, category create with custom photo, editing/replacing the photo, category search/deletion, customer multi-field/partner/specification search, no results and Clear.
- New ingredients in a custom category: drafts stay private; publishing makes them public; archiving hides them.
- Authenticated permanent ingredient deletion, stale-version refusal, unauthenticated and cross-origin deletion refusal, and refusal to edit a deleted ingredient back into existence.
- Confirmed bulk deletion clears ingredients and legacy products atomically, preserves categories and settings, and remains empty after restart.
- Local sign-in, read-only customer listener, forged-header rejection and old-session invalidation.
- Uploaded image bytes, product versions and settings survive restart; duplicate opening of the same local database is rejected.
- Customer/admin HTML, JavaScript and CSS assets, nested CSS font resources, all six TrueType fonts, favicon, deep links and admin/customer redirects.
- POSTGRESQL-SETUP.sql executes repeatedly against PostgreSQL (PGlite), creates seven initial categories and zero products, and preserves an existing test record.
- Setup/helper JavaScript syntax checks and preserved frozen dependency lockfiles.

## Platform limits

The Windows .cmd launchers were not executed on Windows. Their packaged local dependencies are JavaScript/WebAssembly and contain no native Windows build dependency. Node.js 22.13 or newer is required.

Browser visual testing remains unavailable because Chromium is not installed. DOM interaction tests passed using Happy DOM with the real built JavaScript and local API; these tests verify interactions and results, not pixel layout. The Back button and all controls also compile in the production builds.

The included hosted PostgreSQL instructions target the Neon HTTP driver already used by the source. Vercel deployment uses the new independent administrator authentication and Vercel Blob adapter. The preserved Cloudflare deployment uses its original hosted authentication and R2. Production database credentials, hosted storage and external email delivery were not available for live validation. The local launcher continues to use its separate embedded PostgreSQL database.
