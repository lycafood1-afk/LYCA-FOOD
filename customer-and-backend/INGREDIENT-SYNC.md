# LYCA ingredient administration and customer sync

The current catalogue contains 108 brochure ingredients in seven families. The live service stores ingredients and administrator changes in Neon PostgreSQL (`lyca.ingredients`). PostgreSQL was activated on 23 October 2026 after complete migration verification. The old D1 database is retained as a migration backup. Uploaded images use the existing R2 bucket. Legacy products and contact settings also use PostgreSQL.

## Workflow

1. Open the LYCA Product Administration site with the approved owner account.
2. Choose Add ingredient, enter the name, family and group, and optionally add a description, specifications, partner and photo.
3. Save as Draft while preparing the entry. Select Published and save to make it visible in the customer catalogue. Select Archived to hide it while preserving its record.
4. Open Customer site from the admin sidebar. Its catalogue reads the same backend, checks every 10 seconds while visible, and refreshes on focus or connectivity recovery.

The uploaded purple/champagne customer design is hosted at the main catalogue site root. The administration site links directly to it; its previous `/customer/` URLs redirect to the main customer site. Product descriptions, specifications, partner details and uploaded photographs have individual ingredient detail pages. Enquiries prefill the selected ingredient and partner.

## Security and consistency

The existing private-site audience, owner allowlist, server-side bridge and service credentials are preserved. The administration bridge key never enters customer JavaScript. API writes reject unauthorized and cross-origin requests. Records carry versions; stale or concurrent edits receive HTTP 409 rather than overwrite newer work. Drafts and archived items are filtered on the server, not just hidden in CSS.

The customer feed is read-only and uses no-store responses. The Vercel customer source includes `api/catalogue.ts`, a server-only read proxy. Configure CATALOGUE_ORIGIN and CATALOGUE_SERVICE_TOKEN in Vercel to connect that separate deployment. Never prefix the token with VITE_. The currently deployed Vercel website is not changed merely by publishing these Sites versions.

## Validation

TypeScript checks and production builds passed for the admin, catalogue service and customer application. PostgreSQL integration checks execute the real API routes, repository and migration SQL against PGlite, with an R2 fixture. They cover catalogue load, authorization, origin checks, draft visibility, publishing, version conflicts, concurrent writes, photo upload/read and archiving. The historical D1 compatibility checks also passed. Hosted checks confirm `storage: "postgresql"`, 108 published ingredients, seven families, the connected customer HTML and administrator access enforcement.

Browser QA inspected the local signed-out admin view. Full protected browser interaction is limited by the preview's lack of a signed-in owner identity; no authentication was bypassed. No test product was written into the hosted database.
